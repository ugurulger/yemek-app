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
 * Basit ad eşleştirme: envanter/kiler adı ile korpus malzeme adı (her ikisi
 * küçük harfe indirgenmiş) birbirini içeriyorsa "evde var" sayılır. Korpus
 * İngilizce, envanter Türkçe olduğundan diller karışıksa kısayol nadiren
 * tetiklenir — bilinçli MVP sınırı (bkz. README-rag.md).
 */
function isAvailable(ingredientName: string, availableNames: string[]): boolean {
  const target = ingredientName.toLowerCase();
  return availableNames.some((available) => {
    if (available.length < 3 || target.length < 3) return available === target;
    return target.includes(available) || available.includes(target);
  });
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
    image_prompt_en: matched.title,
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
      ? `- User preferences (shape recipes around them): ${input.preferences.join(', ')}.\n`
      : '';
  const pantryRule =
    input.pantry && input.pantry.length > 0
      ? `- Pantry staples always available at home (never count as missing, always in_inventory: true): ${input.pantry.join(', ')}.\n`
      : '';
  return servingsRule + preferencesRule + pantryRule;
}

function buildSystemPrompt(input: GenerateRecipeInput, matches: MatchedRecipe[]): string {
  return (
    'You are a recipe generator for a mobile cooking app. Using the user inventory and the similar ' +
    `reference recipes below, create ${input.count} distinct, realistic recipes.\n` +
    'Rules:\n' +
    `- Respond in ${input.language}: every human-readable text field (name, ingredient names, steps, chef_tip) ` +
    `must be written in ${input.language}. Schema enum fields (difficulty, category, nutrition_tag) and ` +
    'image_prompt_en (always English) keep their fixed values.\n' +
    '- Ground the recipes in the reference recipes where possible (adapt, simplify, combine), but adjust them ' +
    'to the user inventory; do not invent implausible dishes.\n' +
    '- Prefer recipes the user can cook NOW: use inventory ingredients as the base; mark in_inventory per the ' +
    'inventory list.\n' +
    '- Use metric units (g/ml) or counts for ingredient quantities; qty is for the default servings.\n' +
    '- kcal is per person; ingredient kcal values are totals for the default servings and should roughly sum ' +
    'to kcal × servings.\n' +
    '- Make the recipes diverse: different main ingredients, cooking techniques and meal types.\n' +
    buildSharedRules(input) +
    '\nReference recipes (retrieved by similarity):\n' +
    buildContextBlock(matches)
  );
}

/**
 * İş 1b: fine dining üretim promptu — tarz farkı belirgin (rafine sunum/
 * plating notları, teknik ağırlıklı adımlar) ama malzemeler yine kullanıcının
 * envanterine dayanır; eksikler normal akıştaki gibi in_inventory: false ile
 * işaretlenir. Referanslar yalnızca 'fine-dining' etiketli havuzdan gelir.
 */
function buildFineDiningSystemPrompt(input: GenerateRecipeInput, matches: MatchedRecipe[]): string {
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
    '- Ground the recipes in the reference recipes where possible (adapt, refine, elevate), but base the ' +
    'ingredients on the user inventory; a few missing ingredients are acceptable — mark them ' +
    'in_inventory: false exactly like the normal flow. Do not invent implausible dishes.\n' +
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
): Promise<Recipe[]> {
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
      max_tokens: 8192,
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

  const data = (await response.json()) as { content?: ClaudeToolUseBlock[] };
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

  return rawRecipes
    .map((raw) => toLlmRecipe(raw, options.category))
    .filter((recipe): recipe is Recipe => recipe !== null);
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

    // 1) Sorgu metni: envanter adları + tercihler (embedding modeli çok dilli —
    //    Türkçe envanter, İngilizce korpusla makul eşleşir).
    const inventoryNames = input.inventory.map((entry) => entry.name);
    const queryText =
      `Available ingredients: ${inventoryNames.join(', ')}` +
      (input.preferences && input.preferences.length > 0
        ? `\nPreferences: ${input.preferences.join(', ')}`
        : '');

    // 2) Embedding + 3) retrieval — normal havuz ve 'fine-dining' etiketli
    //    havuz aynı sorgu embedding'iyle PARALEL çekilir (İş 1b).
    const queryEmbedding = await embedQuery(queryText);
    const [matches, fineDiningMatches] = await Promise.all([
      matchRecipes(queryEmbedding, CONFIG.matchCount),
      matchRecipes(queryEmbedding, CONFIG.fineDiningMatchCount, CONFIG.fineDiningTag).catch(
        (error) => {
          // Fine dining retrieval'ı normal akışı DÜŞÜRMEZ (örn. tag-filtresi
          // migration'ı henüz uygulanmadıysa) — loglanır, boş devam edilir.
          console.error('[generate-recipe] fine dining retrieval hatası:', error);
          return [] as MatchedRecipe[];
        }
      ),
    ]);

    // İş 1b: fine dining üretimi normal akışla EŞZAMANLI başlar — kısayol
    // tetiklense de tetiklenmese de her yanıtta 2 fine dining tarifi hedeflenir.
    // Başarısızlık normal tarifleri düşürmez (graceful degradation).
    const fineDiningPromise: Promise<Recipe[]> =
      fineDiningMatches.length > 0
        ? generateWithClaude(input, {
            count: CONFIG.fineDiningCount,
            systemPrompt: buildFineDiningSystemPrompt(input, fineDiningMatches),
            category: 'fine-dining',
          }).catch((error) => {
            console.error('[generate-recipe] fine dining üretim hatası:', error);
            return [];
          })
        : Promise.resolve([]);

    // 4) Hibrit kısayol (A5): eşik üstü benzerlik + 0 eksik → normal set için
    //    LLM'siz dönüş (fine dining tarifleri yine eklenir).
    const availableNames = [...inventoryNames, ...(input.pantry ?? [])].map((name) =>
      name.toLowerCase()
    );
    const top = matches[0];
    if (top && top.similarity >= CONFIG.matchThreshold && countMissing(top, availableNames) === 0) {
      const recipe = toDatabaseRecipe(top, availableNames);
      const fineDiningRecipes = await fineDiningPromise;
      return new Response(
        JSON.stringify({
          source: 'database',
          recipes: [recipe, ...fineDiningRecipes],
          retrieval: {
            topSimilarity: top.similarity,
            matchedTitles: matches.map((m) => m.title),
            fineDiningTitles: fineDiningMatches.map((m) => m.title),
          },
        }),
        { headers: { ...CORS_HEADERS, 'content-type': 'application/json' } }
      );
    }

    // 5) LLM üretimi (retrieval bağlamıyla) — fine dining çağrısıyla paralel.
    const [recipes, fineDiningRecipes] = await Promise.all([
      generateWithClaude(input, {
        count: input.count ?? CONFIG.defaultRecipeCount,
        systemPrompt: buildSystemPrompt(input, matches),
      }),
      fineDiningPromise,
    ]);
    if (recipes.length === 0) {
      throw new Error('Tarif üretilemedi');
    }

    return new Response(
      JSON.stringify({
        source: 'llm',
        recipes: [...recipes, ...fineDiningRecipes],
        retrieval: {
          topSimilarity: top?.similarity ?? null,
          matchedTitles: matches.map((m) => m.title),
          fineDiningTitles: fineDiningMatches.map((m) => m.title),
        },
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
