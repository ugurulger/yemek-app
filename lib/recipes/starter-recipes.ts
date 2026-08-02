import type { Recipe } from '@/types/recipe';

/**
 * İlk açılış "starter" tarifleri — yeni kullanıcı Kayıtlı/Plan/Detay
 * ekranlarını boş görmesin diye tek seferlik tohumlanan 4 İngilizce örnek
 * (kullanıcı kararı, 2026-07-19: içerik İngilizce; tek dokunuşla topluca
 * kaldırılabilir — bkz. store/cookbookStore.ts seed/remove aksiyonları ve
 * Kayıtlı ekranındaki banner). sample-imports.ts'ten farkı: onlar "+" içe
 * aktarma AKIŞININ ürünü, bunlar açılış tohumu. Enum alanları (difficulty,
 * nutrition_tag, category) şema gereği Türkçe kalır; `in_inventory`
 * makul varsayılandır — rozetler canlı `computeMissing` ile hesaplanır.
 */
export const STARTER_RECIPES: Recipe[] = [
  {
    id: 'starter-tomato-pasta',
    name: 'Creamy Tomato Pasta',
    emoji: '🍝',
    kcal: 520,
    servings: 2,
    time_min: 25,
    difficulty: 'Kolay',
    macros: { protein: 16, karb: 68, yag: 20 },
    match_pct: 75,
    missing_count: 2,
    nutrition_tag: 'Dengeli',
    language: 'en',
    ingredients: [
      { name: 'Pasta', qty: 250, unit: 'g', kcal: 340, category: 'Bakliyat & Makarna', in_inventory: true },
      { name: 'Tomato Paste', qty: 2, unit: 'tbsp', kcal: 30, category: 'Baharat & Sos', in_inventory: true },
      { name: 'Cream', qty: 150, unit: 'ml', kcal: 290, category: 'Süt & Peynir', in_inventory: false },
      { name: 'Garlic', qty: 2, unit: 'cloves', kcal: 9, category: 'Meyve & Sebze', in_inventory: true },
      { name: 'Parmesan', qty: 30, unit: 'g', kcal: 120, category: 'Süt & Peynir', in_inventory: false },
      { name: 'Olive Oil', qty: 1, unit: 'tbsp', kcal: 120, category: 'Baharat & Sos', in_inventory: true },
    ],
    steps: [
      'Cook the pasta in salted water until al dente; keep a cup of pasta water.',
      'Sauté the garlic in olive oil, stir in the tomato paste for a minute.',
      'Pour in the cream, loosen with pasta water and simmer for 2-3 minutes.',
      'Toss the pasta in the sauce and finish with grated parmesan.',
    ],
    chef_tip: 'The starchy pasta water is the secret: it turns the sauce silky and helps it cling.',
    image_prompt_en:
      'Creamy tomato pasta in a rustic bowl, topped with shaved parmesan and basil leaf.',
  },
  {
    id: 'starter-veggie-omelette',
    name: 'Fluffy Veggie Omelette',
    emoji: '🍳',
    kcal: 310,
    servings: 1,
    time_min: 15,
    difficulty: 'Kolay',
    macros: { protein: 19, karb: 8, yag: 23 },
    match_pct: 85,
    missing_count: 1,
    nutrition_tag: 'Protein',
    language: 'en',
    ingredients: [
      { name: 'Eggs', qty: 3, unit: 'pcs', kcal: 234, category: 'Diğer', in_inventory: false },
      { name: 'Bell Pepper', qty: 1, unit: 'pcs', kcal: 24, category: 'Meyve & Sebze', in_inventory: false },
      { name: 'Tomato', qty: 1, unit: 'pcs', kcal: 22, category: 'Meyve & Sebze', in_inventory: false },
      { name: 'Butter', qty: 1, unit: 'tbsp', kcal: 100, category: 'Süt & Peynir', in_inventory: true },
      { name: 'Salt', qty: 1, unit: 'pinch', kcal: 0, category: 'Baharat & Sos', in_inventory: true },
    ],
    steps: [
      'Whisk the eggs with a pinch of salt until slightly frothy.',
      'Soften the diced pepper and tomato in butter over medium heat.',
      'Pour in the eggs and cook gently, pulling the edges toward the center.',
      'Fold in half when just set and slide onto a plate.',
    ],
    chef_tip: 'Take it off the heat while the center still looks a little wet: it finishes cooking on the plate.',
    image_prompt_en:
      'Fluffy folded omelette with bell peppers and tomatoes on a white plate, morning light.',
  },
  {
    id: 'starter-chicken-bites',
    name: 'Garlic Butter Chicken Bites',
    emoji: '🍗',
    kcal: 430,
    servings: 2,
    time_min: 20,
    difficulty: 'Kolay',
    macros: { protein: 42, karb: 4, yag: 27 },
    match_pct: 60,
    missing_count: 2,
    nutrition_tag: 'Protein',
    language: 'en',
    ingredients: [
      { name: 'Chicken Breast', qty: 400, unit: 'g', kcal: 660, category: 'Et & Şarküteri', in_inventory: false },
      { name: 'Butter', qty: 2, unit: 'tbsp', kcal: 200, category: 'Süt & Peynir', in_inventory: true },
      { name: 'Garlic', qty: 3, unit: 'cloves', kcal: 13, category: 'Meyve & Sebze', in_inventory: true },
      { name: 'Paprika', qty: 1, unit: 'tsp', kcal: 6, category: 'Baharat & Sos', in_inventory: true },
      { name: 'Parsley', qty: 2, unit: 'sprigs', kcal: 2, category: 'Meyve & Sebze', in_inventory: false },
    ],
    steps: [
      'Cut the chicken into bite-size cubes and season with salt and paprika.',
      'Sear in a hot pan for 3-4 minutes until golden on all sides.',
      'Lower the heat, add butter and garlic, and baste the chicken for 2 minutes.',
      'Scatter chopped parsley over the top and serve hot.',
    ],
    chef_tip: "Don't crowd the pan: sear in two batches so the bites brown instead of steaming.",
    image_prompt_en:
      'Golden garlic butter chicken bites in a cast-iron skillet, garnished with parsley.',
  },
  {
    id: 'starter-chickpea-salad',
    name: 'Crunchy Chickpea Salad',
    emoji: '🥗',
    kcal: 380,
    servings: 2,
    time_min: 15,
    difficulty: 'Kolay',
    macros: { protein: 13, karb: 45, yag: 16 },
    match_pct: 70,
    missing_count: 2,
    nutrition_tag: 'Hafif',
    language: 'en',
    ingredients: [
      { name: 'Chickpeas', qty: 1, unit: 'can', kcal: 420, category: 'Bakliyat & Makarna', in_inventory: false },
      { name: 'Cucumber', qty: 1, unit: 'pcs', kcal: 16, category: 'Meyve & Sebze', in_inventory: false },
      { name: 'Tomato', qty: 2, unit: 'pcs', kcal: 44, category: 'Meyve & Sebze', in_inventory: false },
      { name: 'Red Onion', qty: 1, unit: 'half', kcal: 20, category: 'Meyve & Sebze', in_inventory: true },
      { name: 'Olive Oil', qty: 2, unit: 'tbsp', kcal: 240, category: 'Baharat & Sos', in_inventory: true },
      { name: 'Lemon', qty: 1, unit: 'half', kcal: 8, category: 'Meyve & Sebze', in_inventory: false },
    ],
    steps: [
      'Rinse and drain the chickpeas, then pat them dry.',
      'Dice the cucumber, tomatoes and red onion into small cubes.',
      'Whisk olive oil with lemon juice, salt and a pinch of chili flakes.',
      'Toss everything together and let it sit for 5 minutes before serving.',
    ],
    chef_tip: 'Drying the chickpeas well keeps the salad crunchy instead of soggy.',
    image_prompt_en:
      'Fresh chickpea salad with cucumber, tomato and red onion in a ceramic bowl, lemon wedge on the side.',
  },
];

/** Tek dokunuşla kaldırma için sabit id listesi (banner → removeStarterRecipes). */
export const STARTER_RECIPE_IDS = STARTER_RECIPES.map((recipe) => recipe.id);
