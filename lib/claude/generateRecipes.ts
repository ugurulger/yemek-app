import { callClaudeForToolInput } from './client';

import type { InventoryItem } from '@/types/inventory';
import type { Recipe, RecipeDifficulty, RecipeIngredient } from '@/types/recipe';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const SUBMIT_RECIPES_TOOL = 'submit_recipes';

const SYSTEM_PROMPT =
  'Verilen envanter listesine göre TAM 9 adet gerçekçi tarif öner — 3 katman, her katmanda 3 tarif: ' +
  '1) 3 tarif match_pct = 100: SADECE envanterdeki malzemeler + temel kiler malzemeleri (tuz, karabiber, su, ' +
  'sıvı yağ) ile yapılabilen tarifler. ' +
  '2) 3 tarif match_pct 75-99 arası: envanterde olmayan 1-2 malzeme içeren tarifler. ' +
  '3) 3 tarif match_pct 50-74 arası: envanterde olmayan birkaç malzeme içeren tarifler. ' +
  'Kurallar: ' +
  '- Türk mutfağına öncelik ver ama zorunlu tutma. ' +
  '- Tarif isimleri doğru olsun: bilinen bir yemeğin adını (örn. Menemen, Karnıyarık) yalnızca o yemeğin ' +
  'tanımlayıcı malzemeleri tarifte gerçekten varsa kullan (Menemen için domates ve biber şart). ' +
  'Tanımlayıcı malzeme eksikse farklı ve doğru bir isim ver (örn. domatessiz yumurta yemeğine "Sahanda Yumurta" ' +
  'veya "Peynirli Yumurta" de, "Menemen" deme). ' +
  '- Süre ve kalori bilgisi gerçekçi olsun, abartılı/tutarsız değerler verme. ' +
  '- Zorluk derecesini gerçekçi ver: çoğu ev yemeği "Kolay" veya "Orta" olmalı, "Zor" nadiren kullanılsın. ' +
  '- chef_tip: tarife özel, kısa ve pratik bir şef önerisi/tüyosu ver (örn. bir malzeme ikamesi, pişirme ipucu). ' +
  '- ingredients: her malzeme için in_inventory işaretlemesini sana verilen envanter listesine göre yap; ' +
  'temel kiler malzemelerini (tuz, karabiber, su, sıvı yağ) in_inventory: true say. ' +
  '- missing_count: in_inventory: false olan malzemelerin sayısı (katman 1 tariflerinde 0 olmalı). ' +
  '- match_pct: kiler malzemeleri (tuz, karabiber, su, sıvı yağ) HARİÇ tutularak hesaplanan, tarifin geri kalan ' +
  'malzemelerinden kaçının envanterde bulunduğunun yüzdesi (0-100 tam sayı). Bir tarif yalnızca envanter ve ' +
  'kiler malzemeleriyle yapılabiliyorsa match_pct %100 olmalı. ' +
  '- image_prompt_en: İNGİLİZCE, iki kısımdan oluşan kısa bir görsel tanımı: yemeğin tanımı + tek cümlelik ' +
  'tabaklama betimlemesi (örn. "Turkish menemen, scrambled eggs cooked with tomatoes and green peppers. ' +
  'Served bubbling in a small black skillet with a sprig of parsley on top."). Türkçe yazma; marka adı kullanma. ' +
  '- Tarifleri match_pct değerine göre en yüksekten düşüğe sırala.';

const RECIPE_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    emoji: { type: 'string' },
    kcal: { type: 'number' },
    servings: { type: 'number' },
    time_min: { type: 'number' },
    difficulty: { type: 'string', enum: ['Kolay', 'Orta', 'Zor'] },
    macros: {
      type: 'object',
      properties: {
        protein: { type: 'number' },
        karb: { type: 'number' },
        yag: { type: 'number' },
      },
      required: ['protein', 'karb', 'yag'],
    },
    match_pct: { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          in_inventory: { type: 'boolean' },
        },
        required: ['name', 'in_inventory'],
      },
    },
    missing_count: { type: 'number' },
    steps: { type: 'array', items: { type: 'string' } },
    chef_tip: { type: 'string' },
    image_prompt_en: {
      type: 'string',
      description:
        'İngilizce kısa yemek tanımı + tek cümlelik tabaklama betimlemesi (görsel üretim promptu için)',
    },
  },
  required: [
    'name',
    'emoji',
    'kcal',
    'servings',
    'time_min',
    'difficulty',
    'macros',
    'match_pct',
    'ingredients',
    'missing_count',
    'steps',
    'chef_tip',
    'image_prompt_en',
  ],
};

const SUBMIT_RECIPES_TOOL_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      minItems: 9,
      maxItems: 9,
      items: RECIPE_ITEM_SCHEMA,
    },
  },
  required: ['recipes'],
};

