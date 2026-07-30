import type { Recipe } from '@/types/recipe';

/**
 * "+" Tarif Ekle akışının örnek tarifleri — referans (Mutfagim.dc.html
 * recipes DB'sindeki 'somon-bowl' ve 'menemen' kayıtları) taşındı; App Store
 * İngilizce sürümüyle içerik doğal İngilizce'ye çevrildi ve `language: 'en'`
 * damgalandı (TR gösterim, mevcut tarif çeviri katmanından geçer — bkz.
 * src/i18n/recipeI18n.ts). Bunlar mock değil, akışın ürünü olan gerçek
 * içerik: Instagram taklidi / "Örnek tarifle dene" somon bowl'u, web taklidi
 * menemeni içe aktarır (bkz. store/cookbookStore.ts — importRecipe).
 * `in_inventory` bayrakları makul varsayılanlardır; rozetler/bölümleme
 * zaten canlı `computeMissing` ile hesaplanır. `category` değerleri veri
 * enum'u olarak Türkçe KALIR (şema kuralı — types/recipe.ts).
 */
export const SAMPLE_INSTAGRAM_RECIPE: Recipe = {
  id: 'import-somon-bowl',
  name: 'Honey Chili Salmon Bowl',
  emoji: '🍣',
  kcal: 540,
  servings: 2,
  time_min: 25,
  difficulty: 'Kolay',
  macros: { protein: 34, karb: 42, yag: 26 },
  match_pct: 63,
  missing_count: 3,
  nutrition_tag: 'Protein',
  language: 'en',
  ingredients: [
    { name: 'Salmon', qty: 400, unit: 'g', kcal: 480, category: 'Et & Şarküteri', in_inventory: false },
    { name: 'Rice', qty: 1, unit: 'cup', kcal: 340, category: 'Bakliyat & Makarna', in_inventory: true },
    { name: 'Cucumber', qty: 1, unit: 'piece', kcal: 16, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Carrot', qty: 1, unit: 'piece', kcal: 25, category: 'Meyve & Sebze', in_inventory: false },
    { name: 'Red Cabbage', qty: 1, unit: 'quarter head', kcal: 22, category: 'Meyve & Sebze', in_inventory: false },
    { name: 'Spring Onion', qty: 3, unit: 'stalks', kcal: 9, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Sesame Seeds', qty: 1, unit: 'tbsp', kcal: 52, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Soy Sauce', qty: 2, unit: 'tbsp', kcal: 18, category: 'Baharat & Sos', in_inventory: true },
  ],
  steps: [
    'Cube the salmon and marinate it in honey, soy sauce and chili flakes.',
    'Sear in a hot pan for 4-5 minutes until just cooked through.',
    'Cook the rice and spread it in a bowl.',
    'Slice the veggies and arrange them on top, add the salmon and sprinkle with sesame seeds.',
  ],
  chef_tip:
    'Let the salmon sit in the marinade for 10 minutes — the honey caramelizes into a crispy glaze.',
  image_prompt_en:
    'Honey-glazed spicy salmon rice bowl with cucumber, carrot and red cabbage. Served in a ceramic bowl topped with sesame seeds and spring onion.',
};

export const SAMPLE_WEB_RECIPE: Recipe = {
  id: 'import-menemen',
  name: 'Menemen (Turkish Scrambled Eggs)',
  emoji: '🍳',
  kcal: 320,
  servings: 2,
  time_min: 20,
  difficulty: 'Kolay',
  macros: { protein: 18, karb: 12, yag: 22 },
  match_pct: 100,
  missing_count: 0,
  nutrition_tag: 'Protein',
  language: 'en',
  ingredients: [
    { name: 'Eggs', qty: 3, unit: 'piece', kcal: 234, category: 'Diğer', in_inventory: true },
    { name: 'Tomatoes', qty: 2, unit: 'piece', kcal: 44, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Green Peppers', qty: 2, unit: 'piece', kcal: 24, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Olive Oil', qty: 2, unit: 'tbsp', kcal: 240, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Salt', qty: 1, unit: 'pinch', kcal: 0, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Chili Flakes', qty: 1, unit: 'tsp', kcal: 3, category: 'Baharat & Sos', in_inventory: true },
  ],
  steps: [
    'Sauté the peppers in olive oil until soft.',
    'Add the grated tomatoes and cook until the juices reduce.',
    'Crack in the eggs and stir gently with salt and chili flakes.',
    'Take off the heat while still soft and serve hot.',
  ],
  chef_tip:
    "Don't over-stir the eggs — keeping them in soft folds is what gives menemen its silky texture.",
  image_prompt_en:
    'Turkish menemen scrambled eggs with tomatoes and green peppers in a traditional pan. Rustic, with soft folds of egg and a drizzle of olive oil.',
};
