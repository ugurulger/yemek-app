/**
 * Fine dining alt kümesi etiketleme scripti (İş 1a — bkz. README-rag.md).
 *
 * Korpustaki (data/recipes-normalized.jsonl.gz) tariflerden fine dining
 * niteliğinde olanları başlık bazlı kural setiyle seçer (kaynak setin tags
 * alanı yalnızca kaba Allrecipes kategorileri içerir — "french/gourmet" gibi
 * mutfak etiketi YOK, bu yüzden imza yemek adları + teknik terimlerden oluşan
 * bir include listesi ve ev-yemeği/marka gürültüsünü eleyen bir exclude
 * listesi kullanılır; 2026-07-18 ölçümü: 10k havuzda 524 eşleşme, hedef ≥300).
 *
 * İki iş yapar (ikisi de idempotent — script güvenle tekrar çalıştırılabilir):
 *   1. Lokal veri dosyasını günceller: eşleşen tariflerin tags dizisine
 *      'fine-dining' eklenir ve gz dosyası yeniden yazılır — böylece
 *      embed-recipes.ts ileride yeniden çalıştırılırsa (tam upsert) etiket
 *      kaybolmaz.
 *   2. SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY tanımlıysa, Supabase'deki
 *      mevcut satırların tags kolonunu source_id üzerinden PATCH'ler
 *      (yalnızca etiketi henüz olmayan satırlar).
 *
 * Çalıştırma (LOKAL — repo sahibinin makinesinde):
 *   SUPABASE_URL=https://<REF>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
 *   npx tsx scripts/tag-fine-dining.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';

import type { NormalizedRecipe } from './prepare-dataset';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_PATH = join(ROOT, 'data', 'recipes-normalized.jsonl.gz');

/** Edge function'ın match_recipes filtresiyle AYNI değer olmalı. */
export const FINE_DINING_TAG = 'fine-dining';
/** Hedef alt küme boyutu — altına düşülürse script uyarı verir. */
const TARGET_MIN = 300;

/**
 * Fine dining sinyalleri: imza yemekler (Wellington, coq au vin, risotto,
 * crème brûlée...), rafine protein/teknikler (pan-seared, braised, confit,
 * beurre blanc...) ve tipik fine dining malzemeleri (truffle, saffron...).
 */
const INCLUDE_PATTERNS: RegExp[] = [
  /wellington/i, /coq au vin/i, /bourguignon/i, /\bconfit\b/i, /souffl/i,
  /risotto/i, /\btartare?\b/i, /carpaccio/i, /\bscallops?\b/i,
  /lobster (tails?|bisque|thermidor|ravioli|newberg)/i,
  /duck breast|roast(ed)? duck|duck à|duck a l/i,
  /rack of lamb|lamb chops|braised lamb|lamb shanks?/i, /\bveal\b/i,
  /foie gras/i, /bisque/i, /beurre blanc/i, /hollandaise/i,
  /bearnaise|béarnaise/i, /bouillabaisse/i, /cassoulet/i, /niçoise|nicoise/i,
  /demi-?glace/i, /filet mignon/i, /beef tenderloin/i, /osso buco/i,
  /crème brûlée|creme brulee/i, /panna cotta/i, /\bterrine\b/i, /rouladen?\b/i,
  /\bceviche\b/i, /sea bass/i, /halibut/i, /\bahi\b|seared tuna/i, /venison/i,
  /\bquail\b/i, /cornish (game )?hens?/i, /chateaubriand/i, /marsala/i,
  /piccata/i, /francese|française/i, /saltimbocca/i, /gremolata/i,
  /\bgnocchi\b/i, /prosciutto/i, /pork belly/i, /short ribs?/i,
  /balsamic (glaze|reduction)/i, /en croute|en croûte/i, /pan[- ]seared/i,
  /\bpoached (pear|salmon|egg)/i, /\bbraised\b/i, /\bmousse\b/i, /tiramisu/i,
  /ganache/i, /shrimp scampi/i, /paella/i, /ratatouille/i,
  /stuffed (mushrooms|portobello)/i, /wild mushroom/i,
  /truffle[sd]? |truffled|truffle$/i, /saffron/i, /prime rib/i, /crab cakes?/i,
  /oysters rockefeller/i, /\bmussels?\b/i, /wine (sauce|reduction)/i,
  /champagne/i, /cognac|brandy/i, /gorgonzola/i, /roquefort/i, /caprese/i,
  /bruschetta/i, /crostini/i, /\bpolenta\b/i, /\bquiche\b/i, /\bfrittata\b/i,
  /\bgalette\b/i, /stroganoff/i, /florentine/i,
  /\bglazed salmon|cedar planked salmon|salmon en/i, /elegant/i, /gourmet/i,
];

/** Ev-yemeği/pratiklik/marka sinyalleri — fine dining sayılmaz. */
const EXCLUDE_PATTERNS: RegExp[] = [
  /casserole/i, /crock ?pot|slow cooker|instant pot|air fryer/i,
  /\beasy\b|\bsimple\b|\bquick\b|\bbasic\b|\bbest\b/i,
  /mom'?s|grandma|dad'?s|aunt|granny|my\b/i, /\bdip\b/i,
  /sandwich|burger|sliders?/i, /\bwrap\b/i, /pizza/i, /meatloaf/i,
  /mac and cheese|macaroni/i,
  /campbell|velveeta|ritz|bisquick|jell-?o|cool whip|ranch\b/i, /copycat|®/i,
  /leftover/i, /microwave/i, /kids?\b/i, /crackers?\b/i,
  /biscuits?|muffins?|cookies?|pancakes?|waffles?/i, /pot pie|sloppy/i,
  /keto|low[- ]carb/i, /bbq|barbecue/i, /roll-?ups?/i, /fried .* bacon/i,
];

