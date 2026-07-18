import { callClaudeForToolInput } from './client';

import {
  inventoryNameForLanguage,
  reconcileIngredientsWithInventory,
} from '@/lib/recipes/ingredient-match';
import { EMPTY_PREFERENCES, PREFERENCE_SECTIONS } from '@/types/preferences';
import { INGREDIENT_CATEGORIES, NUTRITION_TAGS } from '@/types/recipe';

import type { InventoryItem } from '@/types/inventory';
import type { RecipePreferences } from '@/types/preferences';
import type {
  IngredientCategory,
  NutritionTag,
  Recipe,
  RecipeDifficulty,
  RecipeIngredient,
} from '@/types/recipe';

const MODEL = 'claude-sonnet-4-6';
const NAMES_MAX_TOKENS = 1536;
const DETAIL_MAX_TOKENS = 2048;
const SUBMIT_RECIPE_NAMES_TOOL = 'submit_recipe_names';
const SUBMIT_RECIPE_DETAIL_TOOL = 'submit_recipe_detail';
const RECIPE_COUNT = 6;
/**
 * İş 1 (RAG'siz akışa taşındı): standart 6 tarifin YANINA 2 fine dining
 * tarifi üretilir — toplam 8. RAG akışıyla (supabase/functions/
 * generate-recipe — CONFIG.fineDiningCount) davranış paritesi: fine dining
 * üretimi başarısız olursa akış BOZULMAZ, 6 standart tarifle devam edilir.
 */
export const FINE_DINING_COUNT = 2;

export type RecipeLayerId = 'ready' | 'closeMatch' | 'fewMissing';

const LAYER_ENUM: RecipeLayerId[] = ['ready', 'closeMatch', 'fewMissing'];

/**
 * Evde her zaman var kabul edilen kiler malzemeleri (bkz. SKILL.md "MVP-16",
 * kullanıcı kararı: geniş kiler). Bu fazdan itibaren bu sabit yalnızca
 * VARSAYILAN/SEED listedir (store/pantryStore.ts bunu tohum olarak kullanır);
 * promptlara artık kullanıcının AKTİF kiler listesi (`activePantryNames`)
 * interpolate edilir — bkz. `RecipePromptContext`.
 */
export const PANTRY_STAPLES = [
  'tuz',
  'karabiber',
  'pul biber',
  'kimyon',
  'kekik',
  'nane',
  'toz kırmızı biber',
  'sıvı yağ',
  'zeytinyağı',
  'tereyağı',
  'un',
  'şeker',
  'su',
  'sirke',
  'salça',
  'soğan',
  'sarımsak',
  'makarna',
  'pirinç',
  'bulgur',
] as const;

/**
 * Prompt üretiminde kullanılan kullanıcı bağlamı: tarif tercihleri
 * (types/preferences.ts) + kullanıcının AKTİF bıraktığı kiler malzemeleri
 * (store/pantryStore.ts'ten gelir; statik `PANTRY_STAPLES` yalnızca
 * varsayılan/seed'dir, promptlara bu AKTİF liste girer).
 */
export interface RecipePromptContext {
  preferences: RecipePreferences;
  activePantryNames: string[];
  /**
   * LLM çıktı dili (BLOK B / B3) — tarif metinleri (ad, malzeme adları,
   * adımlar, chef_tip) bu dilde üretilir; enum alanları (difficulty,
   * category, nutrition_tag) şema gereği SABİT Türkçe değerlerde kalır.
   * Varsayılan Türkçe (eski davranış).
   */
  outputLanguage?: string;
}

/** Bağlam verilmeden çağrılan (eski imzalı) kullanımlar için varsayılan. */
export const DEFAULT_PROMPT_CONTEXT: RecipePromptContext = {
  preferences: EMPTY_PREFERENCES,
  activePantryNames: [...PANTRY_STAPLES],
  outputLanguage: 'Turkish',
};

/** Dil talimatı cümlesi — hem plan hem ortak detay promptuna girer; aynı
 * üretim akışındaki 6 çağrıda aynı olduğu için prefix cache'i bozmaz. */
function buildLanguageSentence(context: RecipePromptContext): string {
  const language = context.outputLanguage ?? 'Turkish';
  return (
    `Serbest metin alanlarını (tarif adı, malzeme adları, adımlar, chef_tip) ${language} dilinde yaz; ` +
    'enum alanları (difficulty, category, nutrition_tag) şemadaki sabit değerlerde kalır. '
  );
}

function normalizePantryNames(activePantryNames: string[]): string[] {
  return activePantryNames.map((name) => name.trim()).filter((name) => name.length > 0);
}

/**
 * Boş olmayan tercih kategorilerini Türkçe tek bir yönlendirme cümlesine
 * çevirir (boşsa boş string). Hem plan hem detay promptuna girer; 6 detay
 * çağrısında da AYNI metin olduğu için prefix cache'i bozmaz.
 */
function buildPreferenceText(preferences: RecipePreferences): string {
  const parts = PREFERENCE_SECTIONS.filter(
    (section) => (preferences[section.id] ?? []).length > 0
  ).map((section) => `${section.title}: ${preferences[section.id].join(', ')}`);
  if (parts.length === 0) {
    return '';
  }
  return `Kullanıcı tercihi — ${parts.join('; ')} — tarifleri bu tercihlere göre şekillendir. `;
}

