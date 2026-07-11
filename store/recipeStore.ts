import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryItem } from '@/types/inventory';
import {
  EMPTY_PREFERENCES,
  preferencesFingerprint,
  type RecipePreferences,
} from '@/types/preferences';
import type { Recipe } from '@/types/recipe';

/**
 * Üretim mantığı değiştiğinde artırılır — eski mantıkla üretilmiş cache'in
 * parmak izi eşleşmesin ve tarifler yeni akışla yeniden üretilsin diye
 * (v2: MVP-16, 9→6 tarif + eksik-bazlı katmanlama; v3: tasarım entegrasyonu —
 * malzeme şeması qty/unit/kcal/category kazandı, nutrition_tag eklendi,
 * tercihler parmak izine girdi).
 */
const GENERATION_VERSION = 'v3';

/**
 * Envanterin + tercihlerin tarif üretimini etkileyen halinin parmak izi.
 * Tarifler bu parmak iziyle birlikte AsyncStorage'a yazılır; envanter VE
 * tercihler değişmediyse tarifler yeniden ÜRETİLMEZ, cache'ten okunur.
 * Aktif kiler listesi de üretimi etkilediği için parmak ize dahildir.
 */
export function inventoryFingerprint(
  inventory: InventoryItem[],
  preferences: RecipePreferences,
  activePantryNames: string[]
): string {
  const simplified = inventory
    .map((item) => ({ name: item.name.trim().toLowerCase(), qty: item.qty, unit: item.unit }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
  const pantry = [...activePantryNames].map((name) => name.trim().toLowerCase()).sort();
  return `${GENERATION_VERSION}|${preferencesFingerprint(preferences)}|${pantry.join(',')}|${JSON.stringify(simplified)}`;
}

interface RecipeState {
  recipes: Recipe[];
  /** `recipes`'in hangi envanter+tercih durumu için üretildiği (bkz. `inventoryFingerprint`). */
  generatedForFingerprint: string | null;
  /** Tercih ekranındaki seçimler (spec §4) — kalıcı, üretim parmak izine girer. */
  preferences: RecipePreferences;
  /**
   * Tarif bazında seçili kişi sayısı (spec §5 stepper) — varsayılan
   * `recipe.servings`; sepete giden eksik miktarlar bu değerle ölçeklenir.
   */
  selectedServings: Record<string, number>;
  setRecipes: (recipes: Recipe[], fingerprint: string) => void;
  getRecipeById: (id: string) => Recipe | undefined;
  setPreferences: (preferences: RecipePreferences) => void;
  setSelectedServings: (recipeId: string, servings: number) => void;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      generatedForFingerprint: null,
      preferences: EMPTY_PREFERENCES,
      selectedServings: {},
      setRecipes: (recipes, fingerprint) =>
        set({ recipes, generatedForFingerprint: fingerprint, selectedServings: {} }),
      getRecipeById: (id) => get().recipes.find((recipe) => recipe.id === id),
      setPreferences: (preferences) => set({ preferences }),
      setSelectedServings: (recipeId, servings) =>
        set((state) => ({
          selectedServings: { ...state.selectedServings, [recipeId]: Math.max(1, servings) },
        })),
    }),
    {
      name: 'yemek-app-recipes',
      storage: createJSONStorage(() => AsyncStorage),
      // v3: Recipe.ingredients şeması değişti (qty/unit/kcal/category zorunlu
      // oldu) — eski kayıtlar yeni tiple uyumsuz, migrate'te atılır; parmak izi
      // v3 olduğu için tarifler zaten yeniden üretilecek.
      version: 1,
      migrate: () => ({
        recipes: [],
        generatedForFingerprint: null,
        preferences: EMPTY_PREFERENCES,
        selectedServings: {},
      }),
    }
  )
);
