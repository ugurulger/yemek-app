/**
 * Tarif → sepet köprüsü (Faz 1 kontratı) — hem tarif listesi (kart rozeti)
 * hem detay ekranı (kişi sayısı senkronu) AYNI mantığı kullanır:
 * eksikler CANLI envanter+kilere göre hesaplanır, seçili kişi sayısına
 * ölçeklenir ve `cartStore.syncRecipeMissing`'e verilecek şekle çevrilir.
 *
 * İş 3c — iki dilli sepet adları: `recipe` HER ZAMAN orijinal (üretildiği
 * dildeki) tariftir — kanonik `name` bu dilden gelir. Çağıran ekran, elinde
 * tarifin KARŞI dildeki çevirisi varsa (bkz. src/i18n/recipeI18n.ts —
 * ekstra çeviri çağrısı yapılmaz, mevcut çeviri kullanılır) `counterpart`
 * ile malzeme adlarını index hizalı geçirir; kayıt her iki dil adıyla yazılır
 * ve render aktif dile göre seçer. Karşılık yoksa kayıt üretim dilindeki
 * adla kalır (bilinçli kapsam sınırı — gerçek eksikler için ekstra çeviri
 * katmanı KURULMAZ).
 */
import { computeMissing, scaleQty } from '@/lib/recipes/recipe-math';
import type { CartMissingInput } from '@/store/cartStore';
import type { InventoryItem } from '@/types/inventory';
import type { PantryItem } from '@/types/pantry';
import type { Recipe } from '@/types/recipe';

export interface CartCounterpartNames {
  /** Karşı dilin kodu (aktif uygulama dili — ekran sınırından iner). */
  language: 'tr' | 'en';
  /** `recipe.ingredients` ile AYNI SIRA/uzunlukta çevrilmiş malzeme adları. */
  ingredientNames: readonly string[];
}

export function buildCartMissingInput(
  recipe: Recipe,
  targetServings: number,
  inventory: readonly Pick<InventoryItem, 'name'>[],
  pantry: readonly Pick<PantryItem, 'name' | 'active'>[],
  counterpart?: CartCounterpartNames
): CartMissingInput[] {
  const sourceLanguage: 'tr' | 'en' = recipe.language ?? 'tr';
  return computeMissing(recipe, inventory, pantry).map((ingredient) => {
    // computeMissing, recipe.ingredients'ın kendi öğelerini (aynı referans)
    // filtreleyerek döndürür — index hizalı çeviri adına buradan ulaşılır.
    const index = recipe.ingredients.indexOf(ingredient);
    const counterpartName =
      counterpart && counterpart.language !== sourceLanguage
        ? counterpart.ingredientNames[index]
        : undefined;
    return {
      name: ingredient.name,
      nameTr: sourceLanguage === 'tr' ? ingredient.name : counterpartName,
      nameEn: sourceLanguage === 'en' ? ingredient.name : counterpartName,
      qty: scaleQty(ingredient.qty, recipe.servings, targetServings),
      unit: ingredient.unit,
      category: ingredient.category,
    };
  });
}