/**
 * Katman bazlı detay çağrısı varyantları (bkz. SKILL.md "MVP-16"): "ready"
 * tarifler düşük temperature + sıkı kısıtla üretilir (envanter dışına ÇIKAMAZ),
 * eksikli katmanlar giderek daha yaratıcı (Claude API'de temperature 0-1
 * aralığında, varsayılan 1 — "yüksek" = 1.0, diğerleri düşürülür).
 */
interface DetailVariant {
  temperature: number;
  constraint: string;
}

const LAYER_VARIANTS: Record<RecipeLayerId, DetailVariant> = {
  ready: {
    temperature: 0.3,
    constraint:
      'BU TARİF İÇİN ÖZEL KISIT: tarifi SADECE envanter listesindeki ve kiler listesindeki malzemelerle kur. ' +
      'ingredients içindeki HER malzeme in_inventory: true olmalı; envanterde/kilerde olmayan HİÇBİR malzeme ' +
      'ekleme — süsleme/garnitür için bile. Eksik bir bileşen gerekiyorsa onu envanterdeki bir karşılıkla ' +
      'DEĞİŞTİR, tarife ekleme. Ama "hemen yapılabilir" MİNİMAL demek değildir (kullanıcı geri bildirimi): ' +
      'envanterdeki malzemelerden yemeğe gerçekten yakışan olabildiğince çoğunu (envanter elverdiğinde en az ' +
      '4-5 farklı envanter malzemesi) kullanan DOLU, doyurucu bir tarif kur — 2-3 malzemeli sade omlet/makarna ' +
      'ready tarif olarak kabul edilmez.',
  },
  closeMatch: {
    temperature: 0.7,
    constraint:
      'BU TARİF İÇİN ÖZEL KISIT: en fazla 1-2 malzeme envanter/kiler dışından olabilir (in_inventory: false); ' +
      'geri kalan tüm malzemeler envanterden/kilerden gelmeli.',
  },
  fewMissing: {
    temperature: 1.0,
    constraint:
      'BU TARİF İÇİN ÖZEL KISIT: 3-4 malzeme envanter/kiler dışından olabilir (in_inventory: false) — bu payı ' +
      'kullanarak daha yaratıcı, iddialı bir tarif kur; ama envanterdeki malzemeleri de temel olarak kullan.',
  },
};

/** Fine dining detay varyantı — RAG akışının fine dining prompt'uyla aynı ruh
 * (restoran kalitesi, sofistike teknik/sunum); eksik payı fewMissing gibi. */
const FINE_DINING_VARIANT: DetailVariant = {
  temperature: 0.9,
  constraint:
    'BU TARİF İÇİN ÖZEL KISIT: bu bir FINE DINING tarifi — restoran kalitesinde, rafine tekniklerle ve şık ' +
    'tabaklama/sunum önerisiyle kur (adımlarda sunuma da yer ver). Envanterdeki malzemeleri temel al; en fazla ' +
    '3-4 malzeme envanter/kiler dışından olabilir (in_inventory: false). Ev mutfağında uygulanabilir kalsın, ' +
    'ulaşılmaz profesyonel ekipman gerektirme.',
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

/**
 * Tek bir ham malzeme girdisini yeni `RecipeIngredient` şemasına
 * ({name, qty, unit, kcal, category, in_inventory}) doğrular/normalize eder.
 * name/in_inventory zorunludur (yoksa girdi elenir — null); sayısal/enum
 * alanlar ise düzeltilir: geçersiz qty → 1, geçersiz unit → "adet",
 * geçersiz kcal → 0, tanınmayan category → "Diğer" (vision doğrulayıcılarıyla
 * aynı "düşürme yerine düzelt" ilkesi).
 */
function toRecipeIngredient(raw: unknown): RecipeIngredient | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return null;
  }
  if (typeof obj.in_inventory !== 'boolean') {
    return null;
  }
  return {
    name: obj.name,
    qty: typeof obj.qty === 'number' && Number.isFinite(obj.qty) && obj.qty > 0 ? obj.qty : 1,
    unit: typeof obj.unit === 'string' && obj.unit.trim().length > 0 ? obj.unit : 'adet',
    kcal:
      typeof obj.kcal === 'number' && Number.isFinite(obj.kcal) && obj.kcal >= 0 ? obj.kcal : 0,
    category: INGREDIENT_CATEGORIES.includes(obj.category as IngredientCategory)
      ? (obj.category as IngredientCategory)
      : 'Diğer',
    in_inventory: obj.in_inventory,
  };
}

function toNutritionTag(value: unknown): NutritionTag {
  return NUTRITION_TAGS.includes(value as NutritionTag) ? (value as NutritionTag) : 'Dengeli';
}

function toDifficulty(value: unknown): RecipeDifficulty {
  return value === 'Kolay' || value === 'Orta' || value === 'Zor' ? value : 'Orta';
}

/**
 * Prompt'a giden envanter listesi AKTİF dilin adlarıyla gönderilir (İş 3b):
 * model "listedeki ismi AYNEN kullan" kuralına uyduğunda tarif malzemeleri
 * envanterle ve UI'daki gösterim adlarıyla birebir aynı olur. Karşı dil
 * karşılığı henüz üretilmemişse `name`e düşülür.
 */
export function simplifyInventory(inventory: InventoryItem[], language: 'tr' | 'en') {
  return inventory.map((item) => ({
    name: inventoryNameForLanguage(item, language),
    qty: item.qty,
    unit: item.unit,
  }));
}

