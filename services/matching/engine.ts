/**
 * Katmanlı eşleştirme motoru — orkestratör.
 *
 * Akış (malzeme başına):
 *   Tier 0: kalıcı cache'te SKU varsa ve mağaza aramasında hâlâ bulunuyorsa
 *           doğrudan kabul (LLM maliyeti sıfır; kullanıcı düzeltmeleri de
 *           burada, source 'user' ile döner).
 *   Tier 1: TR→NL sözlük sorgusu → mağaza araması → fuzzy eşik üstü kabul.
 *   Tier 2: (sözlükte olmayan ad) LLM çevirisiyle gelen sorgu → fuzzy kabul.
 *   Tier 3: fuzzy belirsiz kaldıysa aday listesi toplu LLM'e gider.
 *
 * LLM koşu başına EN FAZLA iki toplu çağrı yapar (çeviri + seçim) ve tüm
 * sonuçlar cache'e yazılır — aynı malzeme bir daha LLM görmez. Mağaza
 * hatası o mağazayı düşürür, koşuyu asla düşürmez.
 */

import { STORE_IDS, type StoreId, type StoreProduct } from '@/services/stores/types';

import { TR_NL_DICTIONARY, type DictionaryEntry } from './dictionary';
import { FUZZY_ACCEPT_THRESHOLD, scoreProduct } from './fuzzy';
import { claudeLlmMatcher, estimateLlmCostUsd } from './llm';
import { normalizeIngredientQuery } from './normalize';
import type {
  CachedMatch,
  IngredientMatch,
  LlmMatchInput,
  MatchEngineOptions,
  MatchRunReport,
  MatchTier,
  MatchableItem,
  StoreMatch,
} from './types';

const SEARCH_LIMIT = 8;
/** LLM'e mağaza başına gönderilecek en fazla aday sayısı. */
const LLM_CANDIDATE_LIMIT = 5;

interface WorkItem {
  item: MatchableItem;
  normalizedName: string;
  cached: CachedMatch | undefined;
  dictEntry: DictionaryEntry | undefined;
  nlQuery: string | null;
  /** Sorgunun kaynağı — tier atfetmek için. */
  querySource: 'cache' | 'dictionary' | 'llm' | null;
  /** Mağaza başına arama sonuçları; alan yoksa mağaza aranamadı (hata). */
  searchResults: Partial<Record<StoreId, StoreProduct[]>>;
  match: IngredientMatch;
  /** LLM seçim turuna gidecekse true. */
  needsLlmResolve: boolean;
}

function emptyReport(total: number): MatchRunReport {
  return {
    totalIngredients: total,
    tierCounts: { 0: 0, 1: 0, 2: 0, 3: 0 },
    llmCalls: 0,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    estimatedLlmCostUsd: 0,
  };
}

/** Sorguyu (gerekirse yedek sorgularla) mağazada arar; hata → undefined. */
async function searchStore(
  options: MatchEngineOptions,
  storeId: StoreId,
  queries: string[]
): Promise<StoreProduct[] | undefined> {
  const provider = options.providers[storeId];
  if (!provider) {
    return undefined;
  }
  for (const query of queries) {
    try {
      const results = await provider.searchProducts(query, { limit: SEARCH_LIMIT });
      if (results.length > 0) {
        return results;
      }
    } catch {
      return undefined; // mağaza hatası — bu mağaza bu koşuda "aranamadı"
    }
  }
  return []; // arandı ama sonuç yok
}

function acceptMatch(
  work: WorkItem,
  storeId: StoreId,
  product: StoreProduct,
  confidence: number,
  tier: MatchTier,
  source: StoreMatch['source'],
  candidates: StoreProduct[]
): void {
  work.match.perStore[storeId] = { product, confidence, tier, source, candidates };
}

function finalizeStatus(work: WorkItem): void {
  const values = STORE_IDS.map((id) => work.match.perStore[id]);
  const matchedCount = values.filter((v) => v && typeof v === 'object').length;
  const searchedCount = STORE_IDS.filter((id) => work.searchResults[id] !== undefined).length;
  if (matchedCount === STORE_IDS.length) {
    work.match.status = 'matched';
  } else if (matchedCount > 0) {
    work.match.status = 'partial';
  } else if (searchedCount === 0 && work.nlQuery !== null) {
    work.match.status = 'error'; // sorgu vardı ama hiçbir mağazaya ulaşılamadı
  } else {
    work.match.status = 'unmatched';
  }
}

