import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryItem } from '@/types/inventory';
import type { Recipe } from '@/types/recipe';

/**
 * Envanterin tarif üretimini etkileyen halinin parmak izi. Tarifler bu parmak
 * iziyle birlikte AsyncStorage'a yazılır; envanter değişmediyse (parmak izi
 * aynıysa) tarifler yeniden ÜRETİLMEZ, cache'ten okunur.
 */
export function inventoryFingerprint(inventory: InventoryItem[]): string {
  const simplified = inventory
    .map((item) => ({ name: item.name.trim().toLowerCase(), qty: item.qty, unit: item.unit }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
  return JSON.stringify(simplified);
}

interface RecipeState {
  recipes: Recipe[];
  /** `recipes`'in hangi envanter durumu için üretildiği (bkz. `inventoryFingerprint`). */
  generatedForFingerprint: string | null;
  setRecipes: (recipes: Recipe[], fingerprint: string) => void;
  getRecipeById: (id: string) => Recipe | undefined;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      generatedForFingerprint: null,
      setRecipes: (recipes, fingerprint) =>
        set({ recipes, generatedForFingerprint: fingerprint }),
      getRecipeById: (id) => get().recipes.find((recipe) => recipe.id === id),
    }),
    {
      name: 'yemek-app-recipes',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
