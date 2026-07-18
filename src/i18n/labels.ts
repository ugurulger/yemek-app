/**
 * Veri-enum → çeviri anahtarı eşlemeleri (BLOK B).
 *
 * Şema/enum DEĞERLERİ veri olarak Türkçe kalır (Recipe şeması, cache'ler,
 * LLM tool şemaları bunlara bağlı — bkz. types/recipe.ts, types/inventory.ts);
 * yalnızca GÖSTERİM bu anahtarlarla çevrilir. Tanınmayan değerde anahtar
 * yerine değerin kendisi döndürülür (eski cache verisi kırılmasın).
 */
import type { PantryCategory } from '@/types/pantry';
import type { IngredientCategory, NutritionTag, RecipeDifficulty } from '@/types/recipe';

const INGREDIENT_CATEGORY_KEYS: Record<IngredientCategory, string> = {
  'Meyve & Sebze': 'data.category.produce',
  'Süt & Peynir': 'data.category.dairy',
  'Et & Şarküteri': 'data.category.meatDeli',
  'Bakliyat & Makarna': 'data.category.grains',
  'Baharat & Sos': 'data.category.spices',
  Diğer: 'data.category.other',
};

const DIFFICULTY_KEYS: Record<RecipeDifficulty, string> = {
  Kolay: 'data.difficulty.easy',
  Orta: 'data.difficulty.medium',
  Zor: 'data.difficulty.hard',
};

const NUTRITION_TAG_KEYS: Record<NutritionTag, string> = {
  Protein: 'data.nutritionTag.protein',
  Enerji: 'data.nutritionTag.energy',
  Lifli: 'data.nutritionTag.fiber',
  Hafif: 'data.nutritionTag.light',
  Dengeli: 'data.nutritionTag.balanced',
  Onarım: 'data.nutritionTag.repair',
};

const PANTRY_CATEGORY_KEYS: Record<PantryCategory, string> = {
  Baharatlar: 'data.pantryCategory.spices',
  Yağlar: 'data.pantryCategory.oils',
  Kiler: 'data.pantryCategory.pantry',
  'Bakliyat & Makarna': 'data.pantryCategory.grains',
  'Sebze Bazları': 'data.pantryCategory.vegBases',
};

/**
 * Varsayılan kiler malzemelerinin (types/pantry.ts DEFAULT_PANTRY_ITEMS)
 * gösterim anahtarları — VERİ adları Türkçe kalır (prompt'lara bu ad gider),
 * kullanıcı kendi eklediği malzemelerde anahtar yoktur → ad olduğu gibi döner.
 */
const PANTRY_ITEM_KEYS: Record<string, string> = {
  Tuz: 'data.pantryItem.salt',
  Karabiber: 'data.pantryItem.blackPepper',
  'Pul Biber': 'data.pantryItem.chiliFlakes',
  Kimyon: 'data.pantryItem.cumin',
  Kekik: 'data.pantryItem.thyme',
  Nane: 'data.pantryItem.mint',
  'Toz K. Biber': 'data.pantryItem.paprika',
  'Sıvı Yağ': 'data.pantryItem.cookingOil',
  Zeytinyağı: 'data.pantryItem.oliveOil',
  Tereyağı: 'data.pantryItem.butter',
  Un: 'data.pantryItem.flour',
  Şeker: 'data.pantryItem.sugar',
  Su: 'data.pantryItem.water',
  Sirke: 'data.pantryItem.vinegar',
  Salça: 'data.pantryItem.tomatoPaste',
  Makarna: 'data.pantryItem.pasta',
  Pirinç: 'data.pantryItem.rice',
  Bulgur: 'data.pantryItem.bulgur',
  Soğan: 'data.pantryItem.onion',
  Sarımsak: 'data.pantryItem.garlic',
};

export function pantryCategoryKey(category: PantryCategory | string): string {
  return PANTRY_CATEGORY_KEYS[category as PantryCategory] ?? category;
}

export function pantryItemKey(name: string): string {
  return PANTRY_ITEM_KEYS[name] ?? name;
}

export function ingredientCategoryKey(category: IngredientCategory | string): string {
  return INGREDIENT_CATEGORY_KEYS[category as IngredientCategory] ?? category;
}

export function difficultyKey(difficulty: RecipeDifficulty | string): string {
  return DIFFICULTY_KEYS[difficulty as RecipeDifficulty] ?? difficulty;
}

export function nutritionTagKey(tag: NutritionTag | string): string {
  return NUTRITION_TAG_KEYS[tag as NutritionTag] ?? tag;
}
