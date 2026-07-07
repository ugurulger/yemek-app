export interface RecipeMacros {
  protein: number;
  karb: number;
  yag: number;
}

export type RecipeDifficulty = 'Kolay' | 'Orta' | 'Zor';

export interface RecipeIngredient {
  name: string;
  /**
   * Malzemenin envanterde (veya temel kilerde: tuz, karabiber, su, sıvı yağ)
   * bulunup bulunmadığı — Claude tarif üretirken envanter listesine göre işaretler.
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
  match_pct: number;
  ingredients: RecipeIngredient[];
  /** Envanterde olmayan malzeme sayısı — kartta "2 eksik" rozeti için. */
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
