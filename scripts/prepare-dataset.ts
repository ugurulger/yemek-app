/**
 * RAG veri seti hazırlama script'i (BLOK A / A1 — bkz. README-rag.md).
 *
 * HuggingFace `Shengtao/recipe` setinden (~32.7k İngilizce Allrecipes tarifi;
 * Food.com HF aynasında malzeme BİRİMLERİ olmadığı, RecipeNLG ise gated
 * olduğu için bu set seçildi) datasets-server rows API'siyle eşit aralıklı
 * sayfalar çekerek ~10.000 tariflik çeşitli bir örneklem oluşturur, alanları
 * normalize eder (title, ingredients[], steps[], prep_time_minutes, servings,
 * tags[], calories), İMPERİAL ölçüleri METRİĞE çevirir (cup/oz → ml/g) ve
 * sonucu gzip'li JSONL olarak `data/recipes-normalized.jsonl.gz`e yazar.
 *
 * Çalıştırma:  npx tsx scripts/prepare-dataset.ts
 * (Yalnızca ağ erişimi gerekir — API anahtarı GEREKMEZ.)
 */
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGzip } from 'node:zlib';

const DATASET = 'Shengtao/recipe';
const ROWS_API = 'https://datasets-server.huggingface.co/rows';
const PAGE_SIZE = 100; // datasets-server üst sınırı
const TARGET_COUNT = 10_000;
/** Filtre kayıplarını telafi etmek için hedefin üzerinde satır taranır. */
const SCAN_COUNT = 14_000;
/** Tek bir kategorinin örneklemi domine etmemesi için üst sınır (çeşitlilik). */
const MAX_PER_CATEGORY = 1_200;

const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'recipes-normalized.jsonl.gz');

// ---------------------------------------------------------------------------
// Normalizasyon: ölçü birimi dönüşümü (imperial → metrik)
// ---------------------------------------------------------------------------

/** Unicode kesir karakterleri → ondalık değer. */
const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};

interface MetricUnit {
  /** 1 birimin metrik karşılığı. */
  factor: number;
  unit: 'g' | 'ml';
}

/**
 * İmperial birim → metrik dönüşüm tablosu (yaygın mutfak yaklaşımları).
 * Anahtarlar tekil, küçük harf; eşleştirmede s/es eki tolere edilir.
 */
const IMPERIAL_UNITS: Record<string, MetricUnit> = {
  cup: { factor: 240, unit: 'ml' },
  tablespoon: { factor: 15, unit: 'ml' },
  teaspoon: { factor: 5, unit: 'ml' },
  'fluid ounce': { factor: 30, unit: 'ml' },
  pint: { factor: 473, unit: 'ml' },
  quart: { factor: 946, unit: 'ml' },
  gallon: { factor: 3785, unit: 'ml' },
  ounce: { factor: 28, unit: 'g' },
  pound: { factor: 454, unit: 'g' },
};

/** Zaten metrik olan birimler — olduğu gibi korunur. */
const METRIC_UNITS = new Set(['g', 'gram', 'kg', 'kilogram', 'ml', 'milliliter', 'millilitre', 'l', 'liter', 'litre']);

/** Sayı+birim taşımayan, adet benzeri kap/parça birimleri (İngilizce kalır). */
const COUNT_UNITS = new Set([
  'can', 'jar', 'bottle', 'package', 'container', 'box', 'bag', 'envelope',
  'slice', 'clove', 'head', 'bunch', 'stalk', 'sprig', 'piece', 'pinch', 'dash', 'stick', 'loaf', 'sheet',
]);

