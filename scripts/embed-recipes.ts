/**
 * RAG embedding yükleme script'i (BLOK A / A3 — bkz. README-rag.md).
 *
 * `data/recipes-normalized.jsonl.gz` içindeki tarifler için "title +
 * ingredients" birleşiminden Gemini embedding'i üretir
 * (gemini-embedding-001, 768 boyut, L2-normalize) ve tarifleri
 * embedding'leriyle birlikte Supabase `recipes` tablosuna upsert eder
 * (on_conflict=source_id — aynı script güvenle tekrar çalıştırılabilir).
 *
 * Batch'ler halinde işler ve her başarılı batch'ten sonra
 * `data/.embed-checkpoint.json`a ilerlemeyi yazar — yarıda kesilirse aynı
 * komutla KALDIĞI YERDEN devam eder (resume). Baştan başlamak için checkpoint
 * dosyasını silin.
 *
 * Çalıştırma (LOKAL — bu script repo sahibinin makinesinde elle çalıştırılır):
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/embed-recipes.ts
 * Gemini anahtarı .env'deki EXPO_PUBLIC_GOOGLE_API_KEY'den (veya
 * GOOGLE_API_KEY env değişkeninden) okunur.
 */
import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import type { NormalizedRecipe } from './prepare-dataset';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = join(ROOT, 'data', 'recipes-normalized.jsonl.gz');
const CHECKPOINT_PATH = join(ROOT, 'data', '.embed-checkpoint.json');

const EMBEDDING_MODEL = 'gemini-embedding-001';
/** Migration'daki vector(768) ile BİRLİKTE değişmeli. */
export const EMBEDDING_DIMENSIONS = 768;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 300;
const MAX_RETRIES = 5;

// ---------------------------------------------------------------------------
// Ortam: .env'i elle oku (dotenv bağımlılığı eklemeden — script Node'da çalışır).
// ---------------------------------------------------------------------------

function loadDotEnv(): void {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

interface Config {
  googleApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

function readConfig(): Config {
  loadDotEnv();
  const googleApiKey = process.env.GOOGLE_API_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing: string[] = [];
  if (!googleApiKey) missing.push('GOOGLE_API_KEY (veya .env: EXPO_PUBLIC_GOOGLE_API_KEY)');
  if (!supabaseUrl) missing.push('SUPABASE_URL (veya .env: EXPO_PUBLIC_SUPABASE_URL)');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length > 0) {
    throw new Error(`Eksik ortam değişkenleri:\n  - ${missing.join('\n  - ')}`);
  }
  return {
    googleApiKey: googleApiKey!,
    supabaseUrl: supabaseUrl!.replace(/\/$/, ''),
    supabaseServiceRoleKey: supabaseServiceRoleKey!,
  };
}

// ---------------------------------------------------------------------------
// Veri + checkpoint
// ---------------------------------------------------------------------------

function loadRecipes(): NormalizedRecipe[] {
  if (!existsSync(DATA_PATH)) {
    throw new Error(
      `${DATA_PATH} bulunamadı — önce veri setini hazırlayın: npx tsx scripts/prepare-dataset.ts`
    );
  }
  const jsonl = gunzipSync(readFileSync(DATA_PATH)).toString('utf8');
  return jsonl
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as NormalizedRecipe);
}

interface Checkpoint {
  /** Başarıyla upsert edilen (sıralı) tarif sayısı — bir sonraki başlangıç index'i. */
  completed: number;
}

function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_PATH)) return { completed: 0 };
  try {
    const parsed = JSON.parse(readFileSync(CHECKPOINT_PATH, 'utf8')) as Checkpoint;
    return { completed: Number.isInteger(parsed.completed) && parsed.completed > 0 ? parsed.completed : 0 };
  } catch {
    return { completed: 0 };
  }
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(checkpoint));
}

// ---------------------------------------------------------------------------
// Embedding + upsert
// ---------------------------------------------------------------------------

/** Embedding'e giren metin: title + malzeme adları (bkz. Blok A / A3 kararı).
 * Edge function'daki sorgu metniyle AYNI mantık ailesi — retrieval tutarlılığı. */
