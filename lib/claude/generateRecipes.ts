import { callClaudeForToolInput } from './client';

import type { InventoryItem } from '@/types/inventory';
import type { Recipe, RecipeDifficulty, RecipeIngredient } from '@/types/recipe';

const MODEL = 'claude-sonnet-4-6';
const NAMES_MAX_TOKENS = 1536;
const DETAIL_MAX_TOKENS = 2048;
const SUBMIT_RECIPE_NAMES_TOOL = 'submit_recipe_names';
const SUBMIT_RECIPE_DETAIL_TOOL = 'submit_recipe_detail';
const RECIPE_COUNT = 6;

export type RecipeLayerId = 'ready' | 'closeMatch' | 'fewMissing';

const LAYER_ENUM: RecipeLayerId[] = ['ready', 'closeMatch', 'fewMissing'];

/**
 * Evde her zaman var kabul edilen kiler malzemeleri (bkz. SKILL.md "MVP-16",
 * kullanıcı kararı: geniş kiler). Bu listedekiler tariflerde her zaman
 * `in_inventory: true` sayılır, eksik olarak gösterilmez. Promptlara tek
 * kaynaktan interpolate edilir.
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

const PANTRY_TEXT = PANTRY_STAPLES.join(', ');

/**
 * Katman bazlı detay çağrısı varyantları (bkz. SKILL.md "MVP-16"): "ready"
 * tarifler düşük temperature + sıkı kısıtla üretilir (envanter dışına ÇIKAMAZ),
 * eksikli katmanlar giderek daha yaratıcı (Claude API'de temperature 0-1
 * aralığında, varsayılan 1 — "yüksek" = 1.0, diğerleri düşürülür).
 */
