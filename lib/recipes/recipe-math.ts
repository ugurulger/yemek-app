/**
 * Eksik malzeme hesabı ve kişi sayısı ölçekleme — UI'dan bağımsız SAF
 * fonksiyonlar (orkestrasyon Faz 1 kontratı). Birim testleri:
 * tests/unit/recipe-math.test.ts (node --test + tsx ile koşulur).
 */
import { namesMatch } from '@/lib/recipes/ingredient-match';
import type { InventoryItem } from '@/types/inventory';
import type { PantryItem } from '@/types/pantry';
import type { Recipe, RecipeIngredient } from '@/types/recipe';

/** Türkçe'ye duyarlı normalizasyon — UI'daki ad-anahtarı karşılaştırmaları için. */
export function normalizeIngredientName(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR');
}

/**
 * Bir malzeme adının envanter/kiler listesinde karşılığı var mı?
 * İş 3b'den beri üretim sonrası emniyet katmanıyla (lib/recipes/
 * ingredient-match.ts) AYNI normalize token eşleştirmesi kullanılır:
 * küçük harf + aksan temizliği + tekil/çoğul toleransı, token alt-küme
 * kuralı ("domates" ↔ "cherry domates"). Eski ham substring `includes`
 * kuralı kaldırıldı ("un" ⊂ "sabun" gibi yanlış pozitifler üretiyordu).
 */
function nameMatches(ingredientName: string, candidateName: string): boolean {
  return namesMatch(ingredientName, candidateName);
}

/**
 * Tarifin eksik malzemelerini CANLI envanter + aktif kiler durumuna göre
 * hesaplar. Modelin üretim anında işaretlediği `in_inventory` bayrağından
 * bağımsızdır — envanter/kiler üretimden sonra değişmiş olabilir; sepet ve
 * rozetler her zaman bu fonksiyonun sonucunu kullanmalıdır.
 */
export function computeMissing(
  recipe: Pick<Recipe, 'ingredients'>,
  inventory: readonly Pick<InventoryItem, 'name'>[],
  pantry: readonly Pick<PantryItem, 'name' | 'active'>[]
): RecipeIngredient[] {
  const available = [
    ...inventory.map((item) => item.name),
    ...pantry.filter((item) => item.active).map((item) => item.name),
  ];

  return recipe.ingredients.filter(
    (ingredient) => !available.some((name) => nameMatches(ingredient.name, name))
  );
}

/**
 * Miktarı hedef kişi sayısına orantılar ve insan-okur biçimde yuvarlar:
 * 1'in altı iki ondalık, 10'un altı bir ondalık, üstü tam sayı.
 */
export function scaleQty(qty: number, baseServings: number, targetServings: number): number {
  if (baseServings <= 0 || targetServings <= 0) return qty;
  const scaled = (qty * targetServings) / baseServings;
  if (scaled < 1) return Math.round(scaled * 100) / 100;
  if (scaled < 10) return Math.round(scaled * 10) / 10;
  return Math.round(scaled);
}

/** Ölçekli miktarı görüntü metnine çevirir ("0.5" → "0,5"). */
export function formatQty(qty: number): string {
  return qty.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

export interface ScaledIngredient extends RecipeIngredient {
  scaledQty: number;
  scaledKcal: number;
}

export interface ScaledRecipeView {
  servings: number;
  ingredients: ScaledIngredient[];
  /** Toplam besin değerleri — malzemelerle AYNI çarpanla (target/base) ölçekli. */
  kcal: number;
  macros: Recipe['macros'];
}

/**
 * Tarifi hedef kişi sayısına ölçekler (spec §5): her malzemenin miktarı ve
 * TEKİL kalorisi orantılanır; kalori ve makrolar da aynı çarpanla ölçeklenir
 * (kullanıcı kararı — kişi sayısı değişince besin değerleri de orantılı
 * güncellenir). Orijinal `Recipe` nesnesi DEĞİŞTİRİLMEZ.
 */
export function scaleServings(recipe: Recipe, targetServings: number): ScaledRecipeView {
  const target = Math.max(1, Math.round(targetServings));
  const base = Math.max(1, recipe.servings);
  const scaleValue = (value: number) => Math.round((value * target) / base);
  return {
    servings: target,
    ingredients: recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      scaledQty: scaleQty(ingredient.qty, recipe.servings, target),
      scaledKcal: scaleValue(ingredient.kcal),
    })),
    kcal: scaleValue(recipe.kcal),
    macros: {
      protein: scaleValue(recipe.macros.protein),
      karb: scaleValue(recipe.macros.karb),
      yag: scaleValue(recipe.macros.yag),
    },
  };
}