/** Malzemenin çözüm katmanı = mağaza eşleşmelerindeki en yüksek tier. */
function itemTier(work: WorkItem): MatchTier | null {
  const tiers = STORE_IDS.map((id) => work.match.perStore[id])
    .filter((v): v is StoreMatch => Boolean(v))
    .map((v) => v.tier);
  if (tiers.length === 0) {
    return null;
  }
  return Math.max(...tiers) as MatchTier;
}

export async function matchIngredients(
  items: MatchableItem[],
  options: MatchEngineOptions
): Promise<{ matches: IngredientMatch[]; report: MatchRunReport }> {
  const llm = options.llm ?? claudeLlmMatcher;
  const report = emptyReport(items.length);

  const work: WorkItem[] = items.map((item) => {
    const normalizedName = normalizeIngredientQuery(item.name);
    const cached = options.cache.get(normalizedName);
    const dictEntry = TR_NL_DICTIONARY[normalizedName];
    const nlQuery = cached?.nlQuery ?? dictEntry?.nl ?? null;
    return {
      item,
      normalizedName,
      cached,
      dictEntry,
      nlQuery,
      querySource: cached?.nlQuery ? 'cache' : dictEntry ? 'dictionary' : null,
      searchResults: {},
      needsLlmResolve: false,
      match: {
        cartKey: item.key,
        normalizedName,
        nlQuery,
        perStore: {},
        status: 'unmatched' as const,
      },
    };
  });

  // ── Faz A: sözlükte/cache'te olmayan adlar için TEK toplu çeviri çağrısı.
  const unknowns = work.filter((w) => w.nlQuery === null);
  if (unknowns.length > 0) {
    try {
      const { queries, usage } = await llm.translateQueries(
        unknowns.map((w) => w.item.name),
        options.onUsage
      );
      unknowns.forEach((w, index) => {
        w.nlQuery = queries[index];
        w.match.nlQuery = queries[index];
        if (queries[index]) {
          w.querySource = 'llm';
        }
      });
      report.llmCalls += usage.calls;
      report.llmInputTokens += usage.inputTokens;
      report.llmOutputTokens += usage.outputTokens;
    } catch (error) {
      console.log('[match-llm] çeviri çağrısı başarısız, malzemeler eşleşmeden kalacak:', error);
    }
  }

  // ── Faz B: mağaza aramaları. Sağlayıcının kendi seri kuyruğu hızı
  // sınırlar; mağazalar arası paralellik serbest.
  await Promise.all(
    work
      .filter((w) => w.nlQuery !== null)
      .map(async (w) => {
        const queries = [w.nlQuery!, ...(w.dictEntry?.altQueries ?? [])];
        const perStore = await Promise.all(
          STORE_IDS.map(async (storeId) => ({ storeId, results: await searchStore(options, storeId, queries) }))
        );
        for (const { storeId, results } of perStore) {
          if (results !== undefined) {
            w.searchResults[storeId] = results;
          }
        }
      })
  );

  // ── Faz C: Tier 0 (cache SKU) ve Tier 1/2 (fuzzy) kabulleri.
  for (const w of work) {
    if (w.nlQuery === null) {
      continue;
    }
    const hints = w.dictEntry?.matchHints ?? [];
    for (const storeId of STORE_IDS) {
      const results = w.searchResults[storeId];
      if (results === undefined || w.match.perStore[storeId] !== undefined) {
        continue;
      }
      // Tier 0 — cache'lenmiş SKU hâlâ arama sonuçlarında mı?
      const cachedStore = w.cached?.perStore[storeId];
      if (cachedStore) {
        const product = results.find((p) => p.sku === cachedStore.sku);
        if (product) {
          acceptMatch(w, storeId, product, cachedStore.confidence, 0, cachedStore.source, results);
          continue;
        }
        // SKU sortimandan düşmüş — normal akışa devam (cache güncellenecek).
      }
      if (results.length === 0) {
        w.match.perStore[storeId] = null; // arandı, sonuç yok
        continue;
      }
      // Tier 1/2 — fuzzy skor.
      const scored = results
        .map((product) => ({ product, score: scoreProduct(w.nlQuery!, hints, w.item, product) }))
        .sort((a, b) => b.score - a.score);
      const best = scored[0];
      if (best.score >= FUZZY_ACCEPT_THRESHOLD) {
        const tier: MatchTier = w.querySource === 'dictionary' || w.querySource === 'cache' ? 1 : 2;
        acceptMatch(w, storeId, best.product, best.score, tier, 'fuzzy', results);
      } else {
        w.needsLlmResolve = true; // belirsiz — Faz D'de LLM karar verecek
      }
    }
  }

  // ── Faz D: belirsiz kalanlar için TEK toplu LLM seçim çağrısı.
  const ambiguous = work.filter((w) => w.needsLlmResolve);
  if (ambiguous.length > 0) {
    const inputs: LlmMatchInput[] = ambiguous.map((w) => ({
      ingredient: { name: w.item.name, qty: w.item.qty, unit: w.item.unit },
      candidates: STORE_IDS.flatMap((storeId) => {
        if (w.match.perStore[storeId] !== undefined) {
          return []; // bu mağaza zaten çözüldü
        }
        return (w.searchResults[storeId] ?? []).slice(0, LLM_CANDIDATE_LIMIT).map((p) => ({
          storeId,
          sku: p.sku,
          name: p.name,
          unitSize: p.unitSize,
          priceCents: p.priceCents,
        }));
      }),
    }));
    try {
      const { results, usage } = await llm.resolveMatches(inputs, options.onUsage);
      ambiguous.forEach((w, index) => {
        const result = results[index];
        for (const storeId of STORE_IDS) {
          if (w.match.perStore[storeId] !== undefined) {
            continue;
          }
          const searchResults = w.searchResults[storeId];
          if (searchResults === undefined) {
            continue;
          }
          const pick = result?.perStore[storeId];
          if (!pick || pick.sku === null) {
            w.match.perStore[storeId] = null; // LLM: hiçbiri uygun değil
            continue;
          }
          const product = searchResults.find((p) => p.sku === pick.sku);
          if (product) {
            acceptMatch(w, storeId, product, pick.confidence, 3, 'llm', searchResults);
          } else {
            w.match.perStore[storeId] = null; // LLM aday listesi dışına çıktı
          }
        }
      });
      report.llmCalls += usage.calls;
      report.llmInputTokens += usage.inputTokens;
      report.llmOutputTokens += usage.outputTokens;
    } catch (error) {
      console.log('[match-llm] seçim çağrısı başarısız, belirsiz malzemeler eşleşmeden kalacak:', error);
      for (const w of ambiguous) {
        for (const storeId of STORE_IDS) {
          if (w.match.perStore[storeId] === undefined && w.searchResults[storeId] !== undefined) {
            w.match.perStore[storeId] = null;
          }
        }
      }
    }
  }

  // ── Faz E: cache yazımı + durum/rapor.
  for (const w of work) {
    finalizeStatus(w);

    const perStore: CachedMatch['perStore'] = { ...(w.cached?.perStore ?? {}) };
    let hasNewEntry = false;
    for (const storeId of STORE_IDS) {
      const storeMatch = w.match.perStore[storeId];
      if (!storeMatch) {
        continue;
      }
      const existing = perStore[storeId];
      // Kullanıcı düzeltmesini otomatik eşleşme EZMEZ (feedback loop kuralı);
      // sortimandan düşüp yeniden eşleşen ürün ise güncellenir (Tier 0 kabulü
      // zaten source'u korur).
      if (existing?.source === 'user' && storeMatch.source !== 'user' && existing.sku !== storeMatch.product.sku) {
        const stillAvailable = w.searchResults[storeId]?.some((p) => p.sku === existing.sku);
        if (stillAvailable) {
          continue;
        }
      }
      if (existing?.sku !== storeMatch.product.sku || existing?.source !== storeMatch.source) {
        hasNewEntry = true;
      }
      perStore[storeId] = {
        sku: storeMatch.product.sku,
        confidence: storeMatch.confidence,
        source: storeMatch.source,
        updatedAt: Date.now(),
      };
    }
    const nlQueryChanged = w.nlQuery !== (w.cached?.nlQuery ?? null);
    if ((hasNewEntry || nlQueryChanged) && (w.nlQuery !== null || Object.keys(perStore).length > 0)) {
      options.cache.set(w.normalizedName, { nlQuery: w.nlQuery, perStore });
    }

    const tier = itemTier(w);
    if (tier !== null) {
      report.tierCounts[tier] += 1;
    }
  }

  report.estimatedLlmCostUsd = estimateLlmCostUsd({
    inputTokens: report.llmInputTokens,
    outputTokens: report.llmOutputTokens,
  });

  return { matches: work.map((w) => w.match), report };
}
