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
 * Store'daki tariflerden hedef dilde karşılığı OLMAYANLARI paralel çevirir ve
 * her biri tamamlandıkça store'a yazar (kısmi başarı: bir tarifin çevirisi
 * başarısız olursa diğerleri ETKİLENMEZ; başarısız olan, bir sonraki dil
 * değişiminde yeniden denenir). Bkz. languageSync.ts — dil değişimi tetikler.
 */
export async function ensureRecipeTranslations(targetLanguage: AppLanguage): Promise<void> {
  const { recipes, translations } = useRecipeStore.getState();
  const pending = recipes.filter(
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
