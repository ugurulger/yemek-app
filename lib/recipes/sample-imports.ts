import type { Recipe } from '@/types/recipe';

/**
 * "+" Tarif Ekle akışının örnek tarifleri — referans (Mutfagim.dc.html
 * recipes DB'sindeki 'somon-bowl' ve 'menemen' kayıtları) birebir taşındı.
 * Bunlar mock değil, akışın ürünü olan gerçek içerik: Instagram taklidi /
 * "Örnek tarifle dene" somon bowl'u, web taklidi menemeni içe aktarır
 * (bkz. store/cookbookStore.ts — importRecipe). `in_inventory` bayrakları
 * makul varsayılanlardır; rozetler/bölümleme zaten canlı `computeMissing`
 * ile hesaplanır.
 */
export const SAMPLE_INSTAGRAM_RECIPE: Recipe = {
  id: 'import-somon-bowl',
  name: 'Ballı Acılı Somon Bowl',
  emoji: '🍣',
  kcal: 540,
  servings: 2,
  time_min: 25,
  difficulty: 'Kolay',
  macros: { protein: 34, karb: 42, yag: 26 },
  match_pct: 63,
  missing_count: 3,
  nutrition_tag: 'Protein',
  ingredients: [
    { name: 'Somon', qty: 400, unit: 'g', kcal: 480, category: 'Et & Şarküteri', in_inventory: false },
    { name: 'Pirinç', qty: 1, unit: 'su bardağı', kcal: 340, category: 'Bakliyat & Makarna', in_inventory: true },
    { name: 'Salatalık', qty: 1, unit: 'adet', kcal: 16, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Havuç', qty: 1, unit: 'adet', kcal: 25, category: 'Meyve & Sebze', in_inventory: false },
    { name: 'Kırmızı Lahana', qty: 1, unit: 'çeyrek baş', kcal: 22, category: 'Meyve & Sebze', in_inventory: false },
    { name: 'Yeşil Soğan', qty: 3, unit: 'dal', kcal: 9, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Susam', qty: 1, unit: 'yk', kcal: 52, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Soya Sosu', qty: 2, unit: 'yk', kcal: 18, category: 'Baharat & Sos', in_inventory: true },
  ],
  steps: [
    'Somonu kuşbaşı doğrayıp bal, soya sosu ve pul biberle marine et.',
    'Tavada 4-5 dk mühürleyerek pişir.',
    'Pirinci haşlayıp kâseye yay.',
    'Sebzeleri doğrayıp diz, somonu ekle, susam serp.',
  ],
  chef_tip: 'Somonu marine ettikten sonra 10 dk beklet; bal karamelize olunca dışı çıtır olur.',
  image_prompt_en:
    'Honey-glazed spicy salmon rice bowl with cucumber, carrot and red cabbage. Served in a ceramic bowl topped with sesame seeds and spring onion.',
};

export const SAMPLE_WEB_RECIPE: Recipe = {
  id: 'import-menemen',
  name: 'Menemen',
  emoji: '🍳',
  kcal: 320,
  servings: 2,
  time_min: 20,
  difficulty: 'Kolay',
  macros: { protein: 18, karb: 12, yag: 22 },
  match_pct: 100,
  missing_count: 0,
  nutrition_tag: 'Protein',
  ingredients: [
    { name: 'Yumurta', qty: 3, unit: 'adet', kcal: 234, category: 'Diğer', in_inventory: true },
    { name: 'Domates', qty: 2, unit: 'adet', kcal: 44, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Yeşil Biber', qty: 2, unit: 'adet', kcal: 24, category: 'Meyve & Sebze', in_inventory: true },
    { name: 'Zeytinyağı', qty: 2, unit: 'yk', kcal: 240, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Tuz', qty: 1, unit: 'tutam', kcal: 0, category: 'Baharat & Sos', in_inventory: true },
    { name: 'Pul Biber', qty: 1, unit: 'tk', kcal: 3, category: 'Baharat & Sos', in_inventory: true },
  ],
  steps: [
    'Biberleri zeytinyağında yumuşayana kadar kavur.',
    'Rendelenmiş domatesi ekle, suyunu çekene dek pişir.',
    'Yumurtaları kır, tuz ve pul biberle karıştır.',
    'Hafifçe pişince ocaktan al, sıcak servis et.',
  ],
  chef_tip: 'Yumurtaları çok karıştırma; iri parçalar hâlinde kalması menemenin dokusunu güzelleştirir.',
  image_prompt_en:
    'Turkish menemen scrambled eggs with tomatoes and green peppers in a traditional pan. Rustic, with soft folds of egg and a drizzle of olive oil.',
};
