/**
 * matchIngredients (katman yönlendirme + cache yazımı) birim testleri —
 * sahte sağlayıcı + bellek-içi cache + stub LLM ile, ağ/LLM çağrısı YOK.
 * Koşum: npx tsx --test tests/unit/match-engine.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { matchIngredients } from '../../services/matching/engine';
import type {
  CachedMatch,
  LlmMatcher,
  MatchCache,
  MatchEngineOptions,
} from '../../services/matching/types';
import type { StoreId, StoreProduct, StoreProvider } from '../../services/stores/types';

function product(storeId: StoreId, sku: string, name: string, unitSize = '500 g'): StoreProduct {
  return { storeId, sku, name, priceCents: 199, unitSize };
}

/** Sorgu → sonuç eşlemesiyle sahte sağlayıcı. '!' ile başlayan sorgu hata fırlatır. */
function fakeProvider(storeId: StoreId, catalog: Record<string, StoreProduct[]>, failAll = false): StoreProvider {
  return {
    id: storeId,
    displayName: storeId,
    async searchProducts(query) {
      if (failAll) {
        throw new Error(`${storeId} down`);
      }
      return catalog[query] ?? [];
    },
    async healthCheck() {
      return { storeId, ok: !failAll, latencyMs: 1 };
    },
  };
}

function memoryCache(seed: Record<string, CachedMatch> = {}): MatchCache & { data: Record<string, CachedMatch> } {
  const data = { ...seed };
  return {
    data,
    get: (name) => data[name],
    set: (name, entry) => {
      data[name] = entry;
    },
  };
}

function stubLlm(overrides: Partial<LlmMatcher> = {}): LlmMatcher & { translateCalls: number; resolveCalls: number } {
  const stub = {
    translateCalls: 0,
    resolveCalls: 0,
    async translateQueries(names: string[]) {
      stub.translateCalls += 1;
      return {
        queries: names.map(() => null),
        usage: { calls: 1, inputTokens: 10, outputTokens: 5 },
      };
    },
    async resolveMatches(inputs: Parameters<LlmMatcher['resolveMatches']>[0]) {
      stub.resolveCalls += 1;
      return {
        results: inputs.map(() => ({ perStore: {} })),
        usage: { calls: 1, inputTokens: 20, outputTokens: 10 },
      };
    },
    ...overrides,
  };
  return stub as LlmMatcher & { translateCalls: number; resolveCalls: number };
}

const UIEN_AH = product('ah', 'a1', 'AH Gele uien', '3 stuks');
const UIEN_JUMBO = product('jumbo', 'j1', 'Jumbo Uien 1 kg', '1 kg');

function baseOptions(overrides: Partial<MatchEngineOptions> = {}): MatchEngineOptions & {
  cache: ReturnType<typeof memoryCache>;
} {
  const cache = memoryCache();
  return {
    providers: {
      ah: fakeProvider('ah', { uien: [UIEN_AH] }),
      jumbo: fakeProvider('jumbo', { uien: [UIEN_JUMBO] }),
    },
    cache,
    llm: stubLlm(),
    ...overrides,
    // overrides cache verdiyse onu koru
    ...(overrides.cache ? {} : { cache }),
  } as MatchEngineOptions & { cache: ReturnType<typeof memoryCache> };
}

test('sözlük + fuzzy: tier 1, LLM çağrısı yok, cache yazılır', async () => {
  const llm = stubLlm();
  const options = baseOptions({ llm });
  const { matches, report } = await matchIngredients(
    [{ key: 'soğan|adet', name: 'Soğan', qty: 2, unit: 'adet' }],
    options
  );
  assert.equal(matches[0].status, 'matched');
  assert.equal(matches[0].perStore.ah?.tier, 1);
  assert.equal(matches[0].perStore.ah?.source, 'fuzzy');
  assert.equal(matches[0].perStore.jumbo?.product.sku, 'j1');
  assert.equal(report.llmCalls, 0);
  assert.equal(report.tierCounts[1], 1);
  assert.equal(llm.translateCalls, 0);
  const cached = options.cache.data['soğan'];
  assert.ok(cached, 'cache kaydı yazılmalı');
  assert.equal(cached.nlQuery, 'uien');
  assert.equal(cached.perStore.ah?.sku, 'a1');
});

test('cache SKU isabeti: tier 0, source korunur', async () => {
  const cache = memoryCache({
    soğan: {
      nlQuery: 'uien',
      perStore: { ah: { sku: 'a1', confidence: 100, source: 'user', updatedAt: 1 } },
    },
  });
  const options = baseOptions({ cache });
  const { matches, report } = await matchIngredients(
    [{ key: 'soğan|adet', name: 'soğan', qty: 2, unit: 'adet' }],
    options
  );
  assert.equal(matches[0].perStore.ah?.tier, 0);
  assert.equal(matches[0].perStore.ah?.source, 'user');
  assert.equal(matches[0].perStore.ah?.confidence, 100);
  // Jumbo cache'te yoktu — fuzzy ile çözülür.
  assert.equal(matches[0].perStore.jumbo?.tier, 1);
  assert.equal(report.tierCounts[1], 1); // malzeme katmanı = en yüksek tier
});

