/**
 * Tarif → sepet köprüsü (Faz 1 kontratı) — hem tarif listesi (kart rozeti)
 * hem detay ekranı (kişi sayısı senkronu) AYNI mantığı kullanır:
 * eksikler CANLI envanter+kilere göre hesaplanır, seçili kişi sayısına
 * ölçeklenir ve `cartStore.syncRecipeMissing`'e verilecek şekle çevrilir.
 */
import { computeMissing, scaleQty } from '@/lib/recipes/recipe-math';
import type { CartMissingInput } from '@/store/cartStore';
import type { InventoryItem } from '@/types/inventory';
import type { PantryItem } from '@/types/pantry';
import type { Recipe } from '@/types/recipe';

export function buildCartMissingInput(
  recipe: Recipe,
  targetServings: number,
  inventory: readonly Pick<InventoryItem, 'name'>[],
  pantry: readonly Pick<PantryItem, 'name' | 'active'>[]
): CartMissingInput[] {
  return computeMissing(recipe, inventory, pantry).map((ingredient) => ({
    name: ingredient.name,
    qty: scaleQty(ingredient.qty, recipe.servings, targetServings),
    unit: ingredient.unit,
    category: ingredient.category,
  }));
}
