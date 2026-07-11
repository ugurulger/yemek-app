import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CartEntry, CartItemView } from '@/types/cart';
import type { IngredientCategory } from '@/types/recipe';

/**
 * Market Sepeti store'u — spec §6. Ham kayıtlar tarif+malzeme bazında
 * (`CartEntry`) tutulur; ekran `mergeCartEntries` ile malzeme bazında
 * birleştirilmiş satırları render eder (aynı malzeme birden çok tariften →
 * miktarlar toplanır, kaynak tarifler etiket olur).
 *
 * Kişi ölçekleme senkronu (kullanıcı kararı): bir tarifin sepetteki katkısı
 * her zaman o tarif için SEÇİLİ kişi sayısına göre ölçeklenmiş miktardır —
 * tarif karttaki "N eksik" rozetinden sepete eklenir, detay ekranında kişi
 * sayısı değişirse `syncRecipeMissing` AYNI tarifin kayıtlarını yeniden yazar.
 */
export interface CartMissingInput {
  name: string;
  qty: number;
  unit: string;
  category: IngredientCategory;
}

interface CartState {
  entries: CartEntry[];
  /** İşaretlenmiş birleşik satır anahtarları (bkz. `cartItemKey`). */
  checkedKeys: string[];
  /** Tarifin sepetteki tüm katkısını verilen eksik listesiyle DEĞİŞTİRİR. */
  syncRecipeMissing: (recipeName: string, missing: CartMissingInput[]) => void;
  /** Tarif sepette katkıya sahip mi? (rozet durumu için) */
  hasRecipe: (recipeName: string) => boolean;
  removeRecipe: (recipeName: string) => void;
  toggleChecked: (key: string) => void;
  /** "Tümünü tamamla" — tüm birleşik satırları işaretler. */
  completeAll: () => void;
  clearCart: () => void;
}

export function cartItemKey(name: string, unit: string): string {
  return `${name.trim().toLocaleLowerCase('tr-TR')}|${unit.trim().toLocaleLowerCase('tr-TR')}`;
}

/** Ham kayıtları malzeme bazında birleştirir — market ekranının render girdisi. */
export function mergeCartEntries(
  entries: readonly CartEntry[],
  checkedKeys: readonly string[]
): CartItemView[] {
  const merged = new Map<string, CartItemView>();
  for (const entry of entries) {
    const key = cartItemKey(entry.name, entry.unit);
    const existing = merged.get(key);
    if (existing) {
      existing.qty += entry.qty;
      if (!existing.recipeNames.includes(entry.recipeName)) {
        existing.recipeNames.push(entry.recipeName);
      }
    } else {
      merged.set(key, {
        key,
        name: entry.name,
        qty: entry.qty,
        unit: entry.unit,
        category: entry.category,
        recipeNames: [entry.recipeName],
        checked: checkedKeys.includes(key),
      });
    }
  }
  return [...merged.values()];
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      entries: [],
      checkedKeys: [],
      syncRecipeMissing: (recipeName, missing) =>
        set((state) => {
          const others = state.entries.filter((entry) => entry.recipeName !== recipeName);
          const added: CartEntry[] = missing.map((item, index) => ({
            id: `cart-${recipeName}-${index}`,
            name: item.name,
            qty: item.qty,
            unit: item.unit,
            category: item.category,
            recipeName,
          }));
          return { entries: [...others, ...added] };
        }),
      hasRecipe: (recipeName) => get().entries.some((entry) => entry.recipeName === recipeName),
      removeRecipe: (recipeName) =>
        set((state) => ({
          entries: state.entries.filter((entry) => entry.recipeName !== recipeName),
        })),
      toggleChecked: (key) =>
        set((state) => ({
          checkedKeys: state.checkedKeys.includes(key)
            ? state.checkedKeys.filter((k) => k !== key)
            : [...state.checkedKeys, key],
        })),
      completeAll: () =>
        set((state) => ({
          checkedKeys: mergeCartEntries(state.entries, state.checkedKeys).map((item) => item.key),
        })),
      clearCart: () => set({ entries: [], checkedKeys: [] }),
    }),
    {
      name: 'yemek-app-cart',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
