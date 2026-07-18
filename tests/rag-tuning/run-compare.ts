/**
 * RAG vs iki aşamalı yol karşılaştırma harness'i (RAG ince ayar session'ı).
 *
 * Koşum (repo kökünden; .env üst dizinlerde aranır — worktree'de ana repo
 * .env'i bulunur):
 *   npx tsx tests/rag-tuning/run-compare.ts --paths rag,two --runs 2 \
 *     --inventories tr12,en8 --label baseline [--out <dizin>]
 *
 * Ne yapar: iki temsili envanteri (12 ürünlük TR + 8 ürünlük EN) her iki
 * üretim yolundan GERÇEK API ile geçirir ve uygulamanın gördüğü haliyle
 * (client reconciliation + canlı computeMissing, iki dilli genişletme)
 * katman dağılımı / çeşitlilik / süre metriklerini toplar. Ham sonuç JSON'u
 * --out dizinine yazılır; stdout'a kompakt özet basılır.
 *
 * RAG yolu client davranışının birebir kopyasıdır (lib/rag/generateRecipesRag):
 * envanter nameEn, kiler statik EN çeviri, language: "English"; yanıt
 * applyInventoryReconciliation'dan geçirilir. İki aşamalı yol doğrudan
 * generateRecipesTwoPhase'i çağırır (TR envanterde Turkish, EN'de English).
 * Anthropic usage token'ları fetch sarmalanarak (monkey-patch) toplanır.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import {
  applyInventoryReconciliation,
  generateRecipesTwoPhase,
  mergeRecipeLayers,
  PANTRY_STAPLES,
} from '../../lib/claude/generateRecipes';
import { findInventoryMatch } from '../../lib/recipes/ingredient-match';
import { computeMissing } from '../../lib/recipes/recipe-math';
import { EMPTY_PREFERENCES } from '../../types/preferences';

import type { InventoryItem } from '../../types/inventory';
import type { Recipe } from '../../types/recipe';

// ---------------------------------------------------------------------------
// .env yükleme — cwd'den yukarı doğru ilk .env (worktree → ana repo)
// ---------------------------------------------------------------------------

function loadEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const file = join(dir, '.env');
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (match && process.env[match[1]] === undefined) {
          process.env[match[1]] = match[2];
        }
      }
      console.log(`[env] yüklendi: ${file}`);
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  console.warn('[env] .env bulunamadı — mevcut process env ile devam');
}

// ---------------------------------------------------------------------------
// Temsili envanterler + kiler (iki dilli)
// ---------------------------------------------------------------------------

function inv(
  id: string,
  nameTr: string,
  nameEn: string,
  qty: number,
  unit: InventoryItem['unit'],
  primary: 'tr' | 'en'
): InventoryItem {
  return { id, name: primary === 'tr' ? nameTr : nameEn, nameTr, nameEn, qty, unit };
}

/** 12 ürünlük TR envanter — TR modda taranmış gerçekçi buzdolabı. */
const TR12: InventoryItem[] = [
  inv('t1', 'Domates', 'Tomato', 4, 'adet', 'tr'),
  inv('t2', 'Yumurta', 'Eggs', 10, 'adet', 'tr'),
  inv('t3', 'Beyaz Peynir', 'Feta Cheese', 200, 'g', 'tr'),
  inv('t4', 'Tavuk Göğsü', 'Chicken Breast', 500, 'g', 'tr'),
  inv('t5', 'Patates', 'Potatoes', 6, 'adet', 'tr'),
  inv('t6', 'Yoğurt', 'Yogurt', 500, 'g', 'tr'),
  inv('t7', 'Süt', 'Milk', 1, 'l', 'tr'),
  inv('t8', 'Kıyma', 'Ground Beef', 400, 'g', 'tr'),
  inv('t9', 'Kabak', 'Zucchini', 2, 'adet', 'tr'),
  inv('t10', 'Havuç', 'Carrot', 3, 'adet', 'tr'),
  inv('t11', 'Limon', 'Lemon', 2, 'adet', 'tr'),
  inv('t12', 'Mantar', 'Mushrooms', 250, 'g', 'tr'),
];

