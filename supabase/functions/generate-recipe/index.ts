/**
 * generate-recipe — RAG tabanlı tarif üretimi (BLOK A / A4+A5, Supabase Edge
 * Function, Deno). Bkz. README-rag.md.
 *
 * Akış:
 *   1. Girdi: kullanıcının envanteri + tercih tag'leri + kişi sayısı + dil.
 *   2. Envanter+tercihlerden sorgu metni kurulur, Gemini ile embedding alınır
 *      (gemini-embedding-001, 768 boyut, RETRIEVAL_QUERY, L2-normalize —
 *      scripts/embed-recipes.ts ile aynı uzay).
 *   3. match_recipes RPC'siyle en benzer RAG_MATCH_COUNT (8) tarif çekilir.
 *   4. HİBRİT KISAYOL (A5): en yakın tarifin benzerliği eşik üstünde VE eksik
 *      malzeme sayısı 0 ise LLM HİÇ çağrılmadan o tarif `source: "database"`
 *      işaretiyle döndürülür.
 *   5. Aksi halde çekilen tarifler bağlam olarak prompt'a eklenir ve UCUZ
 *      modelle (Claude Haiku — proje tarif üretiminde Claude kullanıyor)
 *      istenen sayıda tarif üretilir. Çıktı dili parametriktir
 *      ("Respond in {language}", varsayılan English).
 *
 * API anahtarları YALNIZCA bu function'ın environment'ında yaşar
 * (supabase secrets set ...) — client'a asla sızmaz.
 *
 * Çıktı şeması, uygulamanın mevcut tarif kartı/detay yapısının beklediği
 * `Recipe` JSON'udur (types/recipe.ts ile senkron tutulmalı — bilinçli olarak
 * kopyalandı ki edge bundle app koduna bağımlı olmasın).
 */

// ---------------------------------------------------------------------------
// Config (A5: eşik config'de tutulur — env ile override edilebilir)
// ---------------------------------------------------------------------------

const CONFIG = {
  /** Hibrit kısayol benzerlik eşiği (cosine similarity, 0-1). */
  matchThreshold: Number(Deno.env.get('RAG_MATCH_THRESHOLD') ?? '0.8'),
  /** Retrieval'da çekilecek benzer tarif sayısı. */
  matchCount: Number(Deno.env.get('RAG_MATCH_COUNT') ?? '8'),
  /** Madde 3: çeşitlendirme için çekilen ADAY sayısı — final matchCount'a
   * başlık-token tavanıyla süzülür (bkz. diversifyMatches). */
  matchCandidates: Number(Deno.env.get('RAG_MATCH_CANDIDATES') ?? '24'),
  /** Üretim modeli — ucuz model (Claude Haiku). */
  generationModel: Deno.env.get('RAG_GENERATION_MODEL') ?? 'claude-haiku-4-5',
  /** Tek çağrıda üretilecek varsayılan tarif sayısı. */
  defaultRecipeCount: Number(Deno.env.get('RAG_RECIPE_COUNT') ?? '6'),
  /** İş 1b: normal tariflere EK üretilen fine dining tarif sayısı. */
  fineDiningCount: Number(Deno.env.get('RAG_FINE_DINING_COUNT') ?? '2'),
  /** Fine dining retrieval'da çekilen benzer tarif sayısı. */
  fineDiningMatchCount: Number(Deno.env.get('RAG_FINE_DINING_MATCH_COUNT') ?? '5'),
  /** Fine dining havuzunun tag'i — scripts/tag-fine-dining.ts ile senkron. */
  fineDiningTag: 'fine-dining',
  embeddingModel: 'gemini-embedding-001',
  embeddingDimensions: 768,
  defaultLanguage: 'English',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Uygulama şeması (types/recipe.ts ile senkron — alan ekleme/çıkarmada iki
// tarafı birlikte güncelle)
// ---------------------------------------------------------------------------

const INGREDIENT_CATEGORIES = [
  'Meyve & Sebze',
  'Süt & Peynir',
  'Et & Şarküteri',
  'Bakliyat & Makarna',
  'Baharat & Sos',
  'Diğer',
] as const;

const NUTRITION_TAGS = ['Protein', 'Enerji', 'Lifli', 'Hafif', 'Dengeli', 'Onarım'] as const;

interface RecipeIngredient {
  name: string;
  qty: number;
  unit: string;
  kcal: number;
  category: (typeof INGREDIENT_CATEGORIES)[number];
  in_inventory: boolean;
}

interface Recipe {
  id: string;
  name: string;
  emoji: string;
  kcal: number;
  servings: number;
  time_min: number;
  difficulty: 'Kolay' | 'Orta' | 'Zor';
  macros: { protein: number; karb: number; yag: number };
  match_pct: number;
  ingredients: RecipeIngredient[];
  missing_count: number;
  steps: string[];
  chef_tip: string;
  nutrition_tag: (typeof NUTRITION_TAGS)[number];
  image_prompt_en?: string;
  /** RAG genişletmesi: tarifin kaynağı — kısayol "database", LLM "llm". */
  source: 'database' | 'llm';
  /** İş 1b: fine dining havuzundan üretilen tarifler bu alanla ayırt edilir
   * (normal tariflerde alan hiç bulunmaz — types/recipe.ts ile senkron). */
  category?: 'fine-dining';
}

// ---------------------------------------------------------------------------
// Girdi
// ---------------------------------------------------------------------------

interface InventoryEntry {
  name: string;
  qty?: number;
  unit?: string;
}

interface GenerateRecipeInput {
  inventory: InventoryEntry[];
  /** Tercih ekranı tag'leri — düz liste ("Vejetaryen", "Hızlı"...). */
  preferences?: string[];
  /** Kişi sayısı — verilirse üretilen tarifler bu porsiyona göre kurulur. */
  servings?: number;
  /** Çıktı dili ("Turkish", "English"...) — varsayılan English. */
  language?: string;
  /** Üretilecek tarif sayısı (hibrit kısayol tetiklenmezse). */
  count?: number;
  /** Evde var kabul edilen kiler malzemeleri (aktif kiler listesi). */
  pantry?: string[];
}

function parseInput(raw: unknown): GenerateRecipeInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Gövde JSON objesi olmalı');
  }
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.inventory) || obj.inventory.length === 0) {
    throw new Error('inventory boş olamaz');
  }
  const inventory = obj.inventory
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      name: String(entry.name ?? '').trim(),
      qty: typeof entry.qty === 'number' ? entry.qty : undefined,
      unit: typeof entry.unit === 'string' ? entry.unit : undefined,
    }))
    .filter((entry) => entry.name.length > 0);
  if (inventory.length === 0) throw new Error('inventory içinde geçerli ürün yok');

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

  return {
    inventory,
    preferences: asStringArray(obj.preferences),
    servings:
      typeof obj.servings === 'number' && obj.servings >= 1 ? Math.round(obj.servings) : undefined,
    language:
      typeof obj.language === 'string' && obj.language.trim().length > 0
        ? obj.language.trim()
        : CONFIG.defaultLanguage,
    count:
      typeof obj.count === 'number' && obj.count >= 1 && obj.count <= 8
        ? Math.round(obj.count)
        : CONFIG.defaultRecipeCount,
    pantry: asStringArray(obj.pantry),
  };
}

