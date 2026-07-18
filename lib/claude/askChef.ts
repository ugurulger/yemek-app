import { callClaudeForText } from './client';

import type { ClaudeMessage, ClaudeSystemBlock } from './client';
import type { ChefChatMessage } from '@/store/chefChatStore';
import type { Recipe } from '@/types/recipe';

// Tarif chat'i tarif üretimiyle aynı modeli kullanır (bkz. SKILL.md "Tarif chat'i").
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1024;

const CHEF_INSTRUCTIONS =
  'Deneyimli bir şefsin. Kurallar: ' +
  '- YALNIZCA aşağıda verilen tarif bağlamında yanıt ver; tarifle ilgisiz konularda kibarca tarife dön. ' +
  '- Malzeme değişimi/ikamesi önerirken etkilenen miktarları da güncelle. ' +
  '- Kısa ve pratik yanıtla — uzun teori değil, mutfakta hemen uygulanabilir öneri. ' +
  '- Markdown biçimlendirmesi KULLANMA (yıldız, başlık işareti vb.) — sohbet balonu düz ' +
  'metin gösterir; madde gerekiyorsa satır başına "• " koy.';

/**
 * Tarifin tamamını (ad, malzemeler miktar/kcal ile, adımlar, şef tüyosu)
 * system bloğuna gömülecek düz metne çevirir. Aynı tarifin sohbeti boyunca
 * BİREBİR aynı metin üretilir — `cache_control: ephemeral` prefix cache'i
 * ardışık mesajlarda tutar.
 */
function formatRecipeContext(recipe: Recipe): string {
  const ingredientLines = recipe.ingredients
    .map(
      (ingredient) =>
        `- ${ingredient.qty} ${ingredient.unit} ${ingredient.name} (${ingredient.kcal} kcal` +
        `${ingredient.in_inventory ? '' : ', envanterde yok'})`
    )
    .join('\n');
  const stepLines = recipe.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');

  return [
    `TARİF: ${recipe.name} ${recipe.emoji}`,
    `${recipe.servings} kişilik · ${recipe.time_min} dk · ${recipe.difficulty} · ` +
      `${recipe.kcal} kcal/kişi · ${recipe.nutrition_tag}`,
    `Makrolar (g): protein ${recipe.macros.protein}, karbonhidrat ${recipe.macros.karb}, yağ ${recipe.macros.yag}`,
    '',
    `Malzemeler (${recipe.servings} kişilik miktarlar):`,
    ingredientLines,
    '',
    'Hazırlanış:',
    stepLines,
    '',
    `Şef tüyosu: ${recipe.chef_tip}`,
  ].join('\n');
}

/**
 * Şefe Sor (spec §5, bkz. services/contracts.ts — `AskChef`): tarifin tamamı
 * system bloğunda (cache'li), geçmiş + yeni mesaj messages dizisinde gönderilir;
 * şefin Türkçe yanıt metni döner.
 */
export async function askChef(
  recipe: Recipe,
  history: ChefChatMessage[],
  message: string,
  // Çıktı dili aktif uygulama dilinden gelir (BLOK B / B3) — çağıran ekran
  // llmOutputLanguage() geçirir; varsayılan Türkçe (eski davranış).
  outputLanguage: string = 'Turkish'
): Promise<string> {
  const system: ClaudeSystemBlock[] = [
    {
      // Dil talimatı cache'li bloğun İÇİNDE: aynı sohbet aynı dilde sürdüğü
      // sürece prefix cache tutar; dil değişirse cache haklı olarak tazelenir.
      type: 'text',
      text: `${CHEF_INSTRUCTIONS} - Yanıt dilin: ${outputLanguage}.\n\n${formatRecipeContext(recipe)}`,
      cache_control: { type: 'ephemeral' },
    },
  ];

  const messages: ClaudeMessage[] = [
    ...history.map((entry) => ({ role: entry.role, content: entry.content })),
    { role: 'user', content: message },
  ];

  return callClaudeForText({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages,
  });
}