/** Fine dining havuzuna hiç girmeyecek kaba kategoriler. */
const EXCLUDED_CATEGORIES = new Set(['drinks', 'bread', 'trusted-brands-recipes-and-tips']);

export function isFineDining(recipe: Pick<NormalizedRecipe, 'title' | 'tags'>): boolean {
  if (recipe.tags.some((tag) => EXCLUDED_CATEGORIES.has(tag))) return false;
  return (
    INCLUDE_PATTERNS.some((pattern) => pattern.test(recipe.title)) &&
    !EXCLUDE_PATTERNS.some((pattern) => pattern.test(recipe.title))
  );
}

// ---------------------------------------------------------------------------
// Supabase PATCH (embed-recipes.ts ile aynı .env okuma yaklaşımı)
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

const CHUNK_SIZE = 100;

async function patchSupabase(
  tagged: NormalizedRecipe[],
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<void> {
  const headers = {
    'content-type': 'application/json',
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
  };
  let updated = 0;
  let skipped = 0;

  for (let start = 0; start < tagged.length; start += CHUNK_SIZE) {
    const chunk = tagged.slice(start, start + CHUNK_SIZE);
    const idList = chunk.map((recipe) => `"${recipe.source_id}"`).join(',');

    // Mevcut tags'i oku — etiketi zaten olan satırlar atlanır (idempotens).
    const getResponse = await fetch(
      `${supabaseUrl}/rest/v1/recipes?select=source_id,tags&source_id=in.(${idList})`,
      { headers }
    );
    if (!getResponse.ok) {
      throw new Error(`Supabase okuma hatası (${getResponse.status}): ${await getResponse.text()}`);
    }
    const rows = (await getResponse.json()) as { source_id: string; tags: string[] }[];

    for (const row of rows) {
      if (row.tags.includes(FINE_DINING_TAG)) {
        skipped += 1;
        continue;
      }
      const patchResponse = await fetch(
        `${supabaseUrl}/rest/v1/recipes?source_id=eq.${encodeURIComponent(row.source_id)}`,
        {
          method: 'PATCH',
          headers: { ...headers, prefer: 'return=minimal' },
          body: JSON.stringify({ tags: [...row.tags, FINE_DINING_TAG] }),
        }
      );
      if (!patchResponse.ok) {
        throw new Error(
          `Supabase PATCH hatası (${row.source_id}, ${patchResponse.status}): ${await patchResponse.text()}`
        );
      }
      updated += 1;
    }
    console.log(
      `[tag] Supabase: ${Math.min(start + CHUNK_SIZE, tagged.length)}/${tagged.length} işlendi (${updated} güncellendi, ${skipped} zaten etiketli)`
    );
  }
  console.log(`[tag] Supabase BİTTİ — ${updated} satır güncellendi, ${skipped} zaten etiketliydi.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!existsSync(DATA_PATH)) {
    throw new Error(`${DATA_PATH} bulunamadı — önce: npx tsx scripts/prepare-dataset.ts`);
  }
  const recipes = gunzipSync(readFileSync(DATA_PATH))
    .toString('utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as NormalizedRecipe);

  const tagged: NormalizedRecipe[] = [];
  let alreadyTagged = 0;
  for (const recipe of recipes) {
    const hasTag = recipe.tags.includes(FINE_DINING_TAG);
    if (hasTag || isFineDining(recipe)) {
      if (!hasTag) recipe.tags = [...recipe.tags, FINE_DINING_TAG];
      else alreadyTagged += 1;
      tagged.push(recipe);
    }
  }

  console.log(
    `[tag] ${recipes.length} tarif tarandı → ${tagged.length} fine dining (${alreadyTagged} zaten etiketliydi)`
  );
  if (tagged.length < TARGET_MIN) {
    console.warn(
      `[tag] UYARI: fine dining alt kümesi hedefin altında (${tagged.length} < ${TARGET_MIN}) — kural setini genişletmeyi veya ek veri hazırlamayı değerlendirin.`
    );
  }

  // 1) Lokal dosyayı güncelle — ileride embed-recipes.ts yeniden çalıştırılırsa
  //    (tam upsert) 'fine-dining' etiketi kaybolmasın.
  const jsonl = recipes.map((recipe) => JSON.stringify(recipe)).join('\n') + '\n';
  writeFileSync(DATA_PATH, gzipSync(jsonl, { level: 9 }));
  console.log(`[tag] Lokal veri dosyası güncellendi: ${DATA_PATH}`);

  // 2) Supabase'deki mevcut satırları etiketle (env tanımlıysa).
  loadDotEnv();
  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL)?.replace(
    /\/$/,
    ''
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceRoleKey) {
    await patchSupabase(tagged, supabaseUrl, serviceRoleKey);
  } else {
    console.log(
      '[tag] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil — Supabase güncellemesi atlandı.\n' +
        '      Tabloyu etiketlemek için aynı komutu bu env değişkenleriyle çalıştırın.'
    );
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error('[tag] HATA:', error);
    process.exit(1);
  });
}