/** "1 ¼", "1 1/2", "½", "3", "1.5" gibi öncü miktar ifadesini sayıya çevirir. */
function parseQuantity(text: string): { qty: number | null; rest: string } {
  let rest = text.replace(/[  ]/g, ' ').trim();
  let qty: number | null = null;

  const consume = (re: RegExp, value: (m: RegExpMatchArray) => number) => {
    const m = rest.match(re);
    if (m) {
      qty = (qty ?? 0) + value(m);
      rest = rest.slice(m[0].length).trim();
      return true;
    }
    return false;
  };

  // tam sayı / ondalık ("3", "1.5") — hemen ardından "/" geliyorsa bu bir
  // kesirdir ("1/2"), tam sayı dalı DEĞİL (negatif lookahead).
  consume(/^(\d+(?:\.\d+)?)(?!\s*\/)\s*/, (m) => Number(m[1]));
  // ascii kesir ("1/2")
  consume(/^(\d+)\s*\/\s*(\d+)\s*/, (m) => Number(m[1]) / Number(m[2]));
  // unicode kesir ("½")
  consume(/^([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])\s*/, (m) => UNICODE_FRACTIONS[m[1]] ?? 0);

  return { qty, rest };
}

function roundMetric(value: number): number {
  if (value >= 100) return Math.round(value / 5) * 5;
  if (value >= 10) return Math.round(value);
  return Math.round(value * 10) / 10;
}

/** "pounds"→"pound", "boxes"→"box", "slices"→"slice" tekil adayları sırayla dener. */
function singularCandidates(word: string): string[] {
  const lower = word.toLowerCase();
  return [lower, lower.replace(/s$/, ''), lower.replace(/es$/, '')];
}

function lookupImperial(word: string): MetricUnit | undefined {
  for (const candidate of singularCandidates(word)) {
    if (IMPERIAL_UNITS[candidate]) return IMPERIAL_UNITS[candidate];
  }
  return undefined;
}

/** Verilen birim kümesinde tekil adaylardan ilk eşleşeni döndürür. */
function matchUnitSet(word: string, set: Set<string>): string | null {
  for (const candidate of singularCandidates(word)) {
    if (set.has(candidate)) return candidate;
  }
  return null;
}

export interface NormalizedIngredient {
  /** Metriğe çevrilmiş, insan okunur tam satır ("450 g spiral pasta"). */
  text: string;
  /** Çıplak malzeme adı (miktar/birim/açıklama sıyrılmış) — eşleştirme için. */
  name: string;
  qty: number | null;
  /** Metrik ("g"/"ml"), adet benzeri kap adı ("can") veya null (birimsiz). */
  unit: string | null;
}

/**
 * Tek bir İngilizce malzeme satırını ("1 pound pasta", "2 (14 ounce) cans
 * chicken broth", "½ cup milk, divided") metrik birime çevirip yapılandırır.
 */
export function normalizeIngredient(raw: string): NormalizedIngredient | null {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;

  const { qty, rest } = parseQuantity(cleaned);
  let remainder = rest;
  let qtyOut: number | null = qty;
  let unitOut: string | null = null;

  // Parantezli boyut: "(14 ounce) can" → kap boyutunu metriğe çevirip koru.
  let parenNote: string | null = null;
  const paren = remainder.match(/^\(([^)]+)\)\s*/);
  if (paren) {
    const inner = parseQuantity(paren[1]);
    const unitWord = inner.rest.match(/^([a-zA-Z ]+)/)?.[1]?.trim() ?? '';
    const metric = lookupImperial(unitWord);
    parenNote =
      inner.qty !== null && metric
        ? `(${roundMetric(inner.qty * metric.factor)} ${metric.unit})`
        : `(${paren[1]})`;
    remainder = remainder.slice(paren[0].length).trim();
  }

  // Öncü birim kelimesi ("pound", "cups", "fluid ounces", "can"...)
  const unitMatch = remainder.match(/^([a-zA-Z]+(?: ounces?)?)\s+/);
  if (unitMatch) {
    const word = unitMatch[1];
    const metric = lookupImperial(word);
    const metricName = matchUnitSet(word, METRIC_UNITS);
    const countName = matchUnitSet(word, COUNT_UNITS);
    if (metric && qty !== null) {
      qtyOut = roundMetric(qty * metric.factor);
      unitOut = metric.unit;
      remainder = remainder.slice(unitMatch[0].length).trim();
    } else if (metricName && qty !== null) {
      unitOut =
        metricName === 'gram' || metricName === 'kilogram'
          ? metricName === 'kilogram'
            ? 'kg'
            : 'g'
          : metricName.startsWith('millilit')
            ? 'ml'
            : metricName === 'liter' || metricName === 'litre'
              ? 'l'
              : metricName;
      remainder = remainder.slice(unitMatch[0].length).trim();
    } else if (countName) {
      unitOut = countName;
      remainder = remainder.slice(unitMatch[0].length).trim();
    }
  }

  // Çıplak ad: virgül sonrası hazırlık notunu at ("tomatoes, diced" → "tomatoes").
  const name = remainder.split(',')[0].replace(/\s+/g, ' ').trim().toLowerCase();
  if (!name) return null;

  const parts: string[] = [];
  if (qtyOut !== null) parts.push(String(qtyOut));
  if (unitOut) parts.push(unitOut);
  if (parenNote) parts.push(parenNote);
  parts.push(remainder);

  return { text: parts.join(' '), name, qty: qtyOut, unit: unitOut };
}

