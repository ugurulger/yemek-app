export interface RecipeMacros {
  protein: number;
  karb: number;
  yag: number;
}

export type RecipeDifficulty = 'Kolay' | 'Orta' | 'Zor';

/**
 * Tarif kartındaki beslenme etiketi (spec §4: süre · zorluk · beslenme
 * etiketi şeridi) — model tarif başına tek etiket seçer.
 */
export const NUTRITION_TAGS = ['Protein', 'Enerji', 'Lifli', 'Hafif', 'Dengeli', 'Onarım'] as const;

export type NutritionTag = (typeof NUTRITION_TAGS)[number];

/**
 * Malzeme kategorisi — market sepetinin kategori gruplaması için (spec §6).
 * Model her malzemeye tarif üretirken atar; sepete giden eksik malzemeler bu
 * alana göre gruplanır.
 */
export const INGREDIENT_CATEGORIES = [
  'Meyve & Sebze',
  'Süt & Peynir',
  'Et & Şarküteri',
  'Bakliyat & Makarna',
  'Baharat & Sos',
  'Diğer',
] as const;

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number];

export interface RecipeIngredient {
  name: string;
  /**
   * Tarifin VARSAYILAN kişi sayısı (`Recipe.servings`) için miktar. Kişi
   * sayısı değişince UI'da `scaleServings` (lib/recipes/recipe-math.ts) ile
   * orantılı ölçeklenir — bu alan hep varsayılan porsiyonun değerini taşır.
   */
  qty: number;
  /** Serbest Türkçe birim: "g", "su bardağı", "yk", "adet", "kutu"... */
  unit: string;
  /** Bu malzemenin varsayılan porsiyondaki toplam kalorisi (detay ekranı satırı). */
  kcal: number;
  /** Market sepeti gruplaması için sabit listeden kategori. */
  category: IngredientCategory;
  /**
   * Malzemenin envanterde veya kilerde bulunup bulunmadığı — Claude tarif
   * üretirken envanter listesine göre işaretler. Kiler malzemeleri (geniş
   * liste: baharatlar, yağlar, un/şeker, salça, soğan/sarımsak, makarna/
   * pirinç/bulgur — bkz. `PANTRY_STAPLES`, lib/claude/generateRecipes.ts)
   * her zaman evde var kabul edilir ve daima true işaretlenir (MVP-16).
   * MVP'nin bu fazından itibaren kiler = kullanıcının AKTİF bıraktığı
   * `PantryItem`'lar (bkz. store/pantryStore.ts).
   */
  in_inventory: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  kcal: number;
  servings: number;
  time_min: number;
  difficulty: RecipeDifficulty;
  macros: RecipeMacros;
  /**
   * Envanterde bulunan malzeme oranı (kodda hesaplanır). MVP-16'dan beri
   * katmanlama/sıralama `missing_count` ile yapılır — bu alan sadece bilgi
   * amaçlı tutulur (eski cache + detay ekranı uyumu), UI kartında gösterilmez.
   */
  match_pct: number;
  ingredients: RecipeIngredient[];
  /**
   * Envanterde/kilerde olmayan malzeme sayısı (kodda hesaplanır) — kartta
   * "2 eksik" rozeti ve MVP-16'dan beri bölüm ataması (0 = "Hemen
   * Yapabilirsin", 1+ = "Küçük Bir Alışverişle") bunu kullanır.
   */
  missing_count: number;
  steps: string[];
  /** Kısa, pratik şef önerisi/tüyosu — tarif detayında amber vurguyla gösterilir. */
  chef_tip: string;
  /** Kart meta şeridindeki beslenme etiketi ("süre · zorluk · etiket"). */
  nutrition_tag: NutritionTag;
  /**
   * Görsel üretimi için kısa İngilizce yemek tanımı + tek cümlelik tabaklama
   * betimlemesi — Claude tarif üretirken doldurur (ekstra LLM çağrısı gerekmez),
   * `services/images/recipe-image.ts` bunu prompt şablonuna yerleştirir.
   * Eski önbelleklenmiş tariflerde bulunmayabilir (opsiyonel).
   */
  image_prompt_en?: string;
  /**
   * İş 1: RAG akışının fine dining havuzundan üretilen tarifler bu alanla
   * ayırt edilir — listede ayrı "Fine Dining" bölümünde, kart üzerinde küçük
   * rozetle gösterilirler. Normal tariflerde alan hiç bulunmaz (edge function
   * şemasıyla senkron — supabase/functions/generate-recipe/index.ts).
   */
  category?: 'fine-dining';
}
