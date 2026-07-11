import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { UNCATEGORIZED_COOKBOOK_ID, type Cookbook } from '@/types/cookbook';
import type { Recipe } from '@/types/recipe';

/**
 * Varsayılan defter seti — referans (Mutfagim.dc.html state.cookbooks) ile
 * aynı adlar; uygulamada statik tarif DB'si olmadığı için hepsi boş başlar
 * (kolaj kapaklarda krem tile gösterilir). "Kategorisiz" içe aktarma
 * akışının sabit hedefidir, SİLİNMEZ.
 */
const DEFAULT_COOKBOOKS: Cookbook[] = [
  { id: UNCATEGORIZED_COOKBOOK_ID, name: 'Kategorisiz', recipeIds: [] },
  { id: 'aksam', name: 'Akşam Sofrası', recipeIds: [] },
  { id: 'kahvalti', name: 'Kahvaltılıklar', recipeIds: [] },
  { id: 'corba', name: 'Çorbalar', recipeIds: [] },
];

interface CookbookState {
  cookbooks: Cookbook[];
  /**
   * "+" akışıyla içe aktarılan tarifler — üretilen tariflerden BAĞIMSIZ
   * kalıcı yaşarlar (envanter değişince yeniden üretimle silinmezler).
   */
  importedRecipes: Recipe[];
  /** Kayıtlı tarif id'leri (en yeni başta) — Defterler butonunun dolu-yeşil durumu. */
  savedRecipeIds: string[];
  /** Tarifi defterde yoksa ekler, varsa çıkarır; eklemede kayıtlıya da yazar (referans davranışı). */
  toggleRecipeInCookbook: (cookbookId: string, recipe: Recipe) => void;
  /**
   * İçe aktarma (Instagram/web/örnek): tarif importedRecipes'e,
   * "Kategorisiz" defterine ve kayıtlıya eklenir (hepsi tekilleştirilmiş).
   */
  importRecipe: (recipe: Recipe) => void;
}

/**
 * importedRecipes yalnızca bir defterden referans edilen tarifleri taşımalı —
 * hiçbir defterde kalmayan import kaydı sızıntı olur ama kayıtlıda duruyor
 * olabilir; bu yüzden savedRecipeIds de referans sayılır.
 */
function pruneImported(
  importedRecipes: Recipe[],
  cookbooks: Cookbook[],
  savedRecipeIds: string[]
): Recipe[] {
  const referenced = new Set<string>(savedRecipeIds);
  for (const cookbook of cookbooks) {
    for (const id of cookbook.recipeIds) referenced.add(id);
  }
  return importedRecipes.filter((recipe) => referenced.has(recipe.id));
}

export const useCookbookStore = create<CookbookState>()(
  persist(
    (set) => ({
      cookbooks: DEFAULT_COOKBOOKS,
      importedRecipes: [],
      savedRecipeIds: [],
      toggleRecipeInCookbook: (cookbookId, recipe) =>
        set((state) => {
          const target = state.cookbooks.find((cookbook) => cookbook.id === cookbookId);
          const adding = target ? !target.recipeIds.includes(recipe.id) : false;
          const cookbooks = state.cookbooks.map((cookbook) => {
            if (cookbook.id !== cookbookId) return cookbook;
            return {
              ...cookbook,
              recipeIds: adding
                ? [recipe.id, ...cookbook.recipeIds]
                : cookbook.recipeIds.filter((id) => id !== recipe.id),
            };
          });
          const savedRecipeIds =
            adding && !state.savedRecipeIds.includes(recipe.id)
              ? [recipe.id, ...state.savedRecipeIds]
              : state.savedRecipeIds;
          // Deftere eklenen tarif üretilmiş (geçici) listeden geliyorsa
          // importedRecipes'e kopyalanır — envanter değişip liste yeniden
          // üretilse de defterdeki tarif açılabilir kalır.
          const importedRecipes = state.importedRecipes.some((r) => r.id === recipe.id)
            ? state.importedRecipes
            : [recipe, ...state.importedRecipes];
          return {
            cookbooks,
            savedRecipeIds,
            importedRecipes: pruneImported(importedRecipes, cookbooks, savedRecipeIds),
          };
        }),
      importRecipe: (recipe) =>
        set((state) => {
          const cookbooks = state.cookbooks.map((cookbook) =>
            cookbook.id === UNCATEGORIZED_COOKBOOK_ID && !cookbook.recipeIds.includes(recipe.id)
              ? { ...cookbook, recipeIds: [recipe.id, ...cookbook.recipeIds] }
              : cookbook
          );
          return {
            cookbooks,
            importedRecipes: state.importedRecipes.some((r) => r.id === recipe.id)
              ? state.importedRecipes
              : [recipe, ...state.importedRecipes],
            savedRecipeIds: state.savedRecipeIds.includes(recipe.id)
              ? state.savedRecipeIds
              : [recipe.id, ...state.savedRecipeIds],
          };
        }),
    }),
    {
      name: 'yemek-app-cookbooks',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
