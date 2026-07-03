import Anthropic from '@anthropic-ai/sdk';

import type { InventoryItem } from '@/types/inventory';
import type { Recipe, RecipeMacros } from '@/types/recipe';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT =
  'Verilen envanter listesine göre 4-6 adet gerçekçi tarif öner. Kurallar: ' +
  '- Yalnızca envanterdeki malzemeleri ve temel kiler malzemelerini (tuz, yağ, un, şeker, su) kullan. ' +
  '- Türk mutfağına öncelik ver. ' +
  '- Tarif isimleri doğru olsun: bilinen bir yemeğin adını (örn. Menemen, Karnıyarık) yalnızca o yemeğin ' +
  'tanımlayıcı malzemeleri envanterde/kilerde gerçekten varsa kullan (Menemen için domates ve biber şart). ' +
  'Tanımlayıcı malzeme eksikse farklı ve doğru bir isim ver (örn. domatessiz yumurta yemeğine "Sahanda Yumurta" ' +
  'veya "Peynirli Yumurta" de, "Menemen" deme). ' +
  '- Süre ve kalori bilgisi gerçekçi olsun, abartılı/tutarsız değerler verme. ' +
  '- SADECE JSON dön, başka hiçbir açıklama veya markdown backtick ekleme: ' +
  '[{ "name": string, "emoji": string, "kcal": number, "servings": number, "time_min": number, ' +
  '"macros": {"protein": number, "karb": number, "yag": number}, "match_pct": number, ' +
  '"ingredients": [string], "steps": [string] }]. ' +
  '- match_pct: kiler malzemeleri (tuz, yağ, un, şeker, su) HARİÇ tutularak hesaplanan, tarifin geri kalan ' +
  'malzemelerinden kaçının envanterde bulunduğunun yüzdesi (0-100 tam sayı). Bir tarif yalnızca envanter ve ' +
  'kiler malzemeleriyle yapılabiliyorsa match_pct %100 olmalı.';

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

function stripMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Bazı yanıtlar sadece açılış fence'i içerebilir ya da fence'siz gelebilir;
  // genel bir temizlik olarak baştaki/sondaki backtick bloklarını da temizle.
  return trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

function clampPercentage(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return Math.round(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

function toRecipeMacros(raw: unknown): RecipeMacros | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const protein = obj.protein;
  const karb = obj.karb;
  const yag = obj.yag;

  if (!isFiniteNumber(protein) || !isFiniteNumber(karb) || !isFiniteNumber(yag)) {
    return null;
  }

  return { protein, karb, yag };
}

function toRecipe(raw: unknown): Recipe | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const name = obj.name;
  const emoji = obj.emoji;
  const kcal = obj.kcal;
  const servings = obj.servings;
  const timeMin = obj.time_min;
  const matchPct = obj.match_pct;
  const ingredients = obj.ingredients;
  const steps = obj.steps;

  if (typeof name !== 'string' || name.trim().length === 0) {
    return null;
  }
  if (!isFiniteNumber(kcal) || !isFiniteNumber(servings) || !isFiniteNumber(timeMin)) {
    return null;
  }
  if (!isFiniteNumber(matchPct)) {
    return null;
  }
  if (!isNonEmptyStringArray(ingredients) || !isNonEmptyStringArray(steps)) {
    return null;
  }

  const macros = toRecipeMacros(obj.macros);
  if (!macros) {
    return null;
  }

  return {
    id: generateId(),
    name,
    emoji: typeof emoji === 'string' && emoji.length > 0 ? emoji : '🍽️',
    kcal,
    servings,
    time_min: timeMin,
    macros,
    match_pct: clampPercentage(matchPct),
    ingredients,
    steps,
  };
}

function parseRecipes(responseText: string): Recipe[] {
  const cleaned = stripMarkdownFence(responseText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (cause) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin', {
      cause,
    });
  }

  if (!Array.isArray(parsed)) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  const recipes = parsed
    .map(toRecipe)
    .filter((recipe): recipe is Recipe => recipe !== null);

  if (recipes.length === 0) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  return recipes;
}

/**
 * Envanter listesinden Claude API kullanarak tarif önerileri üretir.
 *
 * Yalnızca envanterdeki ürünlerin adı, miktarı ve birimi Claude'a gönderilir;
 * id/emoji/confidence gibi model için gerekli olmayan alanlar sadeleştirilir.
 */
export async function generateRecipes(inventory: InventoryItem[]): Promise<Recipe[]> {
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true, // client-taraflı çağrı için resmi SDK opsiyonu
  });

  const simplifiedInventory = inventory.map((item) => ({
    name: item.name,
    qty: item.qty,
    unit: item.unit,
  }));

  let responseText: string;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Envanter: ${JSON.stringify(simplifiedInventory)}`,
        },
      ],
    });

    const textBlock = message.content.find(
      (block): block is Anthropic.Messages.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
    }

    responseText = textBlock.text;
  } catch (error) {
    if (error instanceof RecipeGenerationError) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new RecipeGenerationError(
      `Claude API çağrısı başarısız oldu: ${message}`,
      { cause: error }
    );
  }

  return parseRecipes(responseText);
}
