import { useMemo } from 'react';

import { useCookbookStore } from '@/store/cookbookStore';
import { useRecipeStore } from '@/store/recipeStore';
import type { Recipe } from '@/types/recipe';

/**
 * Tarifi id ile HER İKİ kaynakta arar: önce üretilmiş tarifler
 * (recipeStore), sonra içe aktarılmış/deftere kopyalanmış tarifler
 * (cookbookStore.importedRecipes). Detay ekranı ve defter görünümleri
 * yalnızca üretilmiş listeye bakarsa import edilen tarifler açılamaz —
 * bu hook tek doğru kaynak.
 */
export function useRecipeById(id: string | undefined): Recipe | undefined {
  const generated = useRecipeStore((state) => state.recipes);
  const imported = useCookbookStore((state) => state.importedRecipes);
  return useMemo(() => {
    if (!id) return undefined;
    return (
      generated.find((recipe) => recipe.id === id) ??
      imported.find((recipe) => recipe.id === id)
    );
  }, [id, generated, imported]);
}

/**
 * Bir id listesini Recipe objelerine çözer (defter detayı / kolaj kapak).
 * Artık hiçbir kaynakta bulunamayan id'ler sessizce atlanır (örn. envanter
 * değişince yeniden üretilmiş ve kaybolmuş eski tarif).
 */
export function useResolveRecipes(ids: readonly string[]): Recipe[] {
  const generated = useRecipeStore((state) => state.recipes);
  const imported = useCookbookStore((state) => state.importedRecipes);
  return useMemo(() => {
    const byId = new Map<string, Recipe>();
    for (const recipe of imported) byId.set(recipe.id, recipe);
    for (const recipe of generated) byId.set(recipe.id, recipe);
    return ids
      .map((id) => byId.get(id))
      .filter((recipe): recipe is Recipe => recipe !== undefined);
  }, [ids, generated, imported]);
}
