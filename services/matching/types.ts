/**
 * Katmanlı malzeme→ürün eşleştirme motorunun ortak tipleri.
 *
 * Katmanlar (maliyet sırasıyla): 0 kalıcı cache → 1 TR→NL sözlük →
 * 2 fuzzy skor → 3 LLM (Haiku). LLM yalnızca belirsiz durumlarda, koşu
 * başına toplu (batched) çağrılır; sonucu Tier-0 cache'ine yazıldığı için
 * malzeme başına ömür boyu maliyet ~bir çağrıdır.
 */

import type { StoreId, StoreProduct, StoreProvider } from '@/services/stores/types';
import type { UsageEvent } from '@/services/vision/types';

export type MatchTier = 0 | 1 | 2 | 3;

export type MatchSource = 'cache' | 'dictionary' | 'fuzzy' | 'llm' | 'user';

export interface StoreMatch {
  product: StoreProduct;
  /** 0-100; LOW_CONFIDENCE_THRESHOLD altı UI'da "eşleşmeyi kontrol et" işareti alır. */
  confidence: number;
  tier: MatchTier;
  source: MatchSource;
  /** Arama sonuçlarından alternatif adaylar — sheet yeni API çağrısı yapmadan açılır. */
  candidates?: StoreProduct[];
}

export type IngredientMatchStatus = 'matched' | 'partial' | 'unmatched' | 'error';

export interface IngredientMatch {
  /** cartItemKey(name, unit) — CartItemView'a geri bağlanma anahtarı. */
  cartKey: string;
  normalizedName: string;
  /** Çözülen Hollandaca arama sorgusu; null = hiçbir katman çeviremedi. */
  nlQuery: string | null;
  /** null = arandı ama kabul edilebilir eşleşme yok; alan yok = mağaza hiç aranamadı. */
  perStore: Partial<Record<StoreId, StoreMatch | null>>;
  status: IngredientMatchStatus;
}

export interface MatchRunReport {
  totalIngredients: number;
  tierCounts: Record<MatchTier, number>;
  llmCalls: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  estimatedLlmCostUsd: number;
}

/** Tier-0 kalıcı cache'in tek kaydı — mağaza başına SKU + güven + kaynak. */
export interface CachedMatch {
  nlQuery: string | null;
  perStore: Partial<
    Record<StoreId, { sku: string; confidence: number; source: MatchSource; updatedAt: number }>
  >;
}

/**
 * Depodan bağımsız cache sözleşmesi: uygulama zustand adaptörünü
 * (store/matchCacheStore.ts), eval scripti dosya tabanlı cache'i enjekte
 * eder; ileride Supabase destekli bir implementasyon drop-in girer.
 */
export interface MatchCache {
  get(normalizedName: string): CachedMatch | undefined;
  set(normalizedName: string, entry: CachedMatch): void;
}

export interface MatchEngineOptions {
  providers: Record<StoreId, StoreProvider>;
  cache: MatchCache;
  /** Test/eval için enjekte edilebilir; verilmezse gerçek Haiku çağrısı. */
  llm?: LlmMatcher;
  onUsage?: (event: UsageEvent) => void;
}

export interface MatchableItem {
  key: string;
  name: string;
  qty: number;
  unit: string;
}

/** LLM katmanına giden tek malzemenin girdisi. */
export interface LlmMatchInput {
  ingredient: { name: string; qty: number; unit: string };
  /** Sözlükte yoksa model NL sorguyu da üretmek zorunda kalır (çeviri turu). */
  candidates: Array<{
    storeId: StoreId;
    sku: string;
    name: string;
    unitSize?: string;
    priceCents: number | null;
  }>;
}

export interface LlmMatchResult {
  perStore: Partial<Record<StoreId, { sku: string | null; confidence: number }>>;
}

export interface LlmUsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmMatcher {
  /** Sözlükte olmayan TR adları toplu NL arama sorgusuna çevirir. */
  translateQueries(
    names: string[],
    onUsage?: (event: UsageEvent) => void
  ): Promise<{ queries: (string | null)[]; usage: LlmUsageTotals }>;
  /** Aday listelerinden en uygun ürünü seçtirir (sku null = hiçbiri uygun değil). */
  resolveMatches(
    inputs: LlmMatchInput[],
    onUsage?: (event: UsageEvent) => void
  ): Promise<{ results: LlmMatchResult[]; usage: LlmUsageTotals }>;
}
