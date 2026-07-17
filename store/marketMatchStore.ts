/**
 * Market ekranının oturum-ömürlü eşleştirme durumu (persist YOK — kalıcı
 * olan Tier-0 cache matchCacheStore'da, fiyatlar storePriceStore'da).
 * Ekran ve ProductMatchSheet aynı sonucu buradan paylaşır; sekmeler arası
 * geçişte yeniden ağ taraması yapılmaz (aynı fingerprint tekrar koşulmaz).
 */

import { create } from 'zustand';

import { matchIngredients } from '@/services/matching/engine';
import { normalizeIngredientQuery } from '@/services/matching/normalize';
import type { IngredientMatch, MatchRunReport, MatchableItem } from '@/services/matching/types';
import { getStoreProviders } from '@/services/stores';
import type { StoreId, StoreProduct } from '@/services/stores/types';
import { useMatchCacheStore, zustandMatchCache } from '@/store/matchCacheStore';
import { useStorePriceStore } from '@/store/storePriceStore';

export type MarketMatchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface MarketMatchState {
  fingerprint: string | null;
  status: MarketMatchStatus;
  matchesByKey: Record<string, IngredientMatch>;
  report: MatchRunReport | null;
  runMatches: (items: MatchableItem[], fingerprint: string, force?: boolean) => Promise<void>;
  /** Kullanıcı düzeltmesi: kalıcı cache'e yazar + ekran durumunu günceller. */
  applyCorrection: (cartKey: string, storeId: StoreId, product: StoreProduct) => void;
}

/** Koşudaki tüm ürünleri (eşleşme + adaylar) 24h fiyat cache'ine yazar. */
function collectProducts(matches: IngredientMatch[]): StoreProduct[] {
  const products: StoreProduct[] = [];
  for (const match of matches) {
    for (const storeMatch of Object.values(match.perStore)) {
      if (storeMatch) {
        products.push(storeMatch.product, ...(storeMatch.candidates ?? []));
      }
    }
  }
  return products;
}

export const useMarketMatchStore = create<MarketMatchState>()((set, get) => ({
  fingerprint: null,
  status: 'idle',
  matchesByKey: {},
  report: null,

  runMatches: async (items, fingerprint, force = false) => {
    const state = get();
    if (!force && state.fingerprint === fingerprint && state.status !== 'idle' && state.status !== 'error') {
      return; // aynı sepet için koşu zaten yapıldı/yapılıyor
    }
    if (items.length === 0) {
      set({ fingerprint, status: 'ready', matchesByKey: {}, report: null });
      return;
    }
    set({ fingerprint, status: 'loading' });
    try {
      const { matches, report } = await matchIngredients(items, {
        providers: getStoreProviders(),
        cache: zustandMatchCache(),
      });
      // Başka bir koşu araya girdiyse (sepet değişti) sonucu çöpe at.
      if (get().fingerprint !== fingerprint) {
        return;
      }
      useStorePriceStore.getState().putProducts(collectProducts(matches));
      const matchesByKey: Record<string, IngredientMatch> = {};
      for (const match of matches) {
        matchesByKey[match.cartKey] = match;
      }
      set({ status: 'ready', matchesByKey, report });
      console.log(
        `[match-run] ${report.totalIngredients} malzeme · T0=${report.tierCounts[0]} T1=${report.tierCounts[1]} ` +
          `T2=${report.tierCounts[2]} T3=${report.tierCounts[3]} · LLM ${report.llmCalls} çağrı ~$${report.estimatedLlmCostUsd.toFixed(4)}`
      );
    } catch (error) {
      console.log('[match-run] koşu başarısız:', error);
      if (get().fingerprint === fingerprint) {
        set({ status: 'error' });
      }
    }
  },

  applyCorrection: (cartKey, storeId, product) => {
    const match = get().matchesByKey[cartKey];
    if (!match) {
      return;
    }
    // normalizedName motorda zaten normalize edilmişti; yine de idempotent geçir.
    useMatchCacheStore.getState().setUserCorrection(normalizeIngredientQuery(match.normalizedName), storeId, product.sku);
    useStorePriceStore.getState().putProducts([product]);
    const previous = match.perStore[storeId];
    const perStore = {
      ...match.perStore,
      [storeId]: {
        product,
        confidence: 100,
        tier: 0 as const,
        source: 'user' as const,
        candidates: previous?.candidates,
      },
    };
    const matchedCount = Object.values(perStore).filter(Boolean).length;
    set((state) => ({
      matchesByKey: {
        ...state.matchesByKey,
        [cartKey]: {
          ...match,
          perStore,
          status: matchedCount >= 2 ? 'matched' : 'partial',
        },
      },
    }));
  },
}));