test('sözlükte olmayan ad: çeviri turu + fuzzy kabul = tier 2', async () => {
  const llm = stubLlm({
    async translateQueries(names: string[]) {
      return {
        queries: names.map(() => 'uien'),
        usage: { calls: 1, inputTokens: 10, outputTokens: 5 },
      };
    },
  });
  const options = baseOptions({ llm });
  const { matches, report } = await matchIngredients(
    [{ key: 'x|adet', name: 'acayip soğanımsı', qty: 1, unit: 'adet' }],
    options
  );
  assert.equal(matches[0].nlQuery, 'uien');
  assert.equal(matches[0].perStore.ah?.tier, 2);
  assert.equal(report.llmCalls, 1); // sadece çeviri
  assert.equal(report.tierCounts[2], 1);
});

test('belirsiz fuzzy: LLM seçimi tier 3, sku null → eşleşme yok', async () => {
  // "gehakt" sorgusu iki mağazada da alakasız-görünümlü ürünler döndürür → fuzzy eşiği aşamaz.
  const weird = [
    product('ah', 'w1', 'Verstegen Mix voor Gehaktballen Speciaal', '225 g'),
    product('ah', 'w2', 'Blanke vleessaus voor gehakt', '300 ml'),
  ];
  const llm = stubLlm({
    async resolveMatches(inputs: Parameters<LlmMatcher['resolveMatches']>[0]) {
      return {
        results: inputs.map(() => ({
          perStore: { ah: { sku: 'w1', confidence: 62 }, jumbo: { sku: null, confidence: 0 } },
        })),
        usage: { calls: 1, inputTokens: 30, outputTokens: 12 },
      };
    },
  });
  const options = baseOptions({
    llm,
    providers: {
      ah: fakeProvider('ah', { gehakt: weird }),
      jumbo: fakeProvider('jumbo', { gehakt: [product('jumbo', 'jw', 'Kattenvoer gehaktsmaak', '400 g')] }),
    },
  });
  const { matches, report } = await matchIngredients(
    [{ key: 'kıyma|g', name: 'kıyma', qty: 500, unit: 'g' }],
    options
  );
  assert.equal(matches[0].perStore.ah?.tier, 3);
  assert.equal(matches[0].perStore.ah?.product.sku, 'w1');
  assert.equal(matches[0].perStore.ah?.confidence, 62);
  assert.equal(matches[0].perStore.jumbo, null); // LLM: uygun değil
  assert.equal(matches[0].status, 'partial');
  assert.equal(report.llmCalls, 1);
  assert.equal(report.tierCounts[3], 1);
});

test('mağaza hatası: o mağaza atlanır, koşu düşmez, durum partial', async () => {
  const options = baseOptions({
    providers: {
      ah: fakeProvider('ah', { uien: [UIEN_AH] }),
      jumbo: fakeProvider('jumbo', {}, true), // tamamen çökük
    },
  });
  const { matches } = await matchIngredients(
    [{ key: 'soğan|adet', name: 'soğan', qty: 2, unit: 'adet' }],
    options
  );
  assert.equal(matches[0].perStore.ah?.product.sku, 'a1');
  assert.equal(matches[0].perStore.jumbo, undefined); // aranamadı (null değil)
  assert.equal(matches[0].status, 'partial');
});

test('kullanıcı düzeltmesi, ürün sortimanda durdukça otomatik eşleşmeyle ezilmez', async () => {
  const cache = memoryCache({
    soğan: {
      nlQuery: 'uien',
      // Kullanıcı a2'yi seçmiş ama arama sonuçlarında a2 İKİNCİ sırada (fuzzy a1'i seçerdi).
      perStore: { ah: { sku: 'a2', confidence: 100, source: 'user', updatedAt: 1 } },
    },
  });
  const a2 = product('ah', 'a2', 'AH Biologisch rode uien', '500 g');
  const options = baseOptions({
    cache,
    providers: {
      ah: fakeProvider('ah', { uien: [UIEN_AH, a2] }),
      jumbo: fakeProvider('jumbo', { uien: [UIEN_JUMBO] }),
    },
  });
  const { matches } = await matchIngredients(
    [{ key: 'soğan|adet', name: 'soğan', qty: 2, unit: 'adet' }],
    options
  );
  assert.equal(matches[0].perStore.ah?.product.sku, 'a2'); // kullanıcının seçimi
  assert.equal(matches[0].perStore.ah?.source, 'user');
  assert.equal(cache.data['soğan'].perStore.ah?.sku, 'a2'); // cache bozulmadı
});