/** "1 hr 25 mins" / "20 mins" → dakika (tam sayı) veya null. */
export function parseDurationMinutes(text: string | null | undefined): number | null {
  if (!text) return null;
  const hr = text.match(/(\d+)\s*(?:hrs?|hours?)/i);
  const min = text.match(/(\d+)\s*(?:mins?|minutes?)/i);
  const day = text.match(/(\d+)\s*(?:days?)/i);
  if (!hr && !min && !day) return null;
  return (
    (day ? Number(day[1]) * 1440 : 0) + (hr ? Number(hr[1]) * 60 : 0) + (min ? Number(min[1]) : 0)
  );
}

/** Yönergeleri adım listesine böler: önce satır sonları, sonra cümle sınırları. */
export function splitSteps(directions: string): string[] {
  const blocks = directions
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean);
  const steps: string[] = [];
  for (const block of blocks) {
    // Cümle sınırı: nokta + boşluk + büyük harf (kısaltma riskini azaltır).
    const sentences = block.split(/(?<=\.)\s+(?=[A-Z])/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 0) steps.push(trimmed);
    }
  }
  return steps;
}

// ---------------------------------------------------------------------------
// İndirme + örnekleme
// ---------------------------------------------------------------------------

interface SourceRow {
  title: string;
  category: string | null;
  ingredients: string;
  directions: string;
  prep_time: string | null;
  total_time: string | null;
  servings: number | null;
  calories: number | null;
  url: string | null;
}

/** datasets-server hız sınırına (429) saygılı sayfa çekimi: sayfalar arası
 * sabit bekleme main'de; burada 429'da Retry-After / uzun backoff uygulanır. */
async function fetchPage(offset: number, length: number, attempt = 0): Promise<SourceRow[]> {
  const url = `${ROWS_API}?dataset=${encodeURIComponent(DATASET)}&config=default&split=train&offset=${offset}&length=${length}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 20_000;
        throw Object.assign(new Error('HTTP 429'), { waitMs });
      }
      throw new Error(`HTTP ${response.status}`);
    }
    const data = (await response.json()) as { rows: { row: SourceRow }[] };
    return data.rows.map((entry) => entry.row);
  } catch (error) {
    if (attempt >= 8) throw error;
    const suggested = (error as { waitMs?: number }).waitMs;
    const backoff = suggested ?? 1000 * 2 ** attempt;
    console.warn(`[prepare] offset=${offset} hata (${String(error)}), ${backoff}ms sonra tekrar...`);
    await new Promise((resolve) => setTimeout(resolve, backoff));
    return fetchPage(offset, length, attempt + 1);
  }
}

/** Sayfalar arası nazik bekleme — 429'a hiç düşmemek ana strateji. */
const PAGE_DELAY_MS = 800;

async function fetchTotalRows(): Promise<number> {
  const response = await fetch(
    `https://datasets-server.huggingface.co/size?dataset=${encodeURIComponent(DATASET)}`
  );
  if (!response.ok) throw new Error(`size API hatası: HTTP ${response.status}`);
  const data = (await response.json()) as { size: { dataset: { num_rows: number } } };
  return data.size.dataset.num_rows;
}