const LAYER_VARIANTS: Record<RecipeLayerId, { temperature: number; constraint: string }> = {
  ready: {
    temperature: 0.3,
    constraint:
      'BU TARİF İÇİN ÖZEL KISIT: tarifi SADECE envanter listesindeki ve kiler listesindeki malzemelerle kur. ' +
      'ingredients içindeki HER malzeme in_inventory: true olmalı; envanterde/kilerde olmayan HİÇBİR malzeme ' +
      'ekleme — süsleme/garnitür için bile. Envantere sığmayan bir fikir varsa tarifi basitleştir.',
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

function simplifyInventory(inventory: InventoryItem[]) {
  return inventory.map((item) => ({ name: item.name, qty: item.qty, unit: item.unit }));
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
}

const PLAN_SYSTEM_PROMPT =
  `Verilen envanter listesine göre TAM ${RECIPE_COUNT} adet tarif İSMİ ve kısa bir plan öner ` +
  '(henüz tam tarif detayı değil — malzeme listesi, adımlar, kalori vb. İSTEME, sadece isim + tahmini bilgi). ' +
  `Kiler malzemeleri her zaman evde var kabul edilir ve eksik SAYILMAZ: ${PANTRY_TEXT}. ` +
  'Kurallar: ' +
  `- Dağılım ZORUNLU: TAM 2 tarif "ready" (SADECE envanter + kiler malzemeleriyle, HİÇ eksiksiz yapılabilir), ` +
  'TAM 2 tarif "closeMatch" (1-2 malzeme eksik), TAM 2 tarif "fewMissing" (3-4 malzeme eksik — daha yaratıcı/iddialı ' +
  'tarifler için market payı). estimated_layer alanına bu hedefi yaz. ' +
  '- "ready" için envantere sığan bir tarif bulmakta zorlanırsan en basit formatlara in (omlet/sahanda yumurta, ' +
  'makarna, pilav, salata gibi) — 2 "ready" tarif üretmek ZORUNLUDUR. ' +
  `- ${RECIPE_COUNT} tarifi BİRLİKTE, TEK seferde planla ki ÇEŞİTLİ olsunlar: aynı ana malzemeyi veya aynı ` +
  'pişirme tekniğini (örn. hepsi kavurma, hepsi fırın) tekrar tekrar kullanma; farklı öğün tiplerine yay ' +
  '(kahvaltı, ana yemek, salata, çorba, atıştırmalık gibi). ' +
  '- Türk mutfağına öncelik ver ama zorunlu tutma. ' +
  '- Tarif isimleri doğru olsun: bilinen bir yemeğin adını (örn. Menemen, Karnıyarık) yalnızca o yemeğin ' +
  'tanımlayıcı malzemeleri envanterde gerçekten varsa kullan (Menemen için domates ve biber şart). ' +
  'Tanımlayıcı malzeme eksikse farklı ve doğru bir isim ver. ' +
  '- estimated_missing: bu tarif için envanterde/kilerde muhtemelen olmayan malzemelerin kaba bir listesi ' +
  '("ready" tariflerde BOŞ olmalı).';

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
 */
export async function generateRecipeNames(inventory: InventoryItem[]): Promise<RecipePlan[]> {
  if (inventory.length === 0) {
    throw new RecipeGenerationError('Tarif önermek için envanterde ürün olmalı');
  }

  const simplifiedInventory = simplifyInventory(inventory);

  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: NAMES_MAX_TOKENS,
      system: [{ type: 'text', text: PLAN_SYSTEM_PROMPT }],
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
 * Aşama 2 çağrılarının ORTAK sistem talimatı — altı çağrıda da BİREBİR aynı
 * İLK blok olmalı ki `cache_control: ephemeral` önbelleği tutsun (katman
 * bazlı varyant kısıtı cache'siz İKİNCİ blok olarak eklenir — prefix cache
 * bozulmaz, bkz. SKILL.md "MVP-16"). Tarifin ADI Aşama 1'de zaten
 * belirlendiği için bu şema `name` İSTEMEZ; match_pct ve missing_count da
 * İSTEMEZ — ikisi de `ingredients[].in_inventory`'den KODDA deterministik
 * hesaplanır (bkz. `assignRecipeLayer`, `toRecipeDetail`).
 */
const COMMON_DETAIL_SYSTEM_PROMPT =
  'Sana verilen tarif adına ve envanter listesine göre TEK bir tarifin tam detayını üret. ' +
  'Kurallar: ' +
  '- Tarifi verilen isme sadık kal: adın ima ettiği tanımlayıcı malzemeleri (örn. Menemen için domates ve ' +
  'biber) mutlaka dahil et, adla tutarsız bir tarif üretme. ' +
  '- ingredients: bu tarif için GERÇEKTEN gereken tüm malzemeleri listele; her malzeme için in_inventory ' +
  'işaretlemesini sana verilen envanter listesine göre yap. Kiler malzemeleri her zaman evde var kabul edilir ' +
  `ve DAİMA in_inventory: true sayılır: ${PANTRY_TEXT}. ` +
  '- Süre ve kalori bilgisi gerçekçi olsun, abartılı/tutarsız değerler verme. ' +
  '- Zorluk derecesini gerçekçi ver: çoğu ev yemeği "Kolay" veya "Orta" olmalı, "Zor" nadiren kullanılsın. ' +
  '- chef_tip: tarife özel, kısa ve pratik bir şef önerisi/tüyosu ver (örn. bir malzeme ikamesi, pişirme ipucu). ' +
  '- image_prompt_en: İNGİLİZCE, iki kısımdan oluşan kısa bir görsel tanımı: yemeğin tanımı + tek cümlelik ' +
  'tabaklama betimlemesi (örn. "Turkish menemen, scrambled eggs cooked with tomatoes and green peppers. ' +
  'Served bubbling in a small black skillet with a sprig of parsley on top."). Türkçe yazma; marka adı kullanma.';

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
          in_inventory: { type: 'boolean' },
        },
        required: ['name', 'in_inventory'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    chef_tip: { type: 'string' },
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
    'image_prompt_en',
  ],
};

/**
 * Tool-use şeması modeli zaten doğru tip/alan üretmeye zorladığı için burada
 * tam yeniden doğrulama yerine minimal bir güvenlik kontrolü yeterli. `name`
 * Aşama 1'den (parametre olarak) gelir — modelin çıktısından ALINMAZ, ki
 * kart başlığı planlama anından itibaren tutarlı kalsın.
 */
function toRecipeDetail(name: string, raw: unknown): Recipe | null {
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
  layerTarget: RecipeLayerId,
  userContent: string
): Promise<Recipe> {
  let toolInput: Record<string, unknown>;
  try {
    toolInput = await callClaudeForToolInput({
      model: MODEL,
      max_tokens: DETAIL_MAX_TOKENS,
      // İlk blok 6 çağrıda birebir aynı (prefix cache tutar); katman kısıtı
      // cache'siz ikinci blok — bkz. COMMON_DETAIL_SYSTEM_PROMPT yorumu.
      system: [
        { type: 'text', text: COMMON_DETAIL_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: LAYER_VARIANTS[layerTarget].constraint },
      ],
      temperature: LAYER_VARIANTS[layerTarget].temperature,
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

  const recipe = toRecipeDetail(name, toolInput);
  if (!recipe) {
    throw new RecipeGenerationError(`"${name}" tarifi ayrıştırılamadı, tekrar deneyin`);
  }
  return recipe;
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
  layerTarget: RecipeLayerId = 'closeMatch'
): Promise<RecipeDetail> {
  const simplifiedInventory = simplifyInventory(inventory);
  const baseContent = `Tarif adı: "${name}"\nEnvanter: ${JSON.stringify(simplifiedInventory)}`;

  let recipe = await callRecipeDetail(name, layerTarget, baseContent);

  if (layerTarget === 'ready' && recipe.missing_count > 0) {
    const missingNames = recipe.ingredients
      .filter((ingredient) => !ingredient.in_inventory)
      .map((ingredient) => ingredient.name)
      .join(', ');
    console.log(`[recipe] "${name}" ready hedefliydi ama ${recipe.missing_count} eksikle döndü (${missingNames}) — düzeltme deneniyor`);
    try {
      recipe = await callRecipeDetail(
        name,
        layerTarget,
        `${baseContent}\n\nÖnceki denemede şu malzemeler envanterde/kilerde yoktu: ${missingNames}. ` +
          'Tarifi bu malzemeler OLMADAN yeniden kur veya envanterdeki karşılıklarıyla değiştir — ' +
          'HER malzeme in_inventory: true olmalı.'
      );
    } catch {
      // Düzeltme çağrısı başarısız olursa ilk sonuç kullanılır — eksik
      // sayısına göre alışveriş bölümüne düşer, tarif kaybolmaz.
    }
  }

  return { recipe, layer: assignRecipeLayer(recipe.missing_count) };
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
 */
export async function generateRecipesTwoPhase(
  inventory: InventoryItem[],
  callbacks?: {
    onPlanReady?: (plans: RecipePlan[]) => void;
    onDetailSettled?: (result: RecipeDetailResult) => void;
  }
): Promise<Recipe[]> {
  const tStart = performance.now();

  const plans = await generateRecipeNames(inventory);
  console.log(
    `[PERF][recipe] aşama-1 (isim/plan): ${(performance.now() - tStart).toFixed(0)}ms, ${plans.length} tarif planlandı`
  );
  callbacks?.onPlanReady?.(plans);

  const tDetailStart = performance.now();
  const settled = await Promise.allSettled(
    plans.map(async (plan, planIndex): Promise<RecipeDetailResult> => {
      try {
        const { recipe, layer } = await generateRecipeDetail(plan.name, inventory, plan.estimatedLayer);
        const result: RecipeDetailResult = { planIndex, name: plan.name, status: 'done', recipe, layer };
        callbacks?.onDetailSettled?.(result);
        return result;
      } catch (error) {
        const err =
          error instanceof RecipeGenerationError
            ? error
            : new RecipeGenerationError('Bilinmeyen bir hata oluştu', { cause: error });
        const result: RecipeDetailResult = { planIndex, name: plan.name, status: 'error', error: err };
        callbacks?.onDetailSettled?.(result);
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
