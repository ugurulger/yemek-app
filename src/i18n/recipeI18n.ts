/**
 * Tariflerin dil değişiminde "topyekün" çevrilmesi (kullanıcı kararı):
 * tarifler ÜRETİLDİKLERİ dilde saklanır (Recipe.language); dil değişince
 * `ensureRecipeTranslations` mevcut tariflerin hedef dildeki metinlerini
 * (bkz. RecipeTexts) üretip recipeStore.translations'a yazar — İLK geçişte
 * çevrilir, sonraki geçişler cache'ten anında gelir. Gösterim tarafı
 * `useLocalizedRecipes`/`useLocalizedRecipe` ile çeviriyi orijinal tarifin
 * üstüne bindirir; sayısal/enum alanlar ve `id` DEĞİŞMEZ (computeMissing,
 * sepet ve görsel cache'i orijinal kayıtla çalışmaya devam eder).
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getAppLanguage, type AppLanguage } from './index';

import { translateRecipeTexts } from '@/lib/claude/translate';
import { useCookbookStore } from '@/store/cookbookStore';
import { useRecipeStore } from '@/store/recipeStore';
import type { Recipe, RecipeTexts } from '@/types/recipe';

/** Eski cache kayıtlarında `language` yok — üretim tarihsel olarak Türkçeydi. */
export function recipeLanguage(recipe: Pick<Recipe, 'language'>): AppLanguage {
  return recipe.language ?? 'tr';
}

/** Çeviri metinlerini orijinal tarifin üstüne bindirir (saf, kopya döner). */
export function localizeRecipe(recipe: Recipe, texts: RecipeTexts): Recipe {
  return {
    ...recipe,
    name: texts.name,
    chef_tip: texts.chef_tip,
    steps: texts.steps,
    ingredients: recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      name: texts.ingredients[index]?.name ?? ingredient.name,
      unit: texts.ingredients[index]?.unit ?? ingredient.unit,
    })),
  };
}

function localizeForCurrentLanguage(
  recipe: Recipe,
  translations: Record<string, Partial<Record<AppLanguage, RecipeTexts>>>,
  language: AppLanguage
): Recipe {
  if (recipeLanguage(recipe) === language) {
    return recipe;
  }
  const texts = translations[recipe.id]?.[language];
  // Çeviri henüz hazır değilse orijinal dil gösterilir (arka planda
  // ensureRecipeTranslations tamamlanınca store güncellenir ve UI yenilenir).
  return texts ? localizeRecipe(recipe, texts) : recipe;
}

/** Tarif listesini aktif uygulama diline yerelleştirir (gösterim katmanı). */
export function useLocalizedRecipes(recipes: Recipe[]): Recipe[] {
  // useTranslation: dil değişiminde yeniden render tetiklensin diye.
  useTranslation();
  const translations = useRecipeStore((state) => state.translations);
  const language = getAppLanguage();
  return useMemo(
    () => recipes.map((recipe) => localizeForCurrentLanguage(recipe, translations, language)),
    [recipes, translations, language]
  );
}

/** Tek tarifi aktif uygulama diline yerelleştirir (detay ekranı). */
export function useLocalizedRecipe(recipe: Recipe): Recipe {
  useTranslation();
  const translations = useRecipeStore((state) => state.translations);
  const language = getAppLanguage();
  return useMemo(
    () => localizeForCurrentLanguage(recipe, translations, language),
    [recipe, translations, language]
  );
}

/**
 * Üretilmiş (recipeStore) VE içe aktarılmış (cookbookStore.importedRecipes)
 * tariflerden hedef dilde karşılığı OLMAYANLARI paralel çevirir ve her biri
 * tamamlandıkça store'a yazar (kısmi başarı: bir tarifin çevirisi başarısız
 * olursa diğerleri ETKİLENMEZ; başarısız olan, bir sonraki tetikte yeniden
 * denenir). Çeviriler kaynaktan bağımsız recipeStore.translations'a recipeId
 * anahtarıyla yazılır — useLocalizedRecipe(s) iki kaynağın tarifini de aynı
 * haritadan çözer. Tetikler: dil değişimi (languageSync.ts) + içe aktarma
 * (ImportFlow — TR'deyken EN örnek import edilince toggle beklemesin).
 */
/** Persist'li store hidrasyonunu bekler — hidrasyon öncesi state BOŞ görünür. */
function waitForHydration(store: {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}): Promise<void> {
  if (store.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsubscribe = store.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

export async function ensureRecipeTranslations(targetLanguage: AppLanguage): Promise<void> {
  // Açılıştaki languageChanged (kayıtlı dil ≠ cihaz dili) store'lar AsyncStorage'dan
  // hidrate olmadan ateşlenebiliyor — beklenmezse süpürme boş listede gezer ve
  // içe aktarılan tarifler hiç çevrilmezdi (canlı gözlem, 2026-07-19).
  await Promise.all([waitForHydration(useRecipeStore), waitForHydration(useCookbookStore)]);
  const { recipes, translations } = useRecipeStore.getState();
  const imported = useCookbookStore.getState().importedRecipes;
  // İki kaynak tek havuzda; aynı id iki listede de varsa (deftere kopyalanan
  // üretilmiş tarif) üretilmiş kayıt kazanır — id bazlı tek çeviri yeter.
  const byId = new Map<string, Recipe>();
  for (const recipe of imported) byId.set(recipe.id, recipe);
  for (const recipe of recipes) byId.set(recipe.id, recipe);
  const pending = [...byId.values()].filter(
    (recipe) =>
      recipeLanguage(recipe) !== targetLanguage && !translations[recipe.id]?.[targetLanguage]
  );
  if (pending.length === 0) {
    return;
  }

  await Promise.allSettled(
    pending.map(async (recipe) => {
      try {
        const texts = await translateRecipeTexts(
          recipe,
          targetLanguage === 'tr' ? 'Turkish' : 'English'
        );
        useRecipeStore.getState().setRecipeTranslation(recipe.id, targetLanguage, texts);
      } catch (error) {
        console.warn(`[i18n] "${recipe.name}" tarif çevirisi başarısız:`, error);
      }
    })
  );
}
