/**
 * Mağaza sağlayıcıları canlı smoke testi (kanarya).
 * Koşum: npx tsx tests/store-smoke/run-smoke.ts
 *
 * Her CANLI sağlayıcı için: healthCheck + 5 sabit arama; her aramadan
 * ≥1 sonuç ve ilk sonuçta fiyat bekler. Rapor `tests/store-smoke/results/`
 * altına tarihli markdown olarak yazılır (vision-eval kalıbı).
 *
 * Unofficial endpoint'ler haber vermeden değişebilir — fiyatlar uygulamada
 * boş görünmeye başlarsa İLK bu script koşulur.
 *
 * NOT: `services/stores/index.ts` DEĞİL, sağlayıcı modülleri doğrudan
 * import edilir — index react-native'e (Platform) bağımlı, Node'da yüklenmez.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ahStoreProvider } from '../../services/stores/ah-provider';
import { jumboStoreProvider } from '../../services/stores/jumbo-provider';
import type { StoreProduct, StoreProvider } from '../../services/stores/types';

const SMOKE_QUERIES = ['melk', 'uien', 'gehakt', 'kaas', 'tomatenpuree'];
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

interface QueryResult {
  query: string;
  ok: boolean;
  count: number;
  latencyMs: number;
  first?: StoreProduct;
  error?: string;
}

function formatPrice(priceCents: number | null): string {
  if (priceCents == null) {
    return '—';
  }
  return `€${(priceCents / 100).toFixed(2).replace('.', ',')}`;
}

async function smokeProvider(provider: StoreProvider): Promise<{ passed: boolean; lines: string[] }> {
  const lines: string[] = [`## ${provider.displayName} (${provider.id})`, ''];

  const health = await provider.healthCheck();
  lines.push(`- healthCheck: ${health.ok ? '✅' : '❌'} (${health.latencyMs}ms) — ${health.detail ?? ''}`);

  const results: QueryResult[] = [];
  for (const query of SMOKE_QUERIES) {
    const startedAt = Date.now();
    try {
      const products = await provider.searchProducts(query, { limit: 8 });
      const first = products[0];
      results.push({
        query,
        ok: products.length > 0 && first?.priceCents != null,
        count: products.length,
        latencyMs: Date.now() - startedAt,
        first,
      });
    } catch (error) {
      results.push({
        query,
        ok: false,
        count: 0,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  lines.push('', '| Sorgu | Durum | Sonuç | Gecikme | İlk ürün | Fiyat | Birim |', '|---|---|---|---|---|---|---|');
  for (const r of results) {
    const status = r.ok ? '✅' : `❌${r.error ? ` ${r.error.slice(0, 60)}` : ''}`;
    lines.push(
      `| ${r.query} | ${status} | ${r.count} | ${r.latencyMs}ms | ${r.first?.name ?? '—'} | ${formatPrice(
        r.first?.priceCents ?? null
      )} | ${r.first?.unitSize ?? '—'} |`
    );
  }

  const passed = health.ok && results.every((r) => r.ok);
  lines.push('', `**Sonuç: ${passed ? 'GEÇTİ ✅' : 'KALDI ❌'}**`, '');
  return { passed, lines };
}

async function main(): Promise<void> {
  const providers = [ahStoreProvider, jumboStoreProvider];
  const report: string[] = [
    '# Mağaza sağlayıcı smoke raporu',
    '',
    `Tarih: ${new Date().toISOString()}`,
    `Sorgular: ${SMOKE_QUERIES.join(', ')}`,
    '',
  ];
  let allPassed = true;

  for (const provider of providers) {
    console.log(`\n[smoke] ${provider.displayName} test ediliyor...`);
    const { passed, lines } = await smokeProvider(provider);
    report.push(...lines);
    allPassed = allPassed && passed;
    console.log(lines.join('\n'));
  }

  const resultsDir = join(SCRIPT_DIR, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = join(resultsDir, `smoke-${stamp}.md`);
  writeFileSync(reportPath, report.join('\n'), 'utf8');
  console.log(`\n[smoke] Rapor: ${reportPath}`);
  console.log(`[smoke] Genel sonuç: ${allPassed ? 'GEÇTİ ✅' : 'KALDI ❌'}`);
  process.exitCode = allPassed ? 0 : 1;
}

main().catch((error) => {
  console.error('[smoke] Beklenmeyen hata:', error);
  process.exitCode = 1;
});