/** 8 ürünlük EN envanter — EN modda eklenmiş kullanıcı (nameTr backfill'li). */
const EN8: InventoryItem[] = [
  inv('e1', 'Somon Fileto', 'Salmon Fillet', 300, 'g', 'en'),
  inv('e2', 'Ispanak', 'Spinach', 250, 'g', 'en'),
  inv('e3', 'Krema', 'Heavy Cream', 200, 'ml', 'en'),
  inv('e4', 'Parmesan', 'Parmesan', 100, 'g', 'en'),
  inv('e5', 'Çeri Domates', 'Cherry Tomatoes', 250, 'g', 'en'),
  inv('e6', 'Yumurta', 'Eggs', 6, 'adet', 'en'),
  inv('e7', 'Patates', 'Potatoes', 4, 'adet', 'en'),
  inv('e8', 'Kırmızı Biber', 'Red Bell Pepper', 2, 'adet', 'en'),
];

/** PANTRY_STAPLES'ın statik EN karşılıkları (src/i18n en.json pantryItem.*
 * etiketleriyle aynı — i18n Node'da import edilemediği için kopya). */
const PANTRY_BILINGUAL: { tr: string; en: string }[] = [
  { tr: 'tuz', en: 'Salt' },
  { tr: 'karabiber', en: 'Black Pepper' },
  { tr: 'pul biber', en: 'Chili Flakes' },
  { tr: 'kimyon', en: 'Cumin' },
  { tr: 'kekik', en: 'Thyme' },
  { tr: 'nane', en: 'Mint' },
  { tr: 'toz kırmızı biber', en: 'Paprika' },
  { tr: 'sıvı yağ', en: 'Cooking Oil' },
  { tr: 'zeytinyağı', en: 'Olive Oil' },
  { tr: 'tereyağı', en: 'Butter' },
  { tr: 'un', en: 'Flour' },
  { tr: 'şeker', en: 'Sugar' },
  { tr: 'su', en: 'Water' },
  { tr: 'sirke', en: 'Vinegar' },
  { tr: 'salça', en: 'Tomato Paste' },
  { tr: 'soğan', en: 'Onion' },
  { tr: 'sarımsak', en: 'Garlic' },
  { tr: 'makarna', en: 'Pasta' },
  { tr: 'pirinç', en: 'Rice' },
  { tr: 'bulgur', en: 'Bulgur' },
];

const INVENTORIES: Record<string, { items: InventoryItem[]; appLanguage: 'tr' | 'en' }> = {
  tr12: { items: TR12, appLanguage: 'tr' },
  en8: { items: EN8, appLanguage: 'en' },
};

// ---------------------------------------------------------------------------
// Metrik yardımcıları
// ---------------------------------------------------------------------------

interface RecipeMetric {
  name: string;
  source?: string;
  fineDining: boolean;
  reconciledMissing: number;
  liveMissing: number;
  liveMissingNames: string[];
  timeMin: number;
  servings: number;
  kcal: number;
  nutritionTag: string;
  ingredientCount: number;
  /** Tarifin kullandığı FARKLI envanter ürünü sayısı (ready zenginlik ölçüsü). */
  inventoryUsed: number;
  topIngredients: string[];
  stepCount: number;
}

/** Uygulamanın CANLI rozet hesabı: iki dilli genişletilmiş envanter + kiler. */
function liveMissingFor(recipe: Recipe, items: InventoryItem[]): string[] {
  const expandedInventory = items.flatMap((item) =>
    [item.name, item.nameTr, item.nameEn]
      .filter((n): n is string => typeof n === 'string' && n.length > 0)
      .map((name) => ({ name }))
  );
  const expandedPantry = PANTRY_BILINGUAL.flatMap((p) => [
    { name: p.tr, active: true },
    { name: p.en, active: true },
  ]);
  return computeMissing(recipe, expandedInventory, expandedPantry).map((i) => i.name);
}

function toMetric(recipe: Recipe, items: InventoryItem[]): RecipeMetric {
  const liveNames = liveMissingFor(recipe, items);
  const usedIds = new Set(
    recipe.ingredients
      .map((ingredient) => findInventoryMatch(ingredient.name, items)?.id)
      .filter((id): id is string => typeof id === 'string')
  );
  return {
    name: recipe.name,
    source: (recipe as { source?: string }).source,
    fineDining: recipe.category === 'fine-dining',
    reconciledMissing: recipe.missing_count,
    liveMissing: liveNames.length,
    liveMissingNames: liveNames,
    timeMin: recipe.time_min,
    servings: recipe.servings,
    kcal: recipe.kcal,
    nutritionTag: recipe.nutrition_tag,
    ingredientCount: recipe.ingredients.length,
    inventoryUsed: usedIds.size,
    topIngredients: recipe.ingredients.slice(0, 5).map((i) => i.name),
    stepCount: recipe.steps.length,
  };
}

