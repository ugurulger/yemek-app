/**
 * Eşleştirme motoru doğruluk eval'i (30 temsili malzeme, canlı mağaza
 * API'leri + gerçek Haiku çağrıları).
 * Koşum: npx tsx tests/match-eval/run-eval.ts
 *
 * İki koşu yapar:
 *  1. SOĞUK — cache boş (tests/match-eval/cache.json silinmişse) veya
 *     mevcut haliyle: katman dağılımı, doğruluk, LLM maliyeti raporlanır.
 *  2. SICAK — hemen ardından aynı liste: Tier-0 isabetleri ve malzeme
 *     başına LLM çağrısı ölçülür (hedef <0.2; cache dolunca ~0).
 *
 * Doğruluk ölçütü: mağaza eşleşmesinin ürün adı, malzemenin beklenen
 * anahtar kelimelerinden en az birini içeriyor mu (hücre bazında;
 * 30 malzeme × 2 mağaza = 60 hücre). Hedef: ≥%85.
 *
 * Cache sıfırlama: tests/match-eval/cache.json dosyasını sil.
 * Rapor: tests/match-eval/results/ altına tarihli markdown.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { matchIngredients } from '../../services/matching/engine';
import type { CachedMatch, IngredientMatch, MatchCache, MatchRunReport } from '../../services/matching/types';
import { ahStoreProvider } from '../../services/stores/ah-provider';
import { jumboStoreProvider } from '../../services/stores/jumbo-provider';
import { STORE_IDS } from '../../services/stores/types';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_PATH = join(SCRIPT_DIR, 'cache.json');

const ACCURACY_TARGET = 0.85;
const WARM_LLM_TARGET = 0.2;

interface EvalIngredient {
  name: string;
  qty: number;
  unit: string;
  keywords: string[];
}

// ── Mini .env yükleyici (vision-eval kalıbı — dotenv bağımlılığı yok).
function loadEnvFile(): void {
  const envPath = join(SCRIPT_DIR, '../../.env');
  if (!existsSync(envPath)) {
    return;
  }
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].trim();
    }
  }
}

// ── Dosya tabanlı MatchCache (Node'da AsyncStorage yok; MatchCache arayüzü
// sayesinde motor farkı bilmez).
function fileCache(): MatchCache & { size(): number } {
  let data: Record<string, CachedMatch> = {};
  if (existsSync(CACHE_PATH)) {
    try {
      data = JSON.parse(readFileSync(CACHE_PATH, 'utf8'));
    } catch {
      data = {};
    }
  }
  return {
    get: (name) => data[name],
    set: (name, entry) => {
      data[name] = entry;
      writeFileSync(CACHE_PATH, JSON.stringify(data, null, 1), 'utf8');
    },
    size: () => Object.keys(data).length,
  };
}

function cellCorrect(match: IngredientMatch, storeId: (typeof STORE_IDS)[number], keywords: string[]): boolean | null {
  const storeMatch = match.perStore[storeId];
  if (!storeMatch) {
    return storeMatch === undefined ? null : false; // null = mağaza aranamadı (doğruluğa sayılmaz)
  }
  const name = storeMatch.product.name.toLocaleLowerCase('nl-NL');
  return keywords.some((kw) => name.includes(kw.toLocaleLowerCase('nl-NL')));
}

function formatPrice(cents: number | null | undefined): string {
  return cents == null ? '—' : `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

async function runOnce(
  label: string,
  ingredients: EvalIngredient[],
  cache: MatchCache
): Promise<{ lines: string[]; report: MatchRunReport; accuracy: number; matches: IngredientMatch[] }> {
  const startedAt = Date.now();
  const { matches, report } = await matchIngredients(
    ingredients.map((ing) => ({ key: `${ing.name}|${ing.unit}`, name: ing.name, qty: ing.qty, unit: ing.unit })),
    { providers: { ah: ahStoreProvider, jumbo: jumboStoreProvider }, cache }
  );

  const lines: string[] = [
    `## ${label} koşu`,
    '',
    '| Malzeme | Katman | AH ürünü | AH ✓ | Jumbo ürünü | Jumbo ✓ |',
    '|---|---|---|---|---|---|',
  ];
  let correctCells = 0;
  let totalCells = 0;
  matches.forEach((match, index) => {
    const ing = ingredients[index];
    const tiers = STORE_IDS.map((id) => match.perStore[id])
      .filter((m): m is NonNullable<typeof m> => Boolean(m))
      .map((m) => m.tier);
    const tier = tiers.length > 0 ? Math.max(...tiers) : '—';
    const cells = STORE_IDS.map((storeId) => {
      const storeMatch = match.perStore[storeId];
      const correct = cellCorrect(match, storeId, ing.keywords);
      if (correct !== null) {
        totalCells += 1;
        if (correct) {
          correctCells += 1;
        }
      }
      const label2 = storeMatch
        ? `${storeMatch.product.name} ${formatPrice(storeMatch.product.priceCents)} (g:${storeMatch.confidence})`
        : storeMatch === null
          ? '_eşleşme yok_'
          : '_aranamadı_';
      return { label: label2, mark: correct === null ? '·' : correct ? '✅' : '❌' };
    });
    lines.push(`| ${ing.name} | ${tier} | ${cells[0].label} | ${cells[0].mark} | ${cells[1].label} | ${cells[1].mark} |`);
  });

  const accuracy = totalCells > 0 ? correctCells / totalCells : 0;
  const llmPerIngredient = report.llmCalls / report.totalIngredients;
  lines.push(
    '',
    `- Süre: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
    `- Katman dağılımı: T0=${report.tierCounts[0]} · T1=${report.tierCounts[1]} · T2=${report.tierCounts[2]} · T3=${report.tierCounts[3]}`,
    `- Doğruluk: ${correctCells}/${totalCells} hücre = %${(accuracy * 100).toFixed(1)}`,
    `- LLM: ${report.llmCalls} çağrı (${llmPerIngredient.toFixed(3)}/malzeme), ${report.llmInputTokens}→${report.llmOutputTokens} token, ~$${report.estimatedLlmCostUsd.toFixed(4)}`,
    ''
  );
  return { lines, report, accuracy, matches };
}

async function main(): Promise<void> {
  loadEnvFile();
  const ingredients: EvalIngredient[] = JSON.parse(
    readFileSync(join(SCRIPT_DIR, 'ingredients.json'), 'utf8')
  );
  const cache = fileCache();
  console.log(`[eval] Başlangıç cache boyutu: ${cache.size()} kayıt (sıfırlamak için cache.json'ı sil)`);

  const cold = await runOnce('Soğuk', ingredients, cache);
  console.log(cold.lines.join('\n'));
  const warm = await runOnce('Sıcak', ingredients, cache);
  console.log(warm.lines.join('\n'));

  const warmLlmPerIngredient = warm.report.llmCalls / warm.report.totalIngredients;
  const accuracyPass = cold.accuracy >= ACCURACY_TARGET;
  const llmPass = warmLlmPerIngredient < WARM_LLM_TARGET;

  const verdict = [
    '## Sonuç',
    '',
    `- Doğruluk hedefi ≥%${ACCURACY_TARGET * 100}: %${(cold.accuracy * 100).toFixed(1)} → ${accuracyPass ? 'GEÇTİ ✅' : 'KALDI ❌'}`,
    `- Sıcak koşu LLM hedefi <${WARM_LLM_TARGET}/malzeme: ${warmLlmPerIngredient.toFixed(3)} → ${llmPass ? 'GEÇTİ ✅' : 'KALDI ❌'}`,
    `- Toplam LLM maliyeti (iki koşu): ~$${(cold.report.estimatedLlmCostUsd + warm.report.estimatedLlmCostUsd).toFixed(4)}`,
    '',
  ];
  console.log(verdict.join('\n'));

  const resultsDir = join(SCRIPT_DIR, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = join(resultsDir, `match-eval-${stamp}.md`);
  writeFileSync(
    reportPath,
    ['# Eşleştirme doğruluk raporu', '', `Tarih: ${new Date().toISOString()}`, '', ...cold.lines, ...warm.lines, ...verdict].join('\n'),
    'utf8'
  );
  console.log(`[eval] Rapor: ${reportPath}`);
  process.exitCode = accuracyPass && llmPass ? 0 : 1;
}

main().catch((error) => {
  console.error('[eval] Beklenmeyen hata:', error);
  process.exitCode = 1;
});
