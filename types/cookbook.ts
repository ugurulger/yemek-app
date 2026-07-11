/**
 * Defter (cookbook) — Kayıtlı sekmesinin koleksiyon birimi (referans SCREEN 5).
 * Tarifler id ile referanslanır; Recipe objesinin kendisi ya recipeStore'daki
 * üretilmiş listede ya da cookbookStore.importedRecipes'te yaşar
 * (bkz. lib/recipes/find-recipe.ts).
 */
export interface Cookbook {
  id: string;
  name: string;
  /** Deftere eklenme sırasına göre tarif id'leri (en yeni başta). */
  recipeIds: string[];
}

/** İçe aktarma akışında varsayılan hedef defterin sabit id'si. */
export const UNCATEGORIZED_COOKBOOK_ID = 'uncategorized';