/**
 * Envanter listesinden Claude API ile tarif önerisi üretimi sırasında
 * oluşan hatalar için kullanılan hata tipi. Çağıran taraf bu tek hata
 * tipini yakalayarak kullanıcıya "tekrar dene" durumu gösterebilir.
 */
export class RecipeGenerationError extends Error {}

function generateId(): string {
  // React Native'de crypto.randomUUID her zaman mevcut olmayabilir.
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clampPercentage(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isIngredientArray(value: unknown): value is RecipeIngredient[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as RecipeIngredient).name === 'string' &&
        typeof (entry as RecipeIngredient).in_inventory === 'boolean'
    )
  );
}

function toDifficulty(value: unknown): RecipeDifficulty {
  return value === 'Kolay' || value === 'Orta' || value === 'Zor' ? value : 'Orta';
}

/**
 * Tool-use şeması (`RECIPE_ITEM_SCHEMA`) Claude'u zaten doğru tip/alan
 * üretmeye zorladığı için burada tam yeniden doğrulama yerine minimal bir
 * güvenlik kontrolü yeterli (eksik/bozuk bir öğeyi listeden düşürür).
 */
function toRecipe(raw: unknown): Recipe | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const macros = obj.macros as Record<string, unknown> | undefined;

  if (
    typeof obj.name !== 'string' ||
    obj.name.trim().length === 0 ||
    typeof obj.kcal !== 'number' ||
    typeof obj.servings !== 'number' ||
    typeof obj.time_min !== 'number' ||
    typeof obj.match_pct !== 'number' ||
    typeof obj.chef_tip !== 'string' ||
    !isIngredientArray(obj.ingredients) ||
    !isStringArray(obj.steps) ||
    typeof macros !== 'object' ||
    macros === null ||
    typeof macros.protein !== 'number' ||
    typeof macros.karb !== 'number' ||
    typeof macros.yag !== 'number'
  ) {
    return null;
  }

  const ingredients = obj.ingredients;
  const actualMissingCount = ingredients.filter((entry) => !entry.in_inventory).length;

  return {
    id: generateId(),
    name: obj.name,
    emoji: typeof obj.emoji === 'string' && obj.emoji.length > 0 ? obj.emoji : '🍽️',
    kcal: obj.kcal,
    servings: obj.servings,
    time_min: obj.time_min,
    difficulty: toDifficulty(obj.difficulty),
    macros: { protein: macros.protein, karb: macros.karb, yag: macros.yag },
    match_pct: clampPercentage(obj.match_pct),
    ingredients,
    // Modelin verdiği sayı ile in_inventory işaretleri çelişirse işaretler kazanır
    // (rozet ile detay listesi aynı kaynaktan beslensin diye).
    missing_count: actualMissingCount,
    steps: obj.steps,
    chef_tip: obj.chef_tip,
    // Tool şemasında zorunlu ama Recipe tipinde opsiyonel (eski cache'lerle uyum);
    // eksik/bozuksa tarif düşürülmez, görsel üretimi malzeme özetine düşer.
    image_prompt_en:
      typeof obj.image_prompt_en === 'string' && obj.image_prompt_en.trim().length > 0
        ? obj.image_prompt_en
        : undefined,
  };
}

/**
 * Envanter listesinden Claude API kullanarak tarif önerileri üretir.
 *
 * Yalnızca envanterdeki ürünlerin adı, miktarı ve birimi Claude'a gönderilir;
 * id/emoji/confidence gibi model için gerekli olmayan alanlar sadeleştirilir.
 * Yanıt, `submit_recipes` aracına zorunlu bir `tool_choice` ile alınır — Claude
 * biçimsiz metin/markdown yerine doğrudan şemaya uyan bir JSON objesi üretir
 * (bkz. `callClaudeForToolInput`), bu yüzden markdown temizleme veya
 * JSON.parse yeniden deneme mantığına gerek kalmaz.
 */
export async function generateRecipes(inventory: InventoryItem[]): Promise<Recipe[]> {
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  const simplifiedInventory = inventory.map((item) => ({
    name: item.name,
    qty: item.qty,
    unit: item.unit,
  }));

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Envanter: ${JSON.stringify(simplifiedInventory)}`,
        },
      ],
      tools: [
        {
          name: SUBMIT_RECIPES_TOOL,
          description:
            'Envantere göre üretilen 9 tarifi (3x match_pct=100, 3x 75-99, 3x 50-74) yapılandırılmış olarak gönderir.',
          input_schema: SUBMIT_RECIPES_TOOL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_RECIPES_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new RecipeGenerationError(`Claude API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  const rawRecipes = toolInput.recipes;
  if (!Array.isArray(rawRecipes)) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  const recipes = rawRecipes.map(toRecipe).filter((recipe): recipe is Recipe => recipe !== null);

  if (recipes.length === 0) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  return recipes;
}