function layerDist(metrics: RecipeMetric[]): { ready: number; close: number; few: number } {
  const normal = metrics.filter((m) => !m.fineDining);
  return {
    ready: normal.filter((m) => m.liveMissing === 0).length,
    close: normal.filter((m) => m.liveMissing >= 1 && m.liveMissing <= 2).length,
    few: normal.filter((m) => m.liveMissing >= 3).length,
  };
}

// ---------------------------------------------------------------------------
// Anthropic usage yakalama (iki aşamalı yol) — fetch monkey-patch
// ---------------------------------------------------------------------------

interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  stopReasons: Record<string, number>;
}

function freshUsage(): UsageTotals {
  return {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    stopReasons: {},
  };
}

let usageSink: UsageTotals | null = null;

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const response = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (usageSink && url.includes('api.anthropic.com') && response.ok) {
    const clone = response.clone();
    try {
      const data = (await clone.json()) as {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
          cache_creation_input_tokens?: number;
          cache_read_input_tokens?: number;
        };
        stop_reason?: string;
      };
      usageSink.calls += 1;
      usageSink.inputTokens += data.usage?.input_tokens ?? 0;
      usageSink.outputTokens += data.usage?.output_tokens ?? 0;
      usageSink.cacheCreationTokens += data.usage?.cache_creation_input_tokens ?? 0;
      usageSink.cacheReadTokens += data.usage?.cache_read_input_tokens ?? 0;
      const reason = data.stop_reason ?? 'unknown';
      usageSink.stopReasons[reason] = (usageSink.stopReasons[reason] ?? 0) + 1;
    } catch {
      // usage okunamazsa ölçüm sessizce eksik kalır — akışı bozma
    }
  }
  return response;
}) as typeof fetch;

// ---------------------------------------------------------------------------
// RAG yolu (client davranışının kopyası)
// ---------------------------------------------------------------------------

interface RunResult {
  path: 'rag' | 'two';
  inventory: string;
  run: number;
  durationS: number;
  source?: string;
  retrieval?: unknown;
  /** Edge yanıtındaki generation metası (madde 5: stop_reason + usage). */
  generation?: unknown;
  usage?: UsageTotals;
  layerDist: { ready: number; close: number; few: number };
  fineDiningCount: number;
  recipeCount: number;
  metrics: RecipeMetric[];
  error?: string;
}

