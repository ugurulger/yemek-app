export interface RecipeMacros {
  protein: number;
  karb: number;
  yag: number;
}

export type RecipeDifficulty = 'Kolay' | 'Orta' | 'Zor';

export interface RecipeIngredient {
  name: string;
  /**
   * Malzemenin envanterde veya kilerde bulunup bulunmadığı — Claude tarif
   * üretirken envanter listesine göre işaretler. Kiler malzemeleri (geniş
   * liste: baharatlar, yağlar, un/şeker, salça, soğan/sarımsak, makarna/
   * pirinç/bulgur — bkz. `PANTRY_STAPLES`, lib/claude/generateRecipes.ts)
   * her zaman evde var kabul edilir ve daima true işaretlenir (MVP-16).
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
  /**
   * Görsel üretimi için kısa İngilizce yemek tanımı + tek cümlelik tabaklama
   * betimlemesi — Claude tarif üretirken doldurur (ekstra LLM çağrısı gerekmez),
   * `services/images/recipe-image.ts` bunu prompt şablonuna yerleştirir.
   * Eski önbelleklenmiş tariflerde bulunmayabilir (opsiyonel).
   */
  image_prompt_en?: string;
}