/**
 * Deterministik emniyet katmanı (İş 3b — modele güvenme): detay döndükten
 * sonra malzemeler envanterle normalize eşleştirmeden geçirilir (bkz.
 * lib/recipes/ingredient-match.ts); eşleşen malzeme in_inventory: true olur
 * ve adı envanterin aktif dildeki adıyla değiştirilir. missing_count ve
 * match_pct düzeltilmiş listeden YENİDEN hesaplanır.
 */
export function applyInventoryReconciliation(
  recipe: Recipe,
  inventory: readonly Pick<InventoryItem, 'name' | 'nameTr' | 'nameEn'>[],
  language: 'tr' | 'en'
): Recipe {
  const ingredients = reconcileIngredientsWithInventory(recipe.ingredients, inventory, language);
  const missingCount = ingredients.filter((ingredient) => !ingredient.in_inventory).length;
  const matchPct =
    ingredients.length === 0
      ? 100
      : clampPercentage(((ingredients.length - missingCount) / ingredients.length) * 100);
  return { ...recipe, ingredients, missing_count: missingCount, match_pct: matchPct };
}

/**
 * Gerçek (deterministik) eksik malzeme SAYISINA göre kesin katman ataması —
 * bkz. SKILL.md "MVP-16" (MVP-15'teki match_pct yüzdesi yerine). Modelin
 * Aşama 1'de verdiği `estimated_layer` SADECE detay çağrısının varyantını
 * (kısıt + temperature) ve ön bölüm yerleşimini seçer; asıl gösterim bu
 * fonksiyonun döndürdüğü değere göre yapılır. Gizleme yok: plan dışı sonuç
 * (5+ eksik) da `fewMissing` olarak rozetiyle gösterilir.
 */
export function assignRecipeLayer(missingCount: number): RecipeLayerId {
  if (missingCount === 0) return 'ready';
  if (missingCount <= 2) return 'closeMatch';
  return 'fewMissing';
}

// ---------------------------------------------------------------------------
// Aşama 1 — isim/plan çağrısı (tek, hızlı; 6 tarif BİRLİKTE planlanır ki
// çeşitlilik garanti olsun — bkz. SKILL.md "MVP-15" kök neden notu; katman
// dağılımı 2/2/2 ZORUNLU — bkz. "MVP-16").
// ---------------------------------------------------------------------------

export interface RecipePlan {
  name: string;
  /** Aşama 2'nin dağılımı için model tahmini — kesin katman DEĞİLDİR. */
  estimatedLayer: RecipeLayerId;
  estimatedMissing: string[];
  /**
   * İş 1: fine dining planı — detay çağrısı FINE_DINING_VARIANT'la yapılır,
   * sonuç tarif `category: 'fine-dining'` alır ve listede ayrı bölümde çıkar.
   */
  fineDining?: boolean;
}

/** Prompt bağlamının dil kodu — Recipe.language alanına yazılır (bkz.
 * src/i18n/recipeI18n.ts; dil değişiminde çeviri gerekip gerekmediği buradan
 * anlaşılır). outputLanguage serbest metin ('Turkish'/'English'). */
function contextLanguageCode(context: RecipePromptContext): 'tr' | 'en' {
  return (context.outputLanguage ?? 'Turkish') === 'English' ? 'en' : 'tr';
}

function buildPlanSystemPrompt(context: RecipePromptContext): string {
  const pantryNames = normalizePantryNames(context.activePantryNames);
  const pantrySentence =
    pantryNames.length === 0
      ? 'Kiler listesi BOŞ: hiçbir malzeme otomatik olarak evde var sayılmaz, yalnızca envanter listesine güven. '
      : `Kiler malzemeleri her zaman evde var kabul edilir ve eksik SAYILMAZ: ${pantryNames.join(', ')}. `;
  return (
    `Verilen envanter listesine göre TAM ${RECIPE_COUNT} adet tarif İSMİ ve kısa bir plan öner ` +
    '(henüz tam tarif detayı değil — malzeme listesi, adımlar, kalori vb. İSTEME, sadece isim + tahmini bilgi). ' +
    pantrySentence +
    buildLanguageSentence(context) +
    buildPreferenceText(context.preferences) +
    'Kurallar: ' +
  `- Dağılım ZORUNLU: TAM 2 tarif "ready" (SADECE envanter + kiler malzemeleriyle, HİÇ eksiksiz yapılabilir), ` +
  'TAM 2 tarif "closeMatch" (1-2 malzeme eksik), TAM 2 tarif "fewMissing" (3-4 malzeme eksik — daha yaratıcı/iddialı ' +
  'tarifler için market payı). estimated_layer alanına bu hedefi yaz. ' +
  '- "ready" tarifler DOLU olsun: envanterdeki malzemelerden yemeğe yakışan olabildiğince çoğunu birleştiren ' +
  'doyurucu tarifler planla (tek tavada zengin yemekler, fırın yemekleri gibi); 2-3 malzemeli minimal formatlar ' +
  '(sade omlet, sade makarna) SON ÇAREDİR — yalnızca envanter gerçekten dar olduğunda kullan. 2 "ready" tarif ' +
  'üretmek ZORUNLUDUR. ' +
  `- ${RECIPE_COUNT} tarifi BİRLİKTE, TEK seferde planla ki ÇEŞİTLİ olsunlar: aynı ana malzemeyi veya aynı ` +
  'pişirme tekniğini (örn. hepsi kavurma, hepsi fırın) tekrar tekrar kullanma; farklı öğün tiplerine yay ' +
  '(kahvaltı, ana yemek, salata, çorba, atıştırmalık gibi). ' +
  '- Türk mutfağına öncelik ver ama zorunlu tutma. ' +
  '- Tarif isimleri doğru olsun: bilinen bir yemeğin adını (örn. Menemen, Karnıyarık) yalnızca o yemeğin ' +
  'tanımlayıcı malzemeleri envanterde gerçekten varsa kullan (Menemen için domates ve biber şart). ' +
  'Tanımlayıcı malzeme eksikse farklı ve doğru bir isim ver. ' +
    '- estimated_missing: bu tarif için envanterde/kilerde muhtemelen olmayan malzemelerin kaba bir listesi ' +
    '("ready" tariflerde BOŞ olmalı).'
  );
}