export interface NormalizedRecipe {
  /** Kaynak veri setindeki benzersiz kimlik (resume/upsert anahtarı). */
  source_id: string;
  title: string;
  ingredients: NormalizedIngredient[];
  steps: string[];
  prep_time_minutes: number | null;
  servings: number | null;
  tags: string[];
  calories: number | null;
  source: string;
}

function normalizeRow(row: SourceRow, index: number): NormalizedRecipe | null {
  const title = row.title?.trim();
  if (!title || !row.ingredients || !row.directions) return null;

  const ingredients = row.ingredients
    .split(';')
    .map((entry) => normalizeIngredient(entry))
    .filter((entry): entry is NormalizedIngredient => entry !== null);
  const steps = splitSteps(row.directions);
  if (ingredients.length < 2 || steps.length < 2) return null;

  // Uygulamanın time_min alanı toplam süredir — total_time öncelikli.
  const minutes = parseDurationMinutes(row.total_time) ?? parseDurationMinutes(row.prep_time);

  return {
    source_id: `allrecipes-${index}`,
    title,
    ingredients,
    steps,
    prep_time_minutes: minutes,
    servings: typeof row.servings === 'number' && row.servings > 0 ? Math.round(row.servings) : null,
    tags: row.category ? [row.category] : [],
    calories: typeof row.calories === 'number' && row.calories > 0 ? Math.round(row.calories) : null,
    source: 'huggingface:Shengtao/recipe',
  };
}

async function main() {
  const totalRows = await fetchTotalRows();
  console.log(`[prepare] kaynak set: ${DATASET}, toplam ${totalRows} satır`);

  // Eşit aralıklı sayfa başlangıçları — set kategori sıralı olsa bile
  // örneklem tüm aralığa yayılır (çeşitlilik).
  const pageCount = Math.ceil(SCAN_COUNT / PAGE_SIZE);
  const stride = Math.max(PAGE_SIZE, Math.floor(totalRows / pageCount));
  const offsets = Array.from({ length: pageCount }, (_, i) => Math.min(i * stride, totalRows - PAGE_SIZE));

  await mkdir(dirname(OUT_PATH), { recursive: true });
  const gzip = createGzip({ level: 9 });
  const out = createWriteStream(OUT_PATH);
  gzip.pipe(out);

  const seenTitles = new Set<string>();
  const perCategory = new Map<string, number>();
  let kept = 0;
  let scanned = 0;

  for (const offset of offsets) {
    if (kept >= TARGET_COUNT) break;
    const rows = await fetchPage(offset, PAGE_SIZE);
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
    for (const [i, row] of rows.entries()) {
      scanned += 1;
      if (kept >= TARGET_COUNT) break;

      const normalized = normalizeRow(row, offset + i);
      if (!normalized) continue;

      const titleKey = normalized.title.toLowerCase();
      if (seenTitles.has(titleKey)) continue;

      const category = normalized.tags[0] ?? 'uncategorized';
      const categoryCount = perCategory.get(category) ?? 0;
      if (categoryCount >= MAX_PER_CATEGORY) continue;

      seenTitles.add(titleKey);
      perCategory.set(category, categoryCount + 1);
      gzip.write(`${JSON.stringify(normalized)}\n`);
      kept += 1;
    }
    if (scanned % 1000 === 0 || kept >= TARGET_COUNT) {
      console.log(`[prepare] taranan=${scanned}, tutulan=${kept}`);
    }
  }

  await new Promise<void>((resolve, reject) => {
    gzip.end();
    out.on('finish', () => resolve());
    out.on('error', reject);
  });

  console.log(`[prepare] BİTTİ — ${kept} tarif → ${OUT_PATH}`);
  console.log(`[prepare] kategori dağılımı (ilk 15):`);
  const sorted = [...perCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  for (const [category, count] of sorted) console.log(`  ${category}: ${count}`);
}

// Script doğrudan çalıştırıldığında main; testler normalize fonksiyonlarını
// import edebilsin diye koşullu.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('[prepare] HATA:', error);
    process.exit(1);
  });
}