async function runRag(inventoryKey: string, runIndex: number): Promise<RunResult> {
  const { items } = INVENTORIES[inventoryKey];
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

  const payload = {
    inventory: items.map((item) => ({ name: item.nameEn ?? item.name, qty: item.qty, unit: item.unit })),
    preferences: [] as string[],
    pantry: PANTRY_BILINGUAL.map((p) => p.en),
    language: 'English',
    count: 6,
  };

  const t0 = performance.now();
  const response = await originalFetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/generate-recipe`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as {
    source?: string;
    recipes?: Recipe[];
    retrieval?: unknown;
    generation?: unknown;
    error?: string;
  };
  const durationS = (performance.now() - t0) / 1000;

  if (!response.ok || !Array.isArray(data.recipes)) {
    return {
      path: 'rag',
      inventory: inventoryKey,
      run: runIndex,
      durationS,
      layerDist: { ready: 0, close: 0, few: 0 },
      fineDiningCount: 0,
      recipeCount: 0,
      metrics: [],
      error: `HTTP ${response.status}: ${data.error ?? 'bilinmeyen'}`,
    };
  }

  // Client katmanının birebir kopyası (generateRecipesRag.ts)
  const withLanguage = data.recipes.map((recipe) =>
    applyInventoryReconciliation({ ...recipe, language: 'en' }, items, 'en')
  );
  const fineDining = withLanguage.filter((r) => r.category === 'fine-dining');
  const normal = withLanguage.filter((r) => r.category !== 'fine-dining');
  const finalList = [...mergeRecipeLayers([normal]), ...fineDining];

  const metrics = finalList.map((r) => toMetric(r, items));
  return {
    path: 'rag',
    inventory: inventoryKey,
    run: runIndex,
    durationS,
    source: data.source,
    retrieval: data.retrieval,
    generation: data.generation,
    layerDist: layerDist(metrics),
    fineDiningCount: fineDining.length,
    recipeCount: finalList.length,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// İki aşamalı yol
// ---------------------------------------------------------------------------

async function runTwoPhase(inventoryKey: string, runIndex: number): Promise<RunResult> {
  const { items, appLanguage } = INVENTORIES[inventoryKey];
  const activePantryNames =
    appLanguage === 'tr' ? [...PANTRY_STAPLES] : PANTRY_BILINGUAL.map((p) => p.en);

  usageSink = freshUsage();
  const t0 = performance.now();
  let recipes: Recipe[];
  try {
    recipes = await generateRecipesTwoPhase(items, {
      preferences: EMPTY_PREFERENCES,
      activePantryNames,
      outputLanguage: appLanguage === 'tr' ? 'Turkish' : 'English',
    });
  } catch (error) {
    const usage = usageSink;
    usageSink = null;
    return {
      path: 'two',
      inventory: inventoryKey,
      run: runIndex,
      durationS: (performance.now() - t0) / 1000,
      usage: usage ?? undefined,
      layerDist: { ready: 0, close: 0, few: 0 },
      fineDiningCount: 0,
      recipeCount: 0,
      metrics: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const durationS = (performance.now() - t0) / 1000;
  const usage = usageSink;
  usageSink = null;

  const metrics = recipes.map((r) => toMetric(r, items));
  return {
    path: 'two',
    inventory: inventoryKey,
    run: runIndex,
    durationS,
    usage: usage ?? undefined,
    layerDist: layerDist(metrics),
    fineDiningCount: metrics.filter((m) => m.fineDining).length,
    recipeCount: recipes.length,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function argValue(flag: string, fallback: string): string {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function main(): Promise<void> {
  loadEnv();
  const paths = argValue('--paths', 'rag,two').split(',') as ('rag' | 'two')[];
  const runs = Number(argValue('--runs', '2'));
  const inventories = argValue('--inventories', 'tr12,en8').split(',');
  const label = argValue('--label', 'run');
  const outDir = resolve(argValue('--out', 'tests/rag-tuning/results'));
  mkdirSync(outDir, { recursive: true });

  const results: RunResult[] = [];
  for (const inventoryKey of inventories) {
    for (const path of paths) {
      for (let run = 1; run <= runs; run++) {
        const tag = `${path}/${inventoryKey}#${run}`;
        console.log(`\n▶ ${tag} başlıyor...`);
        try {
          const result = path === 'rag' ? await runRag(inventoryKey, run) : await runTwoPhase(inventoryKey, run);
          results.push(result);
          const d = result.layerDist;
          console.log(
            `✔ ${tag}: ${result.durationS.toFixed(1)}s, ${result.recipeCount} tarif ` +
              `(FD ${result.fineDiningCount}), katman ready=${d.ready}/close=${d.close}/few=${d.few}` +
              (result.error ? ` HATA: ${result.error}` : '')
          );
          for (const m of result.metrics) {
            console.log(
              `   - ${m.fineDining ? '✦ ' : ''}${m.name} | live eksik=${m.liveMissing}` +
                (m.liveMissing > 0 ? ` (${m.liveMissingNames.join(', ')})` : '') +
                ` | rec eksik=${m.reconciledMissing} | ${m.timeMin}dk | ${m.ingredientCount} malzeme | env ${m.inventoryUsed}`
            );
          }
          if (result.generation) {
            console.log(`   generation: ${JSON.stringify(result.generation)}`);
          }
          if (result.usage) {
            console.log(
              `   usage: ${result.usage.calls} çağrı, in=${result.usage.inputTokens} out=${result.usage.outputTokens} ` +
                `cacheW=${result.usage.cacheCreationTokens} cacheR=${result.usage.cacheReadTokens} ` +
                `stop=${JSON.stringify(result.usage.stopReasons)}`
            );
          }
        } catch (error) {
          console.error(`✖ ${tag} beklenmedik hata:`, error);
          results.push({
            path,
            inventory: inventoryKey,
            run,
            durationS: 0,
            layerDist: { ready: 0, close: 0, few: 0 },
            fineDiningCount: 0,
            recipeCount: 0,
            metrics: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }

  const outFile = join(outDir, `${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n[out] ham sonuçlar: ${outFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