// ---------------------------------------------------------------------------
// Embedding (Gemini REST — Deno'da SDK'siz düz fetch)
// ---------------------------------------------------------------------------

function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  return norm === 0 ? vector : vector.map((v) => v / norm);
}

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) throw new Error('GOOGLE_API_KEY tanımlı değil (supabase secrets)');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.embeddingModel}:embedContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: CONFIG.embeddingDimensions,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini embedding hatası (${response.status}): ${detail.slice(0, 200)}`);
  }
  const data = (await response.json()) as { embedding?: { values?: number[] } };
  const values = data.embedding?.values;
  if (!values || values.length !== CONFIG.embeddingDimensions) {
    throw new Error('Gemini embedding yanıtı beklenen boyutta değil');
  }
  return l2Normalize(values);
}

// ---------------------------------------------------------------------------
// Retrieval (match_recipes RPC)
// ---------------------------------------------------------------------------

interface MatchedRecipe {
  id: number;
  source_id: string;
  title: string;
  ingredients: { text: string; name: string; qty: number | null; unit: string | null }[];
  steps: string[];
  prep_time_minutes: number | null;
  servings: number | null;
  tags: string[];
  calories: number | null;
  similarity: number;
}

async function matchRecipes(
  queryEmbedding: number[],
  matchCount: number,
  filterTag?: string
): Promise<MatchedRecipe[]> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/match_recipes`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_count: matchCount,
      // filter_tag yalnızca istendiğinde gönderilir — tag-filtresi migration'ı
      // uygulanmamış bir veritabanında normal akış çalışmaya devam eder.
      ...(filterTag ? { filter_tag: filterTag } : {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`match_recipes hatası (${response.status}): ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as MatchedRecipe[];
}

// ---------------------------------------------------------------------------
// Eksik malzeme hesabı (hibrit kısayol için)
// ---------------------------------------------------------------------------

/**
 * Ad eşleştirme — client'taki lib/recipes/ingredient-match.ts ile AYNI
 * normalize token mantığının kopyası (edge bundle app koduna bağımlı olamaz,
 * bilinçli kopya — iki taraf değişirse birlikte güncellenmeli). Eski ham
 * alt-dize eşleştirmesi client'la FARKLI karar veriyordu: model "Balsamic
 * Vinegar"ı eksik işaretliyor, client namesMatch ile kilerdeki "Vinegar"a
 * eşleyip tarifi "hemen yapılabilir"e taşıyordu — sunucunun 2/4 katman
 * dağılımı ekranda bozuluyordu (kullanıcı gözlemi: 4 ready).
 */
function normalizeForMatch(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stemToken(token: string): string {
  if (token.length >= 6 && (token.endsWith('ler') || token.endsWith('lar'))) {
    return token.slice(0, -3);
  }
  if (token.length >= 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenize(name: string): string[] {
  return normalizeForMatch(name).split(' ').filter(Boolean).map(stemToken);
}

function tokenMatches(a: string, b: string): boolean {
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  return shorter.length >= 3 && longer.startsWith(shorter) && longer.length - shorter.length <= 2;
}

function namesMatch(a: string, b: string): boolean {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  const aInB = tokensA.every((ta) => tokensB.some((tb) => tokenMatches(ta, tb)));
  const bInA = tokensB.every((tb) => tokensA.some((ta) => tokenMatches(ta, tb)));
  return aInB || bInA;
}

function isAvailable(ingredientName: string, availableNames: string[]): boolean {
  return availableNames.some((available) => namesMatch(ingredientName, available));
}

/**
 * Üretim SONRASI deterministik düzeltme — İKİ YÖNLÜ (madde 2): in_inventory
 * bayrağı modelden alınmaz, envanter+kiler listesine karşı namesMatch ile
 * SIFIRDAN hesaplanır. Yükseltme (eksik sanılan ama mevcut) client'taki
 * applyInventoryReconciliation ile aynı; ALÇALTMA (mevcut sanılan ama
 * envanter/kilerde namesMatch karşılığı olmayan — örn. envanterde limon
 * yokken "Lemon Juice" in_inventory: true) client'ın CANLI computeMissing
 * hesabıyla hizalanmak için gerekli: baseline ölçümünde sunucunun 0 eksik
 * saydığı tarifler ekranda eksikli görünüyordu (analysis/
 * rag-tuning-baseline.md B3) ve katman hedeflemesi kayıyordu.
 */
function reconcileRecipes(recipes: Recipe[], availableNames: string[]): Recipe[] {
  return recipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ingredient) => {
      const available = isAvailable(ingredient.name, availableNames);
      return ingredient.in_inventory === available
        ? ingredient
        : { ...ingredient, in_inventory: available };
    });
    const missingCount = ingredients.filter((ingredient) => !ingredient.in_inventory).length;
    return {
      ...recipe,
      ingredients,
      missing_count: missingCount,
      match_pct:
        ingredients.length === 0
          ? 100
          : Math.round(((ingredients.length - missingCount) / ingredients.length) * 100),
    };
  });
}

/**
 * Madde 3 (baseline B2 kök nedeni): HNSW en-yakın komşuları tek malzeme
 * ailesine yığılabiliyor (somon envanterinde 8/8 somon başlığı) ve üretim
 * prompt'taki çeşitlilik kurallarına rağmen referansları taklit ediyor.
 * Benzerlik SIRASINI koruyarak açgözlü seçim yapar; bir başlık token'ı
 * seçilmişlerde 2 kez göründüyse o adayı atlar (yeterli aday kalmazsa
 * atlananlarla doldurur — seyrek sorguda referans sayısı düşmez).
 * İLK aday her zaman seçilir → matches[0] global en-benzer kalır (hibrit
 * kısayolun eşik kontrolü bozulmaz).
 */
const TITLE_STOP_TOKENS = new Set([
  'with', 'and', 'the', 'for', 'from', 'style', 'easy', 'best', 'simple', 'quick',
  'creamy', 'baked', 'roasted', 'grilled', 'fried', 'fresh', 'homemade', 'classic',
  'sauce', 'recipe', 'salad', 'soup', 'pasta', 'casserole',
]);

function titleTokens(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !TITLE_STOP_TOKENS.has(token));
}

/**
 * Referans başlıklarında BASKIN token (referansların yarısından fazlasında
 * geçen, örn. "salmon") — bulunursa prompt'a ADIYLA somut bir tavan cümlesi
 * yazılır. Ölçüm dersi (madde 3): jenerik "aynı yıldızı tekrarlama" kuralları
 * 8/8 somon referansına yenik düşüyor; somut kelimeli kural pozisyonel dağılım
 * kuralı gibi izlenebilir.
 */
function dominantReferenceToken(matches: MatchedRecipe[]): string | null {
  if (matches.length < 4) return null;
  const counts = new Map<string, number>();
  for (const match of matches) {
    for (const token of new Set(titleTokens(match.title))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [token, count] of counts) {
    if (count > bestCount) {
      best = token;
      bestCount = count;
    }
  }
  return best !== null && bestCount > matches.length / 2 ? best : null;
}

function diversifyMatches(candidates: MatchedRecipe[], take: number): MatchedRecipe[] {
  const tokenCount = new Map<string, number>();
  const selected: MatchedRecipe[] = [];
  for (const candidate of candidates) {
    if (selected.length >= take) break;
    const tokens = titleTokens(candidate.title);
    if (selected.length > 0 && tokens.some((token) => (tokenCount.get(token) ?? 0) >= 2)) {
      continue;
    }
    selected.push(candidate);
    for (const token of tokens) tokenCount.set(token, (tokenCount.get(token) ?? 0) + 1);
  }
  for (const candidate of candidates) {
    if (selected.length >= take) break;
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected;
}

function countMissing(recipe: MatchedRecipe, availableNames: string[]): number {
  return recipe.ingredients.filter((ingredient) => !isAvailable(ingredient.name, availableNames))
    .length;
}

/** Korpus tarifini uygulamanın Recipe şemasına eşler (kısayol yolu). */
function toDatabaseRecipe(matched: MatchedRecipe, availableNames: string[]): Recipe {
  const ingredients: RecipeIngredient[] = matched.ingredients.map((ingredient) => ({
    // Metrik tam satır ("450 g spiral pasta") ad olarak kullanılır — korpus
    // satırları qty+unit+ad tek metin halinde daha okunur.
    name: ingredient.text,
    qty: ingredient.qty ?? 1,
    unit: ingredient.unit ?? 'adet',
    kcal: 0,
    category: 'Diğer',
    in_inventory: isAvailable(ingredient.name, availableNames),
  }));
  const missingCount = ingredients.filter((ingredient) => !ingredient.in_inventory).length;
  return {
    id: crypto.randomUUID(),
    name: matched.title,
    emoji: '🍽️',
    kcal: Math.round(matched.calories ?? 0),
    servings: matched.servings ?? 2,
    time_min: matched.prep_time_minutes ?? 30,
    difficulty: 'Orta',
    macros: { protein: 0, karb: 0, yag: 0 },
    match_pct:
      ingredients.length === 0
        ? 100
        : Math.round(((ingredients.length - missingCount) / ingredients.length) * 100),
    ingredients,
    missing_count: missingCount,
    steps: matched.steps,
    chef_tip: '',
    nutrition_tag: 'Dengeli',
    // Madde 4: yalnız başlık, görsel üretiminde jenerik/yanlış yorumlanan
    // prompt'a yol açıyordu (analysis/rag-analysis.md §5) — ilk malzemelerle
    // zenginleştirilir. Dil uyumu: RAG hattı hep EN, korpus da EN — tutarlı.
    image_prompt_en:
      `${matched.title}, a home-style dish made with ` +
      matched.ingredients
        .slice(0, 5)
        .map((ingredient) => ingredient.name)
        .join(', '),
    source: 'database',
  };
}

// ---------------------------------------------------------------------------
// LLM üretimi (Claude Haiku, zorunlu tool-use — projenin mevcut deseniyle aynı)
// ---------------------------------------------------------------------------

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    emoji: { type: 'string' },
    kcal: { type: 'number', description: 'Kişi başı kalori' },
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
          qty: { type: 'number' },
          unit: { type: 'string', description: 'Metric or count unit ("g", "ml", "adet"...)' },
          kcal: { type: 'number' },
          category: { type: 'string', enum: [...INGREDIENT_CATEGORIES] },
          in_inventory: { type: 'boolean' },
        },
        required: ['name', 'qty', 'unit', 'kcal', 'category', 'in_inventory'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
    chef_tip: { type: 'string' },
    nutrition_tag: { type: 'string', enum: [...NUTRITION_TAGS] },
    image_prompt_en: { type: 'string' },
  },
  required: [
    'name',
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

function buildContextBlock(matches: MatchedRecipe[]): string {
  return matches
    .map((match, i) => {
      const ingredients = match.ingredients.map((ingredient) => ingredient.text).join('; ');
      return (
        `${i + 1}. ${match.title}` +
        (match.tags.length > 0 ? ` [${match.tags.join(', ')}]` : '') +
        (match.prep_time_minutes ? ` (${match.prep_time_minutes} min)` : '') +
        `\n   Ingredients: ${ingredients}\n   Steps: ${match.steps.join(' ')}`
      );
    })
    .join('\n');
}

/** Ortak kural blokları — normal ve fine dining promptlarında birebir aynı. */
function buildSharedRules(input: GenerateRecipeInput): string {
  const servingsRule = input.servings
    ? `- Each recipe must serve ${input.servings} people (servings: ${input.servings}); scale ingredient quantities accordingly.\n`
    : '';
  const preferencesRule =
    input.preferences && input.preferences.length > 0
      ? `- User preferences — these MUST visibly shape the set (choice of dishes, techniques and textures), ` +
        `not just be mentioned: ${input.preferences.join(', ')}. Different preference selections should ` +
        'lead to noticeably different recipe sets.\n'
      : '';
  const pantryRule =
    input.pantry && input.pantry.length > 0
      ? `- Pantry staples always available at home (never count as missing, always in_inventory: true): ${input.pantry.join(', ')}.\n`
      : '';
  const languagePurityRule =
    `- Never mix languages: every recipe name, ingredient name and step must be written entirely in ${input.language}, ` +
    'even when the user inventory contains ingredient names in another language (translate them).\n';
  // Model "eksik" olarak mevcut malzemenin varyantını seçince (Vinegar varken
  // Balsamic Vinegar) deterministik düzeltme onu evde-var'a çevirir ve katman
  // dağılımı kayar — eksikler GERÇEKTEN yeni malzemeler olmalı.
  const genuineShoppingRule =
    '- Shopping ingredients (in_inventory: false) must be genuinely NEW items: never list a variant of ' +
    'something already available (if Vinegar is available, do not list Balsamic Vinegar as a shopping ' +
    'item — either use the available item or pick a truly different ingredient).\n';
  return servingsRule + preferencesRule + pantryRule + languagePurityRule + genuineShoppingRule;
}

/**
 * Madde 3 (yapısal): normal üretim 2×3 PARALEL çağrıya bölünür (plan çağrısı
 * YOK — plan+detay mimarisi bu session'ın kapsamı dışında). Ölçüm dersi: tek
 * çağrıda 8/8 aynı-aileden referans bloğu, jenerik VE somut yıldız
 * tavanlarını eziyordu (en8'de ısrarla 4/6 somon). Bölme, tavanı yapısal
 * garanti yapar: A grubu (ready-ağırlıklı) baskın malzemeyi en fazla 2
 * tarifte kullanabilir, B grubu (alışveriş-ağırlıklı) baskın malzemeyi HİÇ
 * kullanamaz ve mümkünse baskın-olmayan referansları alır → toplam ≤2.
 * MVP-14 dersiyle çelişmez: iki grup farklı katman+yıldız kısıtlarıyla
 * YAPISAL olarak koordinedir, habersiz eş-planlama değildir.
 */
interface NormalGroupSpec {
  /** Bu gruptaki tarif sayısı. */
  count: number;
  /** Pozisyonel katman kuralı (grubun kendi içinde). */
  layerRule: string;
  /** Baskın referans token'ı kuralı (somut adla). */
  dominantRule: string;
}

function groupSpecs(totalCount: number, dominantToken: string | null): NormalGroupSpec[] {
  const countA = Math.min(totalCount, Math.ceil(totalCount / 2));
  const countB = totalCount - countA;
  const readyCount = Math.min(2, countA);
  const specA: NormalGroupSpec = {
    count: countA,
    layerRule:
      `- LAYER DISTRIBUTION (strict — count shopping ingredients per recipe before submitting): the ` +
      `first ${readyCount} recipe(s): cookable RIGHT NOW using ONLY inventory + pantry staples (every ` +
      'ingredient in_inventory: true, zero shopping items — not even a garnish; simplify the dish ' +
      'rather than add anything the user lacks). Any remaining recipe: exactly 1-2 shopping ' +
      'ingredients (in_inventory: false) that genuinely improve the dish.\n',
    dominantRule: dominantToken
      ? `- CONCRETE CAP: the references below are dominated by "${dominantToken}" — at most 2 of your ` +
        `recipes may contain ${dominantToken}; use the references for technique, not to repeat their star.\n`
      : '',
  };
  const specB: NormalGroupSpec = {
    count: countB,
    layerRule:
      '- LAYER DISTRIBUTION (strict — count shopping ingredients per recipe before submitting): the ' +
      'first recipe: exactly 1-2 shopping ingredients (in_inventory: false). The remaining recipes: ' +
      'exactly 3-4 shopping ingredients — more ambitious dishes where the purchases genuinely elevate ' +
      'the result. Making a recipe fully cookable from inventory VIOLATES this distribution; the ' +
      'shopping items must be REAL additions the user does not have.\n',
    dominantRule: dominantToken
      ? `- CONCRETE BAN: the reference corpus is dominated by "${dominantToken}", and another set of ` +
        `recipes already covers it — your recipes must NOT contain ${dominantToken} at all; build them ` +
        'around the OTHER inventory items, using the references only for technique and structure.\n'
      : '',
  };
  return countB > 0 ? [specA, specB] : [specA];
}

function buildSystemPrompt(
  input: GenerateRecipeInput,
  matches: MatchedRecipe[],
  spec: NormalGroupSpec
): string {
  return (
    'You are a recipe generator for a mobile cooking app. Using the user inventory and the similar ' +
    `reference recipes below, create ${spec.count} distinct, realistic recipes.\n` +
    'Rules:\n' +
    `- Respond in ${input.language}: every human-readable text field (name, ingredient names, steps, chef_tip) ` +
    `must be written in ${input.language}. Schema enum fields (difficulty, category, nutrition_tag) and ` +
    'image_prompt_en (always English) keep their fixed values.\n' +
    '- Ground the recipes in the reference recipes where possible (adapt, simplify, combine), but adjust them ' +
    'to the user inventory; do not invent implausible dishes.\n' +
    '- Use inventory ingredients as the base; mark in_inventory per the inventory list.\n' +
    spec.layerRule +
    '- Use metric units (g/ml) or counts for ingredient quantities; qty is for the default servings.\n' +
    '- kcal is per person; ingredient kcal values are totals for the default servings and should roughly sum ' +
    'to kcal × servings.\n' +
    '- Make the recipes DIVERSE: spread them across different meal types (breakfast, main dish, soup, ' +
    'salad, oven bake...) and different cooking techniques; no two recipes may share the same main ' +
    'ingredient combination or star ingredient, and do not base every recipe on the same one or two ' +
    'reference recipes.\n' +
    spec.dominantRule +
    '- COVER the available ingredients broadly: every inventory ingredient that can carry a dish should be ' +
    'the star of at least one recipe. Hearty pantry staples (pasta, rice, bulgur, flour) are REAL ' +
    'ingredients too — when available, build at least one dish around one of them (a pasta dish, a rice ' +
    'pilaf, a bake...), combined with inventory items.\n' +
    buildSharedRules(input) +
    // Dayanıklılık yolu: retrieval başarısızsa referans bloğu boş kalır —
    // model envanterden bağımsız üretir, boş başlık altında liste beklemesin.
    (matches.length > 0
      ? '\nReference recipes (retrieved by similarity):\n' + buildContextBlock(matches)
      : '\n(No reference recipes available — create the recipes from the inventory alone.)')
  );
}

/**
 * İş 1b: fine dining üretim promptu — tarz farkı belirgin (rafine sunum/
 * plating notları, teknik ağırlıklı adımlar) ama malzemeler yine kullanıcının
 * envanterine dayanır; eksikler normal akıştaki gibi in_inventory: false ile
 * işaretlenir. Referanslar yalnızca 'fine-dining' etiketli havuzdan gelir.
 */
function buildFineDiningSystemPrompt(input: GenerateRecipeInput, matches: MatchedRecipe[]): string {
  const dominantToken = dominantReferenceToken(matches);
  return (
    'You are a fine dining chef creating elevated recipes for a mobile cooking app. Using the user ' +
    `inventory and the fine dining reference recipes below, create ${CONFIG.fineDiningCount} distinct, ` +
    'refined restaurant-quality recipes.\n' +
    'Rules:\n' +
    `- Respond in ${input.language}: every human-readable text field (name, ingredient names, steps, chef_tip) ` +
    `must be written in ${input.language}. Schema enum fields (difficulty, category, nutrition_tag) and ` +
    'image_prompt_en (always English) keep their fixed values.\n' +
    '- Fine dining style is essential: elegant dish names, technique-driven steps (searing, deglazing, ' +
    'emulsifying, resting...), sauce/texture contrast, and a final PLATING step describing how to present ' +
    'the dish beautifully (composition, garnish, sauce placement).\n' +
    '- The two recipes must NOT share the same primary protein or star ingredient, even if the reference ' +
    'recipes all feature one — build the second dish around a different inventory item.\n' +
    (dominantToken
      ? `- CONCRETE CAP: the references below are dominated by "${dominantToken}" — only ONE of the two ` +
        `recipes may contain ${dominantToken}; the other must be built entirely without it.\n`
      : '') +
    '- Ground the recipes in the reference recipes where possible (adapt, refine, elevate), but base the ' +
    'ingredients on the user inventory; mark missing ingredients in_inventory: false exactly like the ' +
    'normal flow. Do not invent implausible dishes.\n' +
    '- CONTRAST (strict): the FIRST fine dining recipe must be cookable RIGHT NOW using only inventory + ' +
    'pantry staples (every ingredient in_inventory: true) — elevated technique, zero shopping. The SECOND ' +
    'must require exactly 2-3 shopping ingredients (in_inventory: false) that push it to restaurant level.\n' +
    '- Use metric units (g/ml) or counts for ingredient quantities; qty is for the default servings.\n' +
    '- kcal is per person; ingredient kcal values are totals for the default servings and should roughly sum ' +
    'to kcal × servings.\n' +
    '- chef_tip should be a professional technique tip (temperature, timing, texture).\n' +
    '- image_prompt_en should describe a fine dining plating (elegant plate, garnish, negative space).\n' +
    buildSharedRules(input) +
    '\nFine dining reference recipes (retrieved by similarity):\n' +
    buildContextBlock(matches)
  );
}

interface ClaudeToolUseBlock {
  type: string;
  name?: string;
  input?: unknown;
}

/** Madde 5 (gözlemlenebilirlik): her Claude çağrısının stop_reason + usage'ı
 * hem `[rag-gen]` etiketiyle loglanır hem yanıtın `generation` alanında
 * döndürülür (client bilinmeyen alanı yok sayar; ölçüm harness'i okur). */
interface GenerationMeta {
  stopReason: string | null;
  inputTokens: number;
  outputTokens: number;
}

interface GenerationResult {
  recipes: Recipe[];
  meta: GenerationMeta;
}

const EMPTY_META: GenerationMeta = { stopReason: null, inputTokens: 0, outputTokens: 0 };

interface ClaudeGenerationOptions {
  /** Üretilecek en fazla tarif sayısı (tool şemasının maxItems'ı). */
  count: number;
  /** Sistem promptu — normal veya fine dining varyantı. */
  systemPrompt: string;
  /** Üretilen her tarife yazılacak ayırt edici kategori (fine dining yolu). */
  category?: Recipe['category'];
}

async function generateWithClaude(
  input: GenerateRecipeInput,
  options: ClaudeGenerationOptions
): Promise<GenerationResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY tanımlı değil (supabase secrets)');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CONFIG.generationModel,
      // Madde 3: 6 tarif tek çıktıda ~7.6K token'a ulaşıyor (ölçüldü) — 8192
      // bütçe kesilme sınırındaydı; kullanılmayan pay maliyet doğurmaz.
      max_tokens: 12288,
      system: options.systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Inventory: ${JSON.stringify(
            input.inventory.map((entry) => ({ name: entry.name, qty: entry.qty, unit: entry.unit }))
          )}`,
        },
      ],
      tools: [
        {
          name: 'submit_recipes',
          description: 'Submit the generated recipes.',
          input_schema: {
            type: 'object',
            properties: {
              recipes: {
                type: 'array',
                minItems: 1,
                maxItems: options.count,
                items: RECIPE_SCHEMA,
              },
            },
            required: ['recipes'],
          },
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_recipes' },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Claude API hatası (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: ClaudeToolUseBlock[];
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const meta: GenerationMeta = {
    stopReason: data.stop_reason ?? null,
    inputTokens: data.usage?.input_tokens ?? 0,
    outputTokens: data.usage?.output_tokens ?? 0,
  };
  console.log(
    `[rag-gen] ${options.category ?? 'normal'} üretim: stop_reason=${meta.stopReason} ` +
      `in=${meta.inputTokens} out=${meta.outputTokens} model=${CONFIG.generationModel}`
  );
  if (meta.stopReason === 'max_tokens') {
    console.warn(
      `[rag-gen] ${options.category ?? 'normal'} üretim max_tokens sınırına takıldı — çıktı kesilmiş olabilir`
    );
  }
  const toolBlock = (data.content ?? []).find(
    (block) => block.type === 'tool_use' && block.name === 'submit_recipes'
  );
  const rawRecipes =
    toolBlock && typeof toolBlock.input === 'object' && toolBlock.input !== null
      ? (toolBlock.input as { recipes?: unknown }).recipes
      : undefined;
  if (!Array.isArray(rawRecipes) || rawRecipes.length === 0) {
    throw new Error('Claude yanıtında tarif bulunamadı');
  }

  const recipes = rawRecipes
    .map((raw) => toLlmRecipe(raw, options.category))
    .filter((recipe): recipe is Recipe => recipe !== null);
  return { recipes, meta };
}

/** Tool-use şeması tip/alanları garanti eder; burada minimal doğrulama +
 * missing_count/match_pct'in KODDA deterministik hesabı yapılır (mevcut
 * üretim akışıyla aynı ilke — modele güvenilmez). */
function toLlmRecipe(raw: unknown, category?: Recipe['category']): Recipe | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.name !== 'string' || !Array.isArray(obj.ingredients) || !Array.isArray(obj.steps)) {
    return null;
  }
  const ingredients: RecipeIngredient[] = (obj.ingredients as Record<string, unknown>[])
    .filter((entry) => typeof entry?.name === 'string' && typeof entry?.in_inventory === 'boolean')
    .map((entry) => ({
      name: entry.name as string,
      qty: typeof entry.qty === 'number' && entry.qty > 0 ? (entry.qty as number) : 1,
      unit: typeof entry.unit === 'string' && entry.unit ? (entry.unit as string) : 'adet',
      kcal: typeof entry.kcal === 'number' && entry.kcal >= 0 ? (entry.kcal as number) : 0,
      category: INGREDIENT_CATEGORIES.includes(entry.category as never)
        ? (entry.category as RecipeIngredient['category'])
        : 'Diğer',
      in_inventory: entry.in_inventory as boolean,
    }));
  if (ingredients.length === 0) return null;

  const missingCount = ingredients.filter((ingredient) => !ingredient.in_inventory).length;
  return {
    id: crypto.randomUUID(),
    name: obj.name,
    emoji: typeof obj.emoji === 'string' && obj.emoji ? obj.emoji : '🍽️',
    kcal: typeof obj.kcal === 'number' ? obj.kcal : 0,
    servings: typeof obj.servings === 'number' && obj.servings >= 1 ? obj.servings : 2,
    time_min: typeof obj.time_min === 'number' && obj.time_min > 0 ? obj.time_min : 30,
    difficulty: obj.difficulty === 'Kolay' || obj.difficulty === 'Zor' ? obj.difficulty : 'Orta',
    macros:
      typeof obj.macros === 'object' && obj.macros !== null
        ? {
            protein: Number((obj.macros as Record<string, unknown>).protein) || 0,
            karb: Number((obj.macros as Record<string, unknown>).karb) || 0,
            yag: Number((obj.macros as Record<string, unknown>).yag) || 0,
          }
        : { protein: 0, karb: 0, yag: 0 },
    match_pct: Math.round(((ingredients.length - missingCount) / ingredients.length) * 100),
    ingredients,
    missing_count: missingCount,
    steps: (obj.steps as unknown[]).filter((step): step is string => typeof step === 'string'),
    chef_tip: typeof obj.chef_tip === 'string' ? obj.chef_tip : '',
    nutrition_tag: NUTRITION_TAGS.includes(obj.nutrition_tag as never)
      ? (obj.nutrition_tag as Recipe['nutrition_tag'])
      : 'Dengeli',
    image_prompt_en: typeof obj.image_prompt_en === 'string' ? obj.image_prompt_en : undefined,
    source: 'llm',
    ...(category ? { category } : {}),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST bekleniyor' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }

  try {
    const input = parseInput(await request.json());

    // 1) Sorgu metni: envanter adları + kiler + tercihler (embedding modeli
    //    çok dilli — Türkçe envanter, İngilizce korpusla makul eşleşir).
    //    Kiler sorguya BİLİNÇLİ dahil: makarna/pirinç gibi taşıyıcı kiler
    //    malzemeleri sorguda yoksa retrieval o yemek ailelerini (pasta, pilav)
    //    hiç getirmiyor ve üretim hep envanter kümesine sıkışıyordu
    //    (kullanıcı gözlemi: "makarnalı/pirinçli hiçbir tarif yok").
    const inventoryNames = input.inventory.map((entry) => entry.name);
    const queryText =
      `Available ingredients: ${inventoryNames.join(', ')}` +
      (input.pantry && input.pantry.length > 0
        ? `\nPantry staples: ${input.pantry.join(', ')}`
        : '') +
      (input.preferences && input.preferences.length > 0
        ? `\nPreferences: ${input.preferences.join(', ')}`
        : '');

    // 2) Embedding + 3) retrieval — normal havuz ve 'fine-dining' etiketli
    //    havuz aynı sorgu embedding'iyle PARALEL çekilir (İş 1b).
    //
    // DAYANIKLILIK: embedding/retrieval'daki geçici hatalar (canlıda görüldü:
    // PostgREST "JWT issued at future" saat kayması → tüm istek 500'e
    // düşüyordu) üretimi ASLA düşürmez — her adım 1 kez yeniden denenir,
    // yine olmazsa referanssız devam edilir (LLM tarifleri korpus bağlamı
    // olmadan da üretir; RAG zenginleştirmedir, ön koşul değil).
    const retryOnce = async <T>(label: string, run: () => Promise<T>): Promise<T> => {
      try {
        return await run();
      } catch (error) {
        console.warn(`[generate-recipe] ${label} ilk deneme başarısız, tekrarlanıyor:`, error);
        await new Promise((resolve) => setTimeout(resolve, 400));
        return run();
      }
    };

    const queryEmbedding = await retryOnce('embedding', () => embedQuery(queryText)).catch(
      (error) => {
        console.error('[generate-recipe] embedding alınamadı — referanssız üretim:', error);
        return null;
      }
    );
    const [matchCandidates, fineDiningCandidates] = queryEmbedding
      ? await Promise.all([
          retryOnce('retrieval', () => matchRecipes(queryEmbedding, CONFIG.matchCandidates)).catch(
            (error) => {
              console.error('[generate-recipe] retrieval hatası — referanssız üretim:', error);
              return [] as MatchedRecipe[];
            }
          ),
          retryOnce('fine dining retrieval', () =>
            matchRecipes(queryEmbedding, CONFIG.fineDiningMatchCount * 2, CONFIG.fineDiningTag)
          ).catch((error) => {
            // Fine dining retrieval'ı normal akışı DÜŞÜRMEZ (örn. tag-filtresi
            // migration'ı henüz uygulanmadıysa) — loglanır, boş devam edilir.
            console.error('[generate-recipe] fine dining retrieval hatası:', error);
            return [] as MatchedRecipe[];
          }),
        ])
      : [[] as MatchedRecipe[], [] as MatchedRecipe[]];
    // Madde 3: aday havuzu başlık-token tavanıyla süzülür (bkz. diversifyMatches).
    const matches = diversifyMatches(matchCandidates, CONFIG.matchCount);
    const fineDiningMatches = diversifyMatches(fineDiningCandidates, CONFIG.fineDiningMatchCount);
    console.log(
      `[rag-gen] retrieval: ${matchCandidates.length} aday → ${matches.length} referans; ` +
        `fine dining ${fineDiningCandidates.length} aday → ${fineDiningMatches.length}`
    );

    // İş 1b: fine dining üretimi normal akışla EŞZAMANLI başlar — kısayol
    // tetiklense de tetiklenmese de her yanıtta 2 fine dining tarifi hedeflenir.
    // Başarısızlık normal tarifleri düşürmez (graceful degradation).
    const fineDiningPromise: Promise<GenerationResult> =
      fineDiningMatches.length > 0
        ? generateWithClaude(input, {
            count: CONFIG.fineDiningCount,
            systemPrompt: buildFineDiningSystemPrompt(input, fineDiningMatches),
            category: 'fine-dining',
          }).catch((error): GenerationResult => {
            console.error('[generate-recipe] fine dining üretim hatası:', error);
            return { recipes: [], meta: EMPTY_META };
          })
        : Promise.resolve({ recipes: [], meta: EMPTY_META });

    // 4) Hibrit kısayol (A5): eşik üstü benzerlik + 0 eksik → normal set için
    //    LLM'siz dönüş (fine dining tarifleri yine eklenir).
    const availableNames = [...inventoryNames, ...(input.pantry ?? [])].map((name) =>
      name.toLowerCase()
    );
    const top = matches[0];
    if (top && top.similarity >= CONFIG.matchThreshold && countMissing(top, availableNames) === 0) {
      const recipe = toDatabaseRecipe(top, availableNames);
      const fineDiningResult = await fineDiningPromise;
      const fineDiningRecipes = reconcileRecipes(fineDiningResult.recipes, availableNames);
      return new Response(
        JSON.stringify({
          source: 'database',
          recipes: [recipe, ...fineDiningRecipes],
          retrieval: {
            topSimilarity: top.similarity,
            matchedTitles: matches.map((m) => m.title),
            fineDiningTitles: fineDiningMatches.map((m) => m.title),
          },
          generation: { fineDining: fineDiningResult.meta },
        }),
        { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } }
      );
    }

    // 5) LLM üretimi (retrieval bağlamıyla) — fine dining çağrısıyla paralel.
    // Üretim sonrası her iki set de deterministik düzeltmeden geçer: modelin
    // eksik sandığı ama envanter/kilerde varyantı bulunan malzemeler
    // (örn. kilerde Vinegar varken "Balsamic Vinegar") evde-var'a çevrilir,
    // missing_count buna göre yeniden hesaplanır — katman dağılımı client'ın
    // canlı hesabıyla tutarlı kalır.
    const normalCount = input.count ?? CONFIG.defaultRecipeCount;
    const dominantToken = dominantReferenceToken(matches);
    // B grubu mümkünse baskın-olmayan referansları alır (aday havuzundan);
    // yeterli aday yoksa aynı referanslarla devam edilir (BAN kuralı yine geçerli).
    const nonDominantCandidates = dominantToken
      ? matchCandidates.filter((candidate) => !titleTokens(candidate.title).includes(dominantToken))
      : [];
    const specs = groupSpecs(normalCount, dominantToken);
    // B grubu referansları: baskın-aile dışı adaylar; HİÇ yoksa referans
    // bloğu BOŞ bırakılır (ölçüm dersi: baskın-aileli referans içeriği,
    // açık BAN kuralını bile eziyor — kopyalanacak içerik kalmamalı; prompt'un
    // referanssız fallback dalı envanterden üretime zaten izin veriyor).
    const groupMatches = specs.map((_, index) => {
      if (index !== 1 || !dominantToken) return matches;
      return nonDominantCandidates.length >= 3
        ? diversifyMatches(nonDominantCandidates, CONFIG.matchCount)
        : [];
    });
    const [normalSettled, fineDiningResult] = await Promise.all([
      Promise.allSettled(
        specs.map((spec, index) =>
          generateWithClaude(input, {
            count: spec.count,
            systemPrompt: buildSystemPrompt(input, groupMatches[index], spec),
          })
        )
      ),
      fineDiningPromise,
    ]);
    // Bir grup düşerse diğeriyle devam (degrade); ikisi de düştüyse hata.
    const normalResults = normalSettled
      .filter((entry): entry is PromiseFulfilledResult<GenerationResult> => entry.status === 'fulfilled')
      .map((entry) => entry.value);
    if (normalResults.length === 0) {
      const firstError = normalSettled.find(
        (entry): entry is PromiseRejectedResult => entry.status === 'rejected'
      );
      throw firstError ? firstError.reason : new Error('Tarif üretilemedi');
    }
    if (normalResults.length < specs.length) {
      console.warn('[rag-gen] normal üretim gruplarından biri düştü — kalanla devam ediliyor');
    }
    const normalMeta: GenerationMeta = {
      stopReason: normalResults.map((result) => result.meta.stopReason ?? '?').join('/'),
      inputTokens: normalResults.reduce((sum, result) => sum + result.meta.inputTokens, 0),
      outputTokens: normalResults.reduce((sum, result) => sum + result.meta.outputTokens, 0),
    };
    // İsim bazlı tekilleştirme (client mergeRecipeLayers ile aynı ilke) —
    // iki grup nadiren aynı adı üretirse eksik sayısı düşük olan kalır.
    const byName = new Map<string, Recipe>();
    for (const recipe of reconcileRecipes(normalResults.flatMap((result) => result.recipes), availableNames)) {
      const key = recipe.name.trim().toLowerCase();
      const existing = byName.get(key);
      if (!existing || recipe.missing_count < existing.missing_count) {
        byName.set(key, recipe);
      }
    }
    const recipes = Array.from(byName.values());
    const fineDiningRecipes = reconcileRecipes(fineDiningResult.recipes, availableNames);

    // Madde 5: mutabakat SONRASI katman dağılımı — sunucunun hedeflediği
    // 2/2/2'nin tutup tutmadığı loglardan izlenebilsin.
    const distribution = {
      ready: recipes.filter((r) => r.missing_count === 0).length,
      close: recipes.filter((r) => r.missing_count >= 1 && r.missing_count <= 2).length,
      few: recipes.filter((r) => r.missing_count >= 3).length,
    };
    console.log(
      `[rag-gen] dağılım (reconcile sonrası): ready=${distribution.ready} 1-2=${distribution.close} 3+=${distribution.few}`
    );

    return new Response(
      JSON.stringify({
        source: 'llm',
        recipes: [...recipes, ...fineDiningRecipes],
        retrieval: {
          topSimilarity: top?.similarity ?? null,
          matchedTitles: matches.map((m) => m.title),
          fineDiningTitles: fineDiningMatches.map((m) => m.title),
        },
        generation: { normal: normalMeta, fineDining: fineDiningResult.meta },
      }),
      { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    console.error('[generate-recipe]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
    });
  }
});