const RECIPE_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    estimated_layer: { type: 'string', enum: LAYER_ENUM },
    estimated_missing: { type: 'array', items: { type: 'string' } },
  },
  required: ['name', 'estimated_layer', 'estimated_missing'],
};

const SUBMIT_RECIPE_NAMES_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      minItems: RECIPE_COUNT,
      maxItems: RECIPE_COUNT,
      items: RECIPE_PLAN_SCHEMA,
    },
  },
  required: ['recipes'],
};

function toRecipePlan(raw: unknown): RecipePlan | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || obj.name.trim().length === 0) {
    return null;
  }
  const estimatedLayer: RecipeLayerId = LAYER_ENUM.includes(obj.estimated_layer as RecipeLayerId)
    ? (obj.estimated_layer as RecipeLayerId)
    : 'closeMatch';
  return {
    name: obj.name,
    estimatedLayer,
    estimatedMissing: isStringArray(obj.estimated_missing) ? obj.estimated_missing : [],
  };
}

/**
 * Aşama 1: TEK bir Claude çağrısıyla 6 tarifin ismini + kaba planını üretir
 * (2 ready + 2 closeMatch + 2 fewMissing). Çıktı kısa olduğu için hızlıdır;
 * 6 tarif BİRLİKTE planlandığından (MVP-14'teki 3 bağımsız katman çağrısının
 * aksine) model çeşitliliği garanti edebilir — bkz. SKILL.md "MVP-15"/"MVP-16".
 * `context` tercihleri ve AKTİF kiler listesini prompta taşır.
 */
