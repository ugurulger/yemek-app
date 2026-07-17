/**
 * Tier-0 kalıcı eşleşme cache'i: normalize TR malzeme adı →
 * {nlQuery, mağaza başına SKU + güven + kaynak}. Cihaz-yerel (AsyncStorage);
 * `MatchCache` arayüzü sayesinde ileride Supabase destekli bir sürüm
 * drop-in girer (bkz. services/matching/types.ts).
 *
 * Kullanıcı düzeltmeleri `setUserCorrection` ile source 'user' + güven 100
 * olarak yazılır — motor bunları otomatik eşleşmeyle EZMEZ (feedback loop).
 *
 * Sürümleme recipeStore kalıbı: MATCH_CACHE_VERSION artınca migrate tüm
 * kayıtları atar (cache yeniden dolar, veri kaybı zararsız).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CachedMatch, MatchCache } from '@/services/matching/types';
import type { StoreId } from '@/services/stores/types';

export const MATCH_CACHE_VERSION = 1;

interface MatchCacheState {
  entries: Record<string, CachedMatch>;
  getEntry: (normalizedName: string) => CachedMatch | undefined;
  setEntry: (normalizedName: string, entry: CachedMatch) => void;
  setUserCorrection: (normalizedName: string, storeId: StoreId, sku: string) => void;
  resetCache: () => void;
}

export const useMatchCacheStore = create<MatchCacheState>()(
  persist(
    (set, get) => ({
      entries: {},
      getEntry: (normalizedName) => get().entries[normalizedName],
      setEntry: (normalizedName, entry) =>
        set((state) => ({ entries: { ...state.entries, [normalizedName]: entry } })),
      setUserCorrection: (normalizedName, storeId, sku) =>
        set((state) => {
          const existing = state.entries[normalizedName] ?? { nlQuery: null, perStore: {} };
          return {
            entries: {
              ...state.entries,
              [normalizedName]: {
                ...existing,
                perStore: {
                  ...existing.perStore,
                  [storeId]: { sku, confidence: 100, source: 'user', updatedAt: Date.now() },
                },
              },
            },
          };
        }),
      resetCache: () => set({ entries: {} }),
    }),
    {
      name: 'yemek-app-match-cache',
      storage: createJSONStorage(() => AsyncStorage),
      version: MATCH_CACHE_VERSION,
      migrate: (persisted, version) => {
        if (version !== MATCH_CACHE_VERSION) {
          return { entries: {} } as MatchCacheState; // eski şema — cache yeniden dolar
        }
        return persisted as MatchCacheState;
      },
    }
  )
);

/** Motor için depo-bağımsız adaptör (MatchEngineOptions.cache). */
export function zustandMatchCache(): MatchCache {
  return {
    get: (normalizedName) => useMatchCacheStore.getState().getEntry(normalizedName),
    set: (normalizedName, entry) => useMatchCacheStore.getState().setEntry(normalizedName, entry),
  };
}
