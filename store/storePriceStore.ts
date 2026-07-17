/**
 * Kısa ömürlü fiyat cache'i (24 saat): `${storeId}|${sku}` → ürün + çekilme
 * zamanı. Amaç: Market sekmesi her açılışta mağaza API'lerini taramasın —
 * bayat olmayan fiyat doğrudan buradan okunur, pratikte günde bir tarama
 * kalır. Cihaz-yerel, zustand persist (AsyncStorage).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StoreId, StoreProduct } from '@/services/stores/types';

export const PRICE_TTL_MS = 24 * 60 * 60 * 1000;

export function priceKey(storeId: StoreId, sku: string): string {
  return `${storeId}|${sku}`;
}

interface PriceEntry {
  product: StoreProduct;
  fetchedAt: number;
}

interface StorePriceState {
  products: Record<string, PriceEntry>;
  /** Bayat değilse ürünü döndürür; bayat/yok → undefined. */
  getFresh: (storeId: StoreId, sku: string) => StoreProduct | undefined;
  putProducts: (products: readonly StoreProduct[]) => void;
  clearPrices: () => void;
}

export const useStorePriceStore = create<StorePriceState>()(
  persist(
    (set, get) => ({
      products: {},
      getFresh: (storeId, sku) => {
        const entry = get().products[priceKey(storeId, sku)];
        if (!entry || Date.now() - entry.fetchedAt > PRICE_TTL_MS) {
          return undefined;
        }
        return entry.product;
      },
      putProducts: (products) =>
        set((state) => {
          const next = { ...state.products };
          const now = Date.now();
          for (const product of products) {
            next[priceKey(product.storeId, product.sku)] = { product, fetchedAt: now };
          }
          return { products: next };
        }),
      clearPrices: () => set({ products: {} }),
    }),
    {
      name: 'yemek-app-store-prices',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