export async function generateRecipeNames(
  inventory: InventoryItem[],
  context: RecipePromptContext = DEFAULT_PROMPT_CONTEXT
): Promise<RecipePlan[]> {
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  const simplifiedInventory = simplifyInventory(inventory, contextLanguageCode(context));

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: NAMES_MAX_TOKENS,
      system: [{ type: 'text', text: buildPlanSystemPrompt(context) }],
      messages: [{ role: 'user', content: `Envanter: ${JSON.stringify(simplifiedInventory)}` }],
      tools: [
        {
          name: SUBMIT_RECIPE_NAMES_TOOL,
          description: `Envantere göre planlanan ${RECIPE_COUNT} tarifin ismini ve kaba planını gönderir.`,
          input_schema: SUBMIT_RECIPE_NAMES_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_RECIPE_NAMES_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new RecipeGenerationError(`Claude API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  const rawPlans = toolInput.recipes;
  if (!Array.isArray(rawPlans)) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  const plans = rawPlans.map(toRecipePlan).filter((plan): plan is RecipePlan => plan !== null);
  if (plans.length === 0) {
    throw new RecipeGenerationError('Tarif planı üretilemedi, tekrar deneyin');
  }

  return plans;
}

// ---------------------------------------------------------------------------
// Aşama 2 — tek tarifin tam detayı (6 paralel çağrıdan biri; katman bazlı
// kısıt + temperature varyantıyla, bkz. LAYER_VARIANTS).
// ---------------------------------------------------------------------------

/**
 * Aşama 2 çağrılarının ORTAK sistem talimatını üretir — altı çağrıda da
 * BİREBİR aynı İLK blok olmalı ki `cache_control: ephemeral` önbelleği tutsun
 * (katman bazlı varyant kısıtı cache'siz İKİNCİ blok olarak eklenir — prefix
 * cache bozulmaz, bkz. SKILL.md "MVP-16"). Tercih metni ve AKTİF kiler
 * listesi bu ORTAK bloğun İÇİNE interpolate edilir: aynı üretim akışındaki 6
 * çağrıda `context` aynı olduğu için metin birebir aynı kalır, cache bozulmaz.
 * Tarifin ADI Aşama 1'de zaten belirlendiği için şema `name` İSTEMEZ;
 * match_pct ve missing_count da İSTEMEZ — ikisi de
 * `ingredients[].in_inventory`'den KODDA deterministik hesaplanır (bkz.
 * `assignRecipeLayer`, `toRecipeDetail`).
 */
function buildCommonDetailSystemPrompt(context: RecipePromptContext): string {
  const pantryNames = normalizePantryNames(context.activePantryNames);
  const pantrySentence =
    pantryNames.length === 0
      ? 'Kiler listesi BOŞ: hiçbir malzeme otomatik olarak evde var sayılmaz, in_inventory işaretini ' +
        'yalnızca envanter listesine göre yap. '
      : 'Kiler malzemeleri her zaman evde var kabul edilir ve DAİMA in_inventory: true sayılır: ' +
        `${pantryNames.join(', ')}. `;
  return (
    'Sana verilen tarif adına ve envanter listesine göre TEK bir tarifin tam detayını üret. ' +
    buildLanguageSentence(context) +
    buildPreferenceText(context.preferences) +
    'Kurallar: ' +
    '- Tarifi verilen isme sadık kal: adın ima ettiği tanımlayıcı malzemeleri (örn. Menemen için domates ve ' +
    'biber) mutlaka dahil et, adla tutarsız bir tarif üretme. ' +
    '- ingredients: bu tarif için GERÇEKTEN gereken tüm malzemeleri listele. Her malzeme için: qty + unit = ' +
    'tarifin VARSAYILAN kişi sayısı (servings) için miktar (unit serbest Türkçe birimdir: "g", "su bardağı", ' +
    '"yk", "adet" gibi); kcal = o malzemenin varsayılan porsiyondaki TOPLAM kalorisi; category = sabit ' +
    'listeden en uygun market kategorisi; in_inventory işaretlemesini sana verilen envanter listesine göre yap. ' +
    '- Envanter listesinde OLAN bir malzemeyi kullanırken adını listede yazıldığı şekliyle AYNEN kullan; ' +
    'eş anlamlısını veya farklı bir adını ÜRETME (örn. listede "Chili Flakes" varsa "Red Pepper Flakes" yazma, ' +
    'listede "Pickled Jalapenos" varsa "Mexican Pickle Peppers" yazma). ' +
    pantrySentence +
    '- Kalori tutarlılığı: tarifin kcal alanı KİŞİ BAŞI kaloridir; malzemelerin kcal değerlerinin TOPLAMI ' +
    'yaklaşık olarak kcal × servings civarında olmalı (birebir eşitlik şart değil, belirgin tutarsızlık olmasın). ' +
    '- Süre ve kalori bilgisi gerçekçi olsun, abartılı/tutarsız değerler verme. ' +
    '- Zorluk derecesini gerçekçi ver: çoğu ev yemeği "Kolay" veya "Orta" olmalı, "Zor" nadiren kullanılsın. ' +
    '- nutrition_tag: tarifin beslenme profilini en iyi anlatan TEK etiketi sabit listeden seç. ' +
    '- chef_tip: tarife özel, kısa ve pratik bir şef önerisi/tüyosu ver (örn. bir malzeme ikamesi, pişirme ipucu). ' +
    '- image_prompt_en: İNGİLİZCE, iki kısımdan oluşan kısa bir görsel tanımı: yemeğin tanımı + tek cümlelik ' +
    'tabaklama betimlemesi (örn. "Turkish menemen, scrambled eggs cooked with tomatoes and green peppers. ' +
    'Served bubbling in a small black skillet with a sprig of parsley on top."). Türkçe yazma; marka adı kullanma.'
  );
}

const RECIPE_DETAIL_SCHEMA = {
  type: 'object',
  properties: {
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
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          qty: {
            type: 'number',
            description: 'Tarifin varsayılan kişi sayısı (servings) için miktar',
          },
          unit: {
            type: 'string',
            description: 'Serbest Türkçe birim: "g", "su bardağı", "yk", "adet", "kutu"...',
          },
          kcal: {
            type: 'number',
            description: 'Bu malzemenin varsayılan porsiyondaki TOPLAM kalorisi',
          },
          category: {
            type: 'string',
            enum: [...INGREDIENT_CATEGORIES],
            description: 'Market sepeti gruplaması için sabit listeden kategori',
          },
          in_inventory: { type: 'boolean' },
        },
        required: ['name', 'qty', 'unit', 'kcal', 'category', 'in_inventory'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    chef_tip: { type: 'string' },
    nutrition_tag: {
      type: 'string',
      enum: [...NUTRITION_TAGS],
      description: 'Tarifin beslenme profilini en iyi anlatan tek etiket',
    },
    image_prompt_en: {
      type: 'string',
      description:
        'İngilizce kısa yemek tanımı + tek cümlelik tabaklama betimlemesi (görsel üretim promptu için)',
    },
  },
  required: [
    'emoji',
    'kcal',
    'servings',
    'time_min',
    'difficulty',
    'macros',
    'ingredients',
    'steps',
    'chef_tip',
    'nutrition_tag',
    'image_prompt_en',
  ],
};

/**
 * Tool-use şeması modeli zaten doğru tip/alan üretmeye zorladığı için burada
 * tam yeniden doğrulama yerine minimal bir güvenlik kontrolü yeterli. `name`
 * Aşama 1'den (parametre olarak) gelir — modelin çıktısından ALINMAZ, ki
 * kart başlığı planlama anından itibaren tutarlı kalsın.
 */
function toRecipeDetail(name: string, raw: unknown, language: 'tr' | 'en'): Recipe | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  const macros = obj.macros as Record<string, unknown> | undefined;

  if (
    typeof obj.kcal !== 'number' ||
    typeof obj.servings !== 'number' ||
    typeof obj.time_min !== 'number' ||
    typeof obj.chef_tip !== 'string' ||
    !Array.isArray(obj.ingredients) ||
    !isStringArray(obj.steps) ||
    typeof macros !== 'object' ||
    macros === null ||
    typeof macros.protein !== 'number' ||
    typeof macros.karb !== 'number' ||
    typeof macros.yag !== 'number'
  ) {
    return null;
  }

  // Geçersiz malzeme girdileri (isimsiz / in_inventory'siz) elenir; kalan
  // alanlar toRecipeIngredient içinde düzeltilir. Hiç geçerli malzeme yoksa
  // tarif reddedilir.
  const ingredients = obj.ingredients
    .map(toRecipeIngredient)
    .filter((entry): entry is RecipeIngredient => entry !== null);
  if (ingredients.length === 0) {
    return null;
  }

  const missingCount = ingredients.filter((entry) => !entry.in_inventory).length;
  // match_pct KODDA hesaplanır — modele SORULMAZ (bkz. SKILL.md "MVP-15");
  // MVP-16'dan beri katmanlama/sıralama missing_count ile yapılır, match_pct
  // sadece bilgi amaçlı (eski cache + detay ekranı uyumu için) tutulur.
  const matchPct =
    ingredients.length === 0
      ? 100
      : clampPercentage(((ingredients.length - missingCount) / ingredients.length) * 100);

  return {
    id: generateId(),
    name,
    emoji: typeof obj.emoji === 'string' && obj.emoji.length > 0 ? obj.emoji : '🍽️',
    kcal: obj.kcal,
    servings: obj.servings,
    time_min: obj.time_min,
    difficulty: toDifficulty(obj.difficulty),
    macros: { protein: macros.protein, karb: macros.karb, yag: macros.yag },
    match_pct: matchPct,
    ingredients,
    missing_count: missingCount,
    steps: obj.steps,
    chef_tip: obj.chef_tip,
    nutrition_tag: toNutritionTag(obj.nutrition_tag),
    language,
    image_prompt_en:
      typeof obj.image_prompt_en === 'string' && obj.image_prompt_en.trim().length > 0
        ? obj.image_prompt_en
        : undefined,
  };
}

export interface RecipeDetail {
  recipe: Recipe;
  /** Deterministik eksik malzeme sayısına göre kesin katman (bkz. `assignRecipeLayer`). */
  layer: RecipeLayerId;
}

async function callRecipeDetail(
  name: string,
  variant: DetailVariant,
  userContent: string,
  commonSystemPrompt: string,
  language: 'tr' | 'en',
  inventory: InventoryItem[]
): Promise<Recipe> {
  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: DETAIL_MAX_TOKENS,
      // İlk blok 8 çağrıda birebir aynı (prefix cache tutar; tercih + aktif
      // kiler metni de bu bloğun içinde ve 8 çağrıda aynı); katman/fine-dining
      // kısıtı cache'siz ikinci blok — bkz. buildCommonDetailSystemPrompt yorumu.
      system: [
        { type: 'text', text: commonSystemPrompt, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: variant.constraint },
      ],
      temperature: variant.temperature,
      messages: [{ role: 'user', content: userContent }],
      tools: [
        {
          name: SUBMIT_RECIPE_DETAIL_TOOL,
          description: 'Tek bir tarifin tam detayını (malzemeler, adımlar, besin değerleri) gönderir.',
          input_schema: RECIPE_DETAIL_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_RECIPE_DETAIL_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new RecipeGenerationError(`"${name}" için Claude API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  const recipe = toRecipeDetail(name, toolInput, language);
  if (!recipe) {
    throw new RecipeGenerationError(`"${name}" tarifi ayrıştırılamadı, tekrar deneyin`);
  }
  // Emniyet katmanı BURADA (ready-retry kararından ÖNCE) uygulanır: modelin
  // eş anlamlı adla "eksik" sanıp işaretlediği ama aslında envanterde olan
  // malzemeler düzeltilir — sahte eksik, gereksiz retry tetiklemez.
  return applyInventoryReconciliation(recipe, inventory, language);
}

/**
 * Aşama 2: TEK bir tarifin tam detayını üretir (isim zaten biliniyor, bkz.
 * `generateRecipeNames`). `layerTarget` detay çağrısının varyantını seçer
 * (katman kısıtı + temperature, bkz. `LAYER_VARIANTS`). "ready" hedefli bir
 * tarif buna rağmen eksik malzemeyle dönerse 1 kez düzeltme çağrısı yapılır
 * (bkz. SKILL.md "MVP-16"); o da eksikli dönerse olduğu gibi kabul edilir —
 * kesin katman yine eksik sayısından hesaplanır (kendi kendini düzeltme).
 */
export async function generateRecipeDetail(
  name: string,
  inventory: InventoryItem[],
  layerTarget: RecipeLayerId = 'closeMatch',
  context: RecipePromptContext = DEFAULT_PROMPT_CONTEXT
): Promise<RecipeDetail> {
  const language = contextLanguageCode(context);
  const simplifiedInventory = simplifyInventory(inventory, language);
  const baseContent = `Tarif adı: "${name}"\nEnvanter: ${JSON.stringify(simplifiedInventory)}`;
  // Aynı üretim akışındaki 8 paralel çağrıda (ve ready-retry'da) BİREBİR aynı
  // metin — prefix cache bunun üzerinden tutar.
  const commonSystemPrompt = buildCommonDetailSystemPrompt(context);

  let recipe = await callRecipeDetail(
    name,
    LAYER_VARIANTS[layerTarget],
    baseContent,
    commonSystemPrompt,
    language,
    inventory
  );

  if (layerTarget === 'ready' && recipe.missing_count > 0) {
    const missingNames = recipe.ingredients
      .filter((ingredient) => !ingredient.in_inventory)
      .map((ingredient) => ingredient.name)
      .join(', ');
    console.log(`[recipe] "${name}" ready hedefliydi ama ${recipe.missing_count} eksikle döndü (${missingNames}) — düzeltme deneniyor`);
    try {
      recipe = await callRecipeDetail(
        name,
        LAYER_VARIANTS[layerTarget],
        `${baseContent}\n\nÖnceki denemede şu malzemeler envanterde/kilerde yoktu: ${missingNames}. ` +
          'Tarifi bu malzemeler OLMADAN yeniden kur veya envanterdeki karşılıklarıyla değiştir — ' +
          'HER malzeme in_inventory: true olmalı.',
        commonSystemPrompt,
        language,
        inventory
      );
    } catch {
      // Düzeltme çağrısı başarısız olursa ilk sonuç kullanılır — eksik
      // sayısına göre alışveriş bölümüne düşer, tarif kaybolmaz.
    }
  }

  return { recipe, layer: assignRecipeLayer(recipe.missing_count) };
}

// ---------------------------------------------------------------------------
// İş 1 — fine dining (RAG'siz akış): 2 isim planı + FINE_DINING_VARIANT'lı
// detay çağrıları; sonuç tarifler `category: 'fine-dining'` alır ve listede
// ayrı bölümde gösterilir (bkz. components/recipes/RecipeList.tsx).
// ---------------------------------------------------------------------------

const SUBMIT_FINE_DINING_NAMES_SCHEMA = {
  type: 'object',
  properties: {
    recipes: {
      type: 'array',
      minItems: FINE_DINING_COUNT,
      maxItems: FINE_DINING_COUNT,
      items: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
    },
  },
  required: ['recipes'],
};

function buildFineDiningPlanSystemPrompt(context: RecipePromptContext): string {
  const pantryNames = normalizePantryNames(context.activePantryNames);
  const pantrySentence =
    pantryNames.length === 0
      ? ''
      : `Kiler malzemeleri her zaman evde var kabul edilir: ${pantryNames.join(', ')}. `;
  return (
    `Verilen envanter listesine göre TAM ${FINE_DINING_COUNT} adet FINE DINING tarif İSMİ öner ` +
    '(henüz tam tarif detayı değil, sadece isim). ' +
    pantrySentence +
    buildLanguageSentence(context) +
    buildPreferenceText(context.preferences) +
    'Kurallar: ' +
    '- Restoran kalitesinde, sofistike ama ev mutfağında uygulanabilir tarifler olsun; envanterdeki ' +
    'malzemeleri temel alsın (birkaç eksik malzeme kabul edilebilir). ' +
    '- İki tarif birbirinden FARKLI olsun: aynı ana malzemeyi veya tekniği tekrarlama. ' +
    '- İsimler iddialı ve isabetli olsun; adın ima ettiği tanımlayıcı malzemeler envantere/kilere uysun.'
  );
}

/** Fine dining Aşama 1: TEK çağrıyla 2 fine dining tarif ismi. */
export async function generateFineDiningNames(
  inventory: InventoryItem[],
  context: RecipePromptContext = DEFAULT_PROMPT_CONTEXT
): Promise<RecipePlan[]> {
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: NAMES_MAX_TOKENS,
      system: [{ type: 'text', text: buildFineDiningPlanSystemPrompt(context) }],
      messages: [
        {
          role: 'user',
          content: `Envanter: ${JSON.stringify(simplifyInventory(inventory, contextLanguageCode(context)))}`,
        },
      ],
      tools: [
        {
          name: SUBMIT_RECIPE_NAMES_TOOL,
          description: `Envantere göre planlanan ${FINE_DINING_COUNT} fine dining tarifinin ismini gönderir.`,
          input_schema: SUBMIT_FINE_DINING_NAMES_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: SUBMIT_RECIPE_NAMES_TOOL },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
    throw new RecipeGenerationError(`Claude API çağrısı başarısız oldu: ${message}`, {
      cause: error,
    });
  }

  const rawPlans = toolInput.recipes;
  if (!Array.isArray(rawPlans)) {
    throw new RecipeGenerationError('Claude yanıtı ayrıştırılamadı, tekrar deneyin');
  }

  const plans = rawPlans
    .map((raw): RecipePlan | null => {
      if (typeof raw !== 'object' || raw === null) return null;
      const name = (raw as Record<string, unknown>).name;
      if (typeof name !== 'string' || name.trim().length === 0) return null;
      // estimatedLayer yalnızca ÖN yerleşim içindir — fine dining slotları
      // kendi bölümünde gösterilir, kesin katman detaydan hesaplanır.
      return { name, estimatedLayer: 'fewMissing', estimatedMissing: [], fineDining: true };
    })
    .filter((plan): plan is RecipePlan => plan !== null);

  if (plans.length === 0) {
    throw new RecipeGenerationError('Fine dining planı üretilemedi, tekrar deneyin');
  }
  return plans;
}

/** Fine dining Aşama 2: tek tarifin tam detayı (FINE_DINING_VARIANT ile). */
export async function generateFineDiningDetail(
  name: string,
  inventory: InventoryItem[],
  context: RecipePromptContext = DEFAULT_PROMPT_CONTEXT
): Promise<RecipeDetail> {
  const language = contextLanguageCode(context);
  const baseContent = `Tarif adı: "${name}"\nEnvanter: ${JSON.stringify(simplifyInventory(inventory, language))}`;
  const recipe = await callRecipeDetail(
    name,
    FINE_DINING_VARIANT,
    baseContent,
    buildCommonDetailSystemPrompt(context),
    language,
    inventory
  );
  const fineDiningRecipe: Recipe = { ...recipe, category: 'fine-dining' };
  return { recipe: fineDiningRecipe, layer: assignRecipeLayer(fineDiningRecipe.missing_count) };
}

/**
 * Birden fazla kaynaktan (ör. yeniden denenen tarifler) gelen tarif
 * listelerini isim bazında (normalize edilmiş: trim + lowercase)
 * tekilleştirir. Aynı isim birden çok kez gelirse eksik malzeme sayısı
 * DÜŞÜK olan tutulur. Sonuç missing_count'a göre artan sırada döner
 * (eksiksizler üstte — bkz. SKILL.md "MVP-16" eksik-bazlı katmanlama).
 */
export function mergeRecipeLayers(recipeLists: Recipe[][]): Recipe[] {
  const byName = new Map<string, Recipe>();
  for (const recipes of recipeLists) {
    for (const recipe of recipes) {
      const key = recipe.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || recipe.missing_count < existing.missing_count) {
        byName.set(key, recipe);
      }
    }
  }
  return Array.from(byName.values()).sort((a, b) => a.missing_count - b.missing_count);
}

export interface RecipeDetailResult {
  planIndex: number;
  name: string;
  status: 'done' | 'error';
  recipe?: Recipe;
  layer?: RecipeLayerId;
  error?: RecipeGenerationError;
}

export interface GenerateRecipesTwoPhaseOptions {
  /** Tarif tercihleri — boş kategoriler yok sayılır (bkz. types/preferences.ts). */
  preferences: RecipePreferences;
  /**
   * Kullanıcının AKTİF kiler malzemeleri (store/pantryStore.ts) — promptlarda
   * statik `PANTRY_STAPLES` yerine bu liste kullanılır.
   */
  activePantryNames: string[];
  /** LLM çıktı dili (bkz. RecipePromptContext.outputLanguage). */
  outputLanguage?: string;
  onPlanReady?: (plans: RecipePlan[]) => void;
  onDetailSettled?: (result: RecipeDetailResult) => void;
}

/**
 * İki aşamalı tarif üretimi (bkz. SKILL.md "MVP-15"/"MVP-16"): önce TEK
 * çağrıda 6 tarif ismi/planı (2 ready + 2 closeMatch + 2 fewMissing;
 * çeşitlilik garantili, çünkü 6'sı birlikte planlanıyor), sonra 6 tarifin
 * detayı BAĞIMSIZ paralel çağrılarla üretilir (`Promise.allSettled` — bir
 * tarif başarısız olursa diğerleri ETKİLENMEZ); her detay çağrısı planın
 * `estimatedLayer`'ına göre kendi varyantını (kısıt + temperature) kullanır.
 * `onPlanReady` isimler gelir gelmez, `onDetailSettled` her detay
 * TAMAMLANDIĞI ANDA (diğerlerini beklemeden) çağrılır — bu, çağıran tarafın
 * kartları tek tek doldurabilmesinin (kademeli/canlı gösterim) temeli.
 * `options.preferences` + `options.activePantryNames` her iki aşamanın
 * promptuna girer (bkz. `RecipePromptContext`, services/contracts.ts).
 */
export async function generateRecipesTwoPhase(
  inventory: InventoryItem[],
  options: GenerateRecipesTwoPhaseOptions
): Promise<Recipe[]> {
  const tStart = performance.now();
  const context: RecipePromptContext = {
    preferences: options.preferences,
    activePantryNames: options.activePantryNames,
    outputLanguage: options.outputLanguage,
  };

  // Standart 6'lı plan + 2 fine dining ismi PARALEL istenir (İş 1). Fine
  // dining planı başarısız olursa akış BOZULMAZ — 6 standart tarifle devam
  // edilir (RAG akışının degrade davranışıyla parite).
  const [standardPlans, finePlans] = await Promise.all([
    generateRecipeNames(inventory, context),
    generateFineDiningNames(inventory, context).catch((error): RecipePlan[] => {
      console.warn('[recipe] fine dining planı üretilemedi — 6 standart tarifle devam:', error);
      return [];
    }),
  ]);
  const plans = [...standardPlans, ...finePlans];
  console.log(
    `[PERF][recipe] aşama-1 (isim/plan): ${(performance.now() - tStart).toFixed(0)}ms, ${plans.length} tarif planlandı (${finePlans.length} fine dining)`
  );
  options.onPlanReady?.(plans);

  const tDetailStart = performance.now();
  const settled = await Promise.allSettled(
    plans.map(async (plan, planIndex): Promise<RecipeDetailResult> => {
      try {
        const { recipe, layer } = plan.fineDining
          ? await generateFineDiningDetail(plan.name, inventory, context)
          : await generateRecipeDetail(plan.name, inventory, plan.estimatedLayer, context);
        const result: RecipeDetailResult = { planIndex, name: plan.name, status: 'done', recipe, layer };
        options.onDetailSettled?.(result);
        return result;
      } catch (error) {
        const err =
          error instanceof RecipeGenerationError
            ? error
            : new RecipeGenerationError('Bilinmeyen bir hata oluştu', { cause: error });
        const result: RecipeDetailResult = { planIndex, name: plan.name, status: 'error', error: err };
        options.onDetailSettled?.(result);
        return result;
      }
    })
  );

  console.log(
    `[PERF][recipe] aşama-2 (${plans.length} paralel detay) TOPLAM (wall-clock): ${(performance.now() - tDetailStart).toFixed(0)}ms`
  );
  console.log(
    `[PERF][recipe] TOPLAM (aşama-1 + aşama-2, wall-clock): ${(performance.now() - tStart).toFixed(0)}ms`
  );

  const doneRecipes = settled
    .map((entry) => (entry.status === 'fulfilled' ? entry.value : null))
    .filter((result): result is RecipeDetailResult => result !== null)
    .filter((result) => result.status === 'done' && result.recipe)
    .map((result) => result.recipe as Recipe);

  const merged = mergeRecipeLayers([doneRecipes]);
  if (merged.length === 0) {
    throw new RecipeGenerationError('Tarifler üretilemedi, tekrar deneyin');
  }

  return merged;
}
