import { callClaudeForToolInput } from './client';

import { AI_INGREDIENT_CATEGORIES, categorizeIngredient } from '@/lib/inventory/categorize';
import { INVENTORY_UNITS } from '@/types/inventory';

import type { InventoryItem, InventoryUnit } from '@/types/inventory';
import type { PantryCategory } from '@/types/pantry';

// Basit tek-atımlık çıkarım görevi — hızlı/ucuz model yeterli (tarif üretimi
// gibi yaratıcılık gerektirmiyor; bkz. services/contracts.ts "parseIngredients").
const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 1024;
const SUBMIT_INGREDIENTS_TOOL = 'submit_ingredients';

const SYSTEM_PROMPT =
  'Kullanıcının serbest Türkçe metninden mutfak envanterine eklenecek malzemeleri çıkar ' +
  '(örn. "süt, 4 domates, yarım kilo kıyma"). Kurallar: ' +
  '- name: jenerik Türkçe malzeme adı (marka adı yazma, "Arla süt" değil "süt"; baş harfi büyük: "Süt", "Domates"). ' +
  '- qty: metinde geçen miktar; sözel miktarları sayıya çevir ("yarım kilo" → 0.5 kg, "bir düzine" → 12 adet); ' +
  'miktar belirtilmemişse 1. ' +
  '- unit: SADECE sabit listeden bir birim; metindeki birimi en yakın olana eşle ("kilo" → "kg", "litre" → "l"), ' +
  'birim yoksa "adet". ' +
  '- emoji: malzemeyi en iyi anlatan TEK emoji. ' +
  '- category: SADECE sabit listeden bir kategori. Sebzeler (patlıcan, domates, biber...) → "Sebze"; ' +
  'meyveler → "Meyve"; et/tavuk/balık/yumurta/şarküteri → "Et & Tavuk & Balık"; süt/yoğurt/krema → "Süt Ürünleri"; ' +
  'peynirler → "Peynir"; KURU bakliyat ve tahıllar (nohut, mercimek, pirinç, bulgur, makarna...) → "Bakliyat & Tahıl"; ' +
  'soslar, baharatlar, yağlar, turşu/konserve → "Sos & Baharat". Emin değilsen "Diğer" seç. ' +
  '- Malzeme olmayan ifadeleri (selamlaşma, soru, alakasız kelimeler) listeye ALMA; metinde hiç malzeme yoksa ' +
  'BOŞ liste gönder. Aynı malzemeyi iki kez listeleme.';

const SUBMIT_INGREDIENTS_SCHEMA = {
  type: 'object',
  properties: {
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Jenerik Türkçe malzeme adı (markasız)' },
          qty: { type: 'number', description: 'Miktar; metinde belirtilmemişse 1' },
          unit: { type: 'string', enum: [...INVENTORY_UNITS] },
          emoji: { type: 'string', description: 'Malzemeyi anlatan tek emoji' },
          category: {
            type: 'string',
            enum: [...AI_INGREDIENT_CATEGORIES],
            description: 'Malzemenin kategorisi; emin değilsen "Diğer"',
          },
        },
        required: ['name', 'qty', 'unit', 'emoji', 'category'],
      },
    },
  },
  required: ['ingredients'],
};

/**
 * Ayrıştırılan malzeme — InventoryItem + kiler yönlendirmesi. `pantryCategory`
 * null değilse ürün buzdolabına değil Temel Malzemeler'e aittir (örn. nohut →
 * "Bakliyat & Makarna"); yönlendirme kararı asistan ekranında verilir.
 */
export interface ParsedIngredient extends InventoryItem {
  pantryCategory: PantryCategory | null;
}

function toParsedIngredient(raw: unknown, index: number, batchId: number): ParsedIngredient | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return null;
  }
  const name = obj.name.trim();
  // Önce deterministik ad eşlemesi, tanınmayan adlarda modelin kategorisi
  // (bkz. lib/inventory/categorize.ts — kök neden düzeltmesi).
  const categorized = categorizeIngredient(
    name,
    typeof obj.category === 'string' ? obj.category : undefined
  );
  return {
    // Aynı milisaniyede üretilen partinin tamamı aynı zaman damgasını taşır;
    // benzersizlik index ile sağlanır.
    id: `parsed-${batchId}-${index}`,
    name,
    qty: typeof obj.qty === 'number' && Number.isFinite(obj.qty) && obj.qty > 0 ? obj.qty : 1,
    unit: INVENTORY_UNITS.includes(obj.unit as InventoryUnit)
      ? (obj.unit as InventoryUnit)
      : 'adet',
    emoji: typeof obj.emoji === 'string' && obj.emoji.length > 0 ? obj.emoji : '🧺',
    // Kullanıcının kendi yazdığı malzeme — vision belirsizliği yok, eşik
    // (CONFIDENCE_THRESHOLD) filtrelerine takılmadan doğrudan ana listeye girer.
    confidence: 100,
    category: categorized.inventoryCategory,
    pantryCategory: categorized.pantryCategory,
  };
}

/**
 * Asistanla ekleme (spec §3, bkz. services/contracts.ts — `ParseIngredients`):
 * serbest Türkçe metinden malzeme listesi çıkarır. Zorunlu tool-use ile native
 * structured output (markdown/JSON.parse YOK — tarif üretimiyle aynı prensip).
 * Hiç malzeme bulunamazsa anlaşılır Türkçe mesajlı Error fırlatır.
 */
export async function parseIngredients(text: string): Promise<ParsedIngredient[]> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error('Malzeme bulunamadı — biraz daha açık yazar mısın?');
  }

  const toolInput = await callClaudeForToolInput({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: trimmed }],
    tools: [
      {
        name: SUBMIT_INGREDIENTS_TOOL,
        description: 'Metinden çıkarılan malzeme listesini gönderir (malzeme yoksa boş liste).',
        input_schema: SUBMIT_INGREDIENTS_SCHEMA,
      },
    ],
    tool_choice: { type: 'tool', name: SUBMIT_INGREDIENTS_TOOL },
  });

  const rawIngredients = Array.isArray(toolInput.ingredients) ? toolInput.ingredients : [];
  const batchId = Date.now();
  const items = rawIngredients
    .map((raw, index) => toParsedIngredient(raw, index, batchId))
    .filter((item): item is ParsedIngredient => item !== null);

  if (items.length === 0) {
    throw new Error('Malzeme bulunamadı — biraz daha açık yazar mısın?');
  }

  return items;
}
