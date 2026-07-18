import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { InventoryItem } from '@/types/inventory';
import {
  EMPTY_PREFERENCES,
  preferencesFingerprint,
  type RecipePreferences,
} from '@/types/preferences';
import type { AppLanguage } from '@/src/i18n';
import type { Recipe, RecipeTexts } from '@/types/recipe';

/**
 * Üretim mantığı değiştiğinde artırılır — eski mantıkla üretilmiş cache'in
 * parmak izi eşleşmesin ve tarifler yeni akışla yeniden üretilsin diye
 * (v2: MVP-16, 9→6 tarif + eksik-bazlı katmanlama; v3: tasarım entegrasyonu —
 * malzeme şeması qty/unit/kcal/category kazandı, nutrition_tag eklendi,
 * tercihler parmak izine girdi; v4: aktif kiler parmak izinden ÇIKARILDI —
 * kiler değişimi artık üretimi baştan başlatmaz, eksik rozetleri canlı
 * computeMissing'le güncellenir — + 6 standart + 2 fine dining = 8 tarif).
 */
const GENERATION_VERSION = 'v4';

/**
 * Envanterin + tercihlerin tarif üretimini etkileyen halinin parmak izi.
 * Tarifler bu parmak iziyle birlikte AsyncStorage'a yazılır; envanter VE
 * tercihler değişmediyse tarifler yeniden ÜRETİLMEZ, cache'ten okunur.
 * AKTİF KİLER BİLİNÇLİ OLARAK DAHİL DEĞİL (kullanıcı kararı): kiler
 * güncellenince tarifler baştan üretilmez — yalnızca eksik malzeme bilgisi
 * canlı hesaplanır (bkz. lib/recipes/recipe-math.ts — computeMissing).
 */
export function inventoryFingerprint(
  inventory: InventoryItem[],
  preferences: RecipePreferences
): string {
  const simplified = inventory
    .map((item) => ({ name: item.name.trim().toLowerCase(), qty: item.qty, unit: item.unit }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.unit.localeCompare(b.unit));
  return `${GENERATION_VERSION}|${preferencesFingerprint(preferences)}|${JSON.stringify(simplified)}`;
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
  /**
   * Tarif çevirileri (dil değişiminde "topyekün" takas — bkz.
   * src/i18n/recipeI18n.ts): tarif id → dil → serbest metin alanları.
   * setRecipes'te SIFIRLANIR (yeni üretim yeni id'ler getirir).
   */
  translations: Record<string, Partial<Record<AppLanguage, RecipeTexts>>>;
  setRecipes: (recipes: Recipe[], fingerprint: string) => void;
  getRecipeById: (id: string) => Recipe | undefined;
  setPreferences: (preferences: RecipePreferences) => void;
  setSelectedServings: (recipeId: string, servings: number) => void;
  setRecipeTranslation: (recipeId: string, language: AppLanguage, texts: RecipeTexts) => void;
}

export const useRecipeStore = create<RecipeState>()(
  persist(
    (set, get) => ({
      recipes: [],
      generatedForFingerprint: null,
      preferences: EMPTY_PREFERENCES,
      selectedServings: {},
      translations: {},
      setRecipes: (recipes, fingerprint) =>
        set({
          recipes,
          generatedForFingerprint: fingerprint,
          selectedServings: {},
          translations: {},
        }),
      getRecipeById: (id) => get().recipes.find((recipe) => recipe.id === id),
      setPreferences: (preferences) => set({ preferences }),
      setSelectedServings: (recipeId, servings) =>
        set((state) => ({
          selectedServings: { ...state.selectedServings, [recipeId]: Math.max(1, servings) },
        })),
      setRecipeTranslation: (recipeId, language, texts) =>
        set((state) => ({
          translations: {
            ...state.translations,
            [recipeId]: { ...state.translations[recipeId], [language]: texts },
          },
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
        translations: {},
      }),
    }
  )
);