export function embeddingTextFor(recipe: Pick<NormalizedRecipe, 'title' | 'ingredients'>): string {
  const names = recipe.ingredients.map((ingredient) => ingredient.name).join(', ');
  return `${recipe.title}\nIngredients: ${names}`;
}

/** outputDimensionality < 3072 kesildiğinde Gemini vektörleri normalize DÖNMEZ —
 * cosine benzerliğin anlamlı olması için L2-normalize şart (Gemini dokümantasyonu). */
function l2Normalize(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vector;
  return vector.map((v) => v / norm);
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_RETRIES) throw error;
      const backoff = 1500 * 2 ** attempt;
      console.warn(`[embed] ${label} hata (${String(error)}) — ${backoff}ms sonra tekrar (${attempt + 1}/${MAX_RETRIES})`);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
}

async function embedBatch(ai: GoogleGenAI, texts: string[]): Promise<number[][]> {
  const response = await withRetry('embedContent', () =>
    ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: texts,
      config: { taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: EMBEDDING_DIMENSIONS },
    })
  );
  const embeddings = response.embeddings ?? [];
  if (embeddings.length !== texts.length) {
    throw new Error(`Beklenen ${texts.length} embedding, gelen ${embeddings.length}`);
  }
  return embeddings.map((embedding, i) => {
    const values = embedding.values ?? [];
    if (values.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(`Embedding ${i}: beklenen boyut ${EMBEDDING_DIMENSIONS}, gelen ${values.length}`);
    }
    return l2Normalize(values);
  });
}

async function upsertBatch(
  config: Config,
  recipes: NormalizedRecipe[],
  embeddings: number[][]
): Promise<void> {
  const rows = recipes.map((recipe, i) => ({
    source_id: recipe.source_id,
    title: recipe.title,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    prep_time_minutes: recipe.prep_time_minutes,
    servings: recipe.servings,
    tags: recipe.tags,
    calories: recipe.calories,
    source: recipe.source,
    // pgvector text formatı: "[0.1,0.2,...]"
    embedding: `[${embeddings[i].join(',')}]`,
  }));

  await withRetry('supabase upsert', async () => {
    const response = await fetch(`${config.supabaseUrl}/rest/v1/recipes?on_conflict=source_id`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: config.supabaseServiceRoleKey,
        authorization: `Bearer ${config.supabaseServiceRoleKey}`,
        prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase upsert hatası (${response.status}): ${detail.slice(0, 300)}`);
    }
  });
}

async function main() {
  const config = readConfig();
  const ai = new GoogleGenAI({ apiKey: config.googleApiKey });

  const recipes = loadRecipes();
  const checkpoint = loadCheckpoint();
  console.log(
    `[embed] ${recipes.length} tarif yüklendi; checkpoint=${checkpoint.completed} (kalan ${recipes.length - checkpoint.completed})`
  );
  if (checkpoint.completed >= recipes.length) {
    console.log('[embed] Yapılacak iş yok — tüm tarifler zaten işlenmiş.');
    return;
  }

  const tStart = Date.now();
  for (let start = checkpoint.completed; start < recipes.length; start += BATCH_SIZE) {
    const batch = recipes.slice(start, start + BATCH_SIZE);
    const embeddings = await embedBatch(ai, batch.map(embeddingTextFor));
    await upsertBatch(config, batch, embeddings);

    const completed = start + batch.length;
    saveCheckpoint({ completed });

    const elapsed = (Date.now() - tStart) / 1000;
    const processedThisRun = completed - checkpoint.completed;
    const rate = processedThisRun / Math.max(elapsed, 1);
    const remaining = recipes.length - completed;
    const etaMin = remaining / Math.max(rate, 0.01) / 60;
    console.log(
      `[embed] ${completed}/${recipes.length} (%${((completed / recipes.length) * 100).toFixed(1)}) — ` +
        `${rate.toFixed(1)} tarif/sn, kalan ~${etaMin.toFixed(1)} dk`
    );

    await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
  }

  console.log(`[embed] BİTTİ — ${recipes.length} tarif embedding'leriyle Supabase'e yazıldı.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('[embed] HATA:', error);
    process.exit(1);
  });
}
