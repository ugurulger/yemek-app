import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { STARTER_RECIPES } from '@/lib/recipes/starter-recipes';
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
  /** "Add a Cookbook" akışı: verilen adla boş bir defter oluşturur. */
  createCookbook: (name: string) => void;
  /**
   * Starter tarif tohumu denendi mi — SADECE ilk açılışta bir kez koşsun
   * diye kalıcı bayrak (tohum atlansa bile true olur ki güncelleme alan
   * eski kullanıcıya sonradan örnek basılmasın).
   */
  starterSeeded: boolean;
  /**
   * İlk açılış tohumu (app/_layout.tsx, hidrasyon sonrası): hesap gerçekten
   * TAZE ise (hiç kayıtlı/içe aktarılmış tarif yoksa) STARTER_RECIPES
   * "Kategorisiz" defterine import edilir; değilse yalnız bayrak yazılır.
   */
  seedStarterRecipes: () => void;
  /** Kayıtlı ekranındaki banner'ın tek dokunuşluk "örnekleri kaldır" aksiyonu. */
  removeStarterRecipes: () => void;
  /**
   * Starter bilgi kartının görüntülenme sayacı (kalıcı) — kart EN FAZLA ilk
   * 2 görüntülemede gösterilir, sonra kendiliğinden bir daha çıkmaz
   * (kullanıcı kararı, 2026-08-02).
   */
  starterBannerViews: number;
  /**
   * Kartın kalıcı kapanma bayrağı: X ile kapatma VE "örnekleri kaldır" bunu
   * set eder. Görünürlük bu bayrağa bağlı olduğu için kartın kaybolması
   * tarif listelerinin durumundan BAĞIMSIZ garantidir (eski "Remove
   * samples'a rağmen kart duruyor" şikayetinin kalıcı sigortası).
   */
  starterBannerDismissed: boolean;
  /** Ekran odaklandığında kart gösterildiyse sayacı bir artırır. */
  recordStarterBannerView: () => void;
  /** X butonu — kartı kalıcı kapatır (tarifler durmaya devam eder). */
  dismissStarterBanner: () => void;
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
      createCookbook: (name) =>
        set((state) => ({
          cookbooks: [
            ...state.cookbooks,
            // Benzersiz id: Date.now yeterli — aynı milisaniyede iki defter
            // oluşturulamaz (tek kullanıcı, tek buton).
            { id: `cookbook-${Date.now()}`, name: name.trim(), recipeIds: [] },
          ],
        })),
      starterSeeded: false,
      seedStarterRecipes: () =>
        set((state) => {
          if (state.starterSeeded) return state;
          // Taze hesap kontrolü: kullanıcının kendi tarifi varsa örnek basma —
          // yalnız bayrağı yaz (güncelleme sonrası ilk açılış senaryosu).
          if (state.savedRecipeIds.length > 0 || state.importedRecipes.length > 0) {
            return { ...state, starterSeeded: true };
          }
          const starterIds = STARTER_RECIPES.map((recipe) => recipe.id);
          return {
            ...state,
            starterSeeded: true,
            cookbooks: state.cookbooks.map((cookbook) =>
              cookbook.id === UNCATEGORIZED_COOKBOOK_ID
                ? { ...cookbook, recipeIds: [...starterIds, ...cookbook.recipeIds] }
                : cookbook
            ),
            importedRecipes: [...STARTER_RECIPES, ...state.importedRecipes],
            savedRecipeIds: [...starterIds, ...state.savedRecipeIds],
          };
        }),
      removeStarterRecipes: () =>
        set((state) => {
          const starterIds = new Set(STARTER_RECIPES.map((recipe) => recipe.id));
          const cookbooks = state.cookbooks.map((cookbook) => ({
            ...cookbook,
            recipeIds: cookbook.recipeIds.filter((id) => !starterIds.has(id)),
          }));
          const savedRecipeIds = state.savedRecipeIds.filter((id) => !starterIds.has(id));
          return {
            ...state,
            cookbooks,
            savedRecipeIds,
            importedRecipes: pruneImported(
              state.importedRecipes.filter((recipe) => !starterIds.has(recipe.id)),
              cookbooks,
              savedRecipeIds
            ),
            // Kart da kalıcı kapanır — tarif listesi ne durumda olursa olsun.
            starterBannerDismissed: true,
          };
        }),
      starterBannerViews: 0,
      starterBannerDismissed: false,
      recordStarterBannerView: () =>
        set((state) => ({ starterBannerViews: state.starterBannerViews + 1 })),
      dismissStarterBanner: () => set({ starterBannerDismissed: true }),
    }),
    {
      name: 'yemek-app-cookbooks',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
    }
  )
);
