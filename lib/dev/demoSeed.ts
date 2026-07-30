import type { InventoryItem } from '@/types/inventory';
import type { Recipe } from '@/types/recipe';
import { useCartStore, cartItemKey } from '@/store/cartStore';
import { useInventoryStore } from '@/store/inventoryStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { usePlanStore, type PlanDay, type PlanMeal } from '@/store/planStore';
import { useRecipeStore, inventoryFingerprint } from '@/store/recipeStore';

/**
 * App Store ekran görüntüsü demo verisi — SADECE geliştirmede
 * (`__DEV__` + `EXPO_PUBLIC_DEMO_SEED=true`) çalışır, release bundle'ına
 * girmez. Store'ları gerçekçi İngilizce içerikle doldurur ki P6 ekran
 * görüntüleri boş durum yerine dolu ekranlar göstersin.
 * Kullanım: .env'e EXPO_PUBLIC_DEMO_SEED=true ekle, uygulamayı aç, seed
 * persist'e yazılır; ekran görüntüleri alındıktan sonra bayrağı kaldır.
 */

const inv = (
  id: string,
  nameEn: string,
  nameTr: string,
  qty: number,
  unit: InventoryItem['unit'],
  emoji: string,
  category?: InventoryItem['category']
): InventoryItem => ({
  id,
  name: nameEn,
  nameEn,
  nameTr,
  qty,
  unit,
  emoji,
  confidence: 97,
  category,
});

const DEMO_INVENTORY: InventoryItem[] = [
  inv('d-eggs', 'Eggs', 'Yumurta', 10, 'adet', '🥚', 'Şarküteri'),
  inv('d-milk', 'Milk', 'Süt', 1, 'l', '🥛', 'Süt Ürünleri'),
  inv('d-yogurt', 'Greek Yogurt', 'Yoğurt', 500, 'g', '🥣', 'Süt Ürünleri'),
  inv('d-feta', 'Feta Cheese', 'Beyaz Peynir', 200, 'g', '🧀', 'Peynir'),
  inv('d-chicken', 'Chicken Breast', 'Tavuk Göğsü', 500, 'g', '🍗', 'Şarküteri'),
  inv('d-beef', 'Ground Beef', 'Kıyma', 400, 'g', '🥩', 'Şarküteri'),
  inv('d-tomato', 'Tomatoes', 'Domates', 5, 'adet', '🍅', 'Meyve & Sebze'),
  inv('d-pepper', 'Bell Peppers', 'Biber', 3, 'adet', '🫑', 'Meyve & Sebze'),
  inv('d-zucchini', 'Zucchini', 'Kabak', 2, 'adet', '🥒', 'Meyve & Sebze'),
  inv('d-potato', 'Potatoes', 'Patates', 6, 'adet', '🥔', 'Meyve & Sebze'),
  inv('d-spinach', 'Fresh Spinach', 'Ispanak', 300, 'g', '🥬', 'Meyve & Sebze'),
  inv('d-lemon', 'Lemons', 'Limon', 2, 'adet', '🍋', 'Meyve & Sebze'),
];

const ing = (
  name: string,
  qty: number,
  unit: string,
  kcal: number,
  category: Recipe['ingredients'][number]['category'],
  in_inventory: boolean
) => ({ name, qty, unit, kcal, category, in_inventory });

const recipe = (r: Omit<Recipe, 'match_pct' | 'missing_count' | 'language'>): Recipe => {
  const missing = r.ingredients.filter((i) => !i.in_inventory).length;
  return {
    ...r,
    language: 'en',
    missing_count: missing,
    match_pct: Math.round(((r.ingredients.length - missing) / r.ingredients.length) * 100),
  };
};

const DEMO_RECIPES: Recipe[] = [
  recipe({
    id: 'demo-menemen',
    name: 'Turkish Menemen',
    emoji: '🍳',
    kcal: 420,
    servings: 2,
    time_min: 20,
    difficulty: 'Kolay',
    macros: { protein: 22, karb: 18, yag: 28 },
    nutrition_tag: 'Protein',
    ingredients: [
      ing('Eggs', 4, 'adet', 280, 'Et & Şarküteri', true),
      ing('Tomatoes', 3, 'adet', 60, 'Meyve & Sebze', true),
      ing('Bell Peppers', 2, 'adet', 50, 'Meyve & Sebze', true),
      ing('Olive Oil', 2, 'yk', 240, 'Baharat & Sos', true),
      ing('Feta Cheese', 80, 'g', 210, 'Süt & Peynir', true),
    ],
    steps: [
      'Dice the tomatoes and slice the peppers into thin strips.',
      'Soften the peppers in olive oil over medium heat, about 3 minutes.',
      'Add tomatoes and simmer until the juices thicken, 6-8 minutes.',
      'Crack the eggs on top and gently stir once — keep them soft.',
      'Crumble feta over the pan and serve straight from the skillet.',
    ],
    chef_tip: 'Take the pan off the heat while the eggs are still glossy — they finish cooking on the way to the table.',
    image_prompt_en: 'Turkish menemen scrambled eggs with tomatoes and peppers in a rustic skillet',
  }),
  recipe({
    id: 'demo-chicken-tray',
    name: 'Lemon Chicken Traybake',
    emoji: '🍗',
    kcal: 560,
    servings: 2,
    time_min: 45,
    difficulty: 'Kolay',
    macros: { protein: 42, karb: 38, yag: 24 },
    nutrition_tag: 'Protein',
    ingredients: [
      ing('Chicken Breast', 500, 'g', 550, 'Et & Şarküteri', true),
      ing('Potatoes', 4, 'adet', 320, 'Meyve & Sebze', true),
      ing('Lemons', 1, 'adet', 15, 'Meyve & Sebze', true),
      ing('Olive Oil', 2, 'yk', 240, 'Baharat & Sos', true),
      ing('Dried Oregano', 1, 'tk', 5, 'Baharat & Sos', true),
    ],
    steps: [
      'Heat the oven to 200°C and line a large tray.',
      'Cut potatoes into wedges, toss with oil, salt and oregano.',
      'Nestle the chicken between the potatoes; squeeze lemon over everything.',
      'Roast 35-40 minutes until the chicken is golden and cooked through.',
      'Rest 5 minutes, spoon the tray juices back over and serve.',
    ],
    chef_tip: 'Throw the squeezed lemon halves onto the tray — they caramelize and perfume the whole bake.',
    image_prompt_en: 'roasted lemon chicken and potato wedges on a sheet pan, golden and juicy',
  }),
  recipe({
    id: 'demo-spinach-pasta',
    name: 'Creamy Spinach Pasta',
    emoji: '🍝',
    kcal: 610,
    servings: 2,
    time_min: 25,
    difficulty: 'Kolay',
    macros: { protein: 21, karb: 74, yag: 25 },
    nutrition_tag: 'Dengeli',
    ingredients: [
      ing('Pasta', 250, 'g', 340, 'Bakliyat & Makarna', true),
      ing('Fresh Spinach', 300, 'g', 70, 'Meyve & Sebze', true),
      ing('Cream', 150, 'ml', 290, 'Süt & Peynir', false),
      ing('Parmesan', 40, 'g', 160, 'Süt & Peynir', false),
      ing('Garlic', 2, 'diş', 10, 'Meyve & Sebze', true),
    ],
    steps: [
      'Cook the pasta in well-salted water until just al dente.',
      'Wilt the spinach with garlic in a wide pan.',
      'Pour in the cream and let it bubble for 2 minutes.',
      'Toss in the pasta with a splash of cooking water.',
      'Finish with parmesan and black pepper.',
    ],
    chef_tip: 'Save a cup of pasta water — its starch is what makes the sauce cling.',
    image_prompt_en: 'creamy spinach pasta with parmesan in a white bowl',
  }),
  recipe({
    id: 'demo-stuffed-peppers',
    name: 'Beef Stuffed Peppers',
    emoji: '🫑',
    kcal: 520,
    servings: 4,
    time_min: 55,
    difficulty: 'Orta',
    macros: { protein: 28, karb: 42, yag: 26 },
    nutrition_tag: 'Dengeli',
    ingredients: [
      ing('Bell Peppers', 4, 'adet', 100, 'Meyve & Sebze', true),
      ing('Ground Beef', 400, 'g', 800, 'Et & Şarküteri', true),
      ing('Rice', 100, 'g', 350, 'Bakliyat & Makarna', true),
      ing('Onion', 1, 'adet', 40, 'Meyve & Sebze', true),
      ing('Tomato Paste', 2, 'yk', 30, 'Baharat & Sos', true),
      ing('Fresh Parsley', 1, 'demet', 10, 'Meyve & Sebze', false),
    ],
    steps: [
      'Cut the tops off the peppers and scoop out the seeds.',
      'Brown the beef with onion; stir in rice and tomato paste.',
      'Season generously and stuff the peppers.',
      'Stand them in a pot with a cup of water, lids back on.',
      'Simmer covered 35 minutes until the rice is tender.',
      'Shower with parsley before serving.',
    ],
    chef_tip: 'A spoon of yogurt on the side turns this into the classic Turkish table pairing.',
    image_prompt_en: 'Turkish stuffed bell peppers with ground beef and rice in a pot',
  }),
  recipe({
    id: 'demo-shakshuka-bowl',
    name: 'Roasted Veggie Grain Bowl',
    emoji: '🥗',
    kcal: 480,
    servings: 2,
    time_min: 35,
    difficulty: 'Kolay',
    macros: { protein: 16, karb: 62, yag: 20 },
    nutrition_tag: 'Lifli',
    ingredients: [
      ing('Zucchini', 2, 'adet', 60, 'Meyve & Sebze', true),
      ing('Bulgur', 150, 'g', 510, 'Bakliyat & Makarna', true),
      ing('Greek Yogurt', 200, 'g', 130, 'Süt & Peynir', true),
      ing('Chickpeas', 1, 'kutu', 210, 'Bakliyat & Makarna', false),
      ing('Tahini', 2, 'yk', 180, 'Baharat & Sos', false),
      ing('Pomegranate Molasses', 1, 'yk', 40, 'Baharat & Sos', false),
    ],
    steps: [
      'Roast zucchini ribbons at 220°C until charred at the edges.',
      'Cook bulgur until fluffy; season with salt and lemon.',
      'Whisk yogurt with tahini into a quick sauce.',
      'Pile bulgur, veg and chickpeas into bowls.',
      'Drizzle with the yogurt-tahini and pomegranate molasses.',
    ],
    chef_tip: 'The molasses is the secret — one spoon balances the whole bowl with sweet-sour depth.',
    image_prompt_en: 'colorful roasted vegetable grain bowl with yogurt tahini drizzle',
  }),
  recipe({
    id: 'demo-kofte',
    name: 'Pan-Seared Köfte & Salad',
    emoji: '🥩',
    kcal: 540,
    servings: 2,
    time_min: 30,
    difficulty: 'Orta',
    macros: { protein: 34, karb: 22, yag: 34 },
    nutrition_tag: 'Protein',
    ingredients: [
      ing('Ground Beef', 300, 'g', 600, 'Et & Şarküteri', true),
      ing('Onion', 1, 'adet', 40, 'Meyve & Sebze', true),
      ing('Breadcrumbs', 40, 'g', 150, 'Bakliyat & Makarna', false),
      ing('Cumin', 1, 'tk', 8, 'Baharat & Sos', true),
      ing('Tomatoes', 2, 'adet', 40, 'Meyve & Sebze', true),
      ing('Sumac', 1, 'tk', 5, 'Baharat & Sos', false),
    ],
    steps: [
      'Grate the onion and squeeze out the juice.',
      'Knead beef, onion, breadcrumbs and cumin for 3 minutes.',
      'Shape into flat ovals and rest 10 minutes.',
      'Sear in a hot pan, 3-4 minutes per side.',
      'Serve with a sumac-dressed tomato and onion salad.',
    ],
    chef_tip: 'Kneading past "just mixed" is what gives köfte its bouncy, tavern-style bite.',
    image_prompt_en: 'Turkish kofte meatballs seared in a pan with tomato onion salad',
  }),
  recipe({
    id: 'demo-fd-chicken',
    name: 'Chicken Ballotine, Charred Leek',
    emoji: '✨',
    kcal: 480,
    servings: 2,
    time_min: 75,
    difficulty: 'Zor',
    macros: { protein: 44, karb: 18, yag: 26 },
    nutrition_tag: 'Protein',
    category: 'fine-dining',
    ingredients: [
      ing('Chicken Breast', 400, 'g', 440, 'Et & Şarküteri', true),
      ing('Fresh Spinach', 150, 'g', 35, 'Meyve & Sebze', true),
      ing('Leek', 2, 'adet', 60, 'Meyve & Sebze', false),
      ing('Butter', 60, 'g', 430, 'Süt & Peynir', true),
      ing('White Wine', 100, 'ml', 80, 'Diğer', false),
    ],
    steps: [
      'Butterfly the chicken and layer with wilted spinach.',
      'Roll tightly in cling film into a cylinder; poach 25 minutes.',
      'Char the leeks whole until blackened outside, silky inside.',
      'Sear the ballotine in foaming butter to color.',
      'Reduce wine and butter into a glossy pan sauce; slice and plate.',
    ],
    chef_tip: 'Poach gently — 70°C water keeps the roll succulent before the final sear.',
    image_prompt_en: 'fine dining chicken ballotine slices with charred leek and butter sauce, elegant plating',
  }),
  recipe({
    id: 'demo-fd-egg',
    name: 'Slow Egg, Potato Espuma',
    emoji: '🍽️',
    kcal: 390,
    servings: 2,
    time_min: 60,
    difficulty: 'Zor',
    macros: { protein: 18, karb: 30, yag: 24 },
    nutrition_tag: 'Hafif',
    category: 'fine-dining',
    ingredients: [
      ing('Eggs', 2, 'adet', 140, 'Et & Şarküteri', true),
      ing('Potatoes', 3, 'adet', 240, 'Meyve & Sebze', true),
      ing('Milk', 200, 'ml', 100, 'Süt & Peynir', true),
      ing('Chives', 1, 'demet', 5, 'Meyve & Sebze', false),
      ing('Truffle Oil', 1, 'tk', 40, 'Baharat & Sos', false),
    ],
    steps: [
      'Cook the eggs at 63°C for 45 minutes (or gently poach).',
      'Simmer potatoes in milk, then blend into a light foam.',
      'Season the espuma and keep it warm.',
      'Nestle the egg into a pool of espuma.',
      'Finish with chives and a whisper of truffle oil.',
    ],
    chef_tip: 'Break the yolk at the table — it becomes the second sauce of the dish.',
    image_prompt_en: 'slow cooked egg on potato espuma with chives, fine dining minimal plating',
  }),
];

const PLAN_SEED: [PlanDay, string, PlanMeal][] = [
  ['Pzt', 'demo-menemen', 'Kahvaltı'],
  ['Pzt', 'demo-chicken-tray', 'Akşam'],
  ['Sal', 'demo-spinach-pasta', 'Akşam'],
  ['Çar', 'demo-shakshuka-bowl', 'Öğle'],
  ['Çar', 'demo-kofte', 'Akşam'],
  ['Per', 'demo-stuffed-peppers', 'Akşam'],
  ['Cum', 'demo-menemen', 'Kahvaltı'],
  ['Cum', 'demo-fd-chicken', 'Akşam'],
  ['Cmt', 'demo-shakshuka-bowl', 'Öğle'],
  ['Cmt', 'demo-fd-egg', 'Akşam'],
  ['Paz', 'demo-spinach-pasta', 'Öğle'],
  ['Paz', 'demo-stuffed-peppers', 'Akşam'],
];

/** Sepete eksikleri yazılacak tarifler + yarısı işaretlenecek satırlar. */
const CART_RECIPES = ['demo-spinach-pasta', 'demo-stuffed-peppers', 'demo-shakshuka-bowl', 'demo-kofte'];

export function seedDemoData(): void {
  if (!__DEV__ || process.env.EXPO_PUBLIC_DEMO_SEED !== 'true') return;
  // Tekrarlı açılışta üst üste yazmayı önle: plan zaten doluysa çık.
  const plan = usePlanStore.getState().plan;
  const alreadySeeded = Object.values(plan).some((entries) =>
    entries.some((entry) => entry.recipeId.startsWith('demo-'))
  );
  if (alreadySeeded) return;

  useOnboardingStore.getState().completeOnboarding();
  useInventoryStore.getState().replaceItems(DEMO_INVENTORY);

  const recipeState = useRecipeStore.getState();
  recipeState.setRecipes(
    DEMO_RECIPES,
    inventoryFingerprint(DEMO_INVENTORY, recipeState.preferences)
  );

  const byId = new Map(DEMO_RECIPES.map((r) => [r.id, r]));
  for (const [day, id, meal] of PLAN_SEED) {
    const r = byId.get(id);
    if (!r) continue;
    usePlanStore.getState().addToPlan(day, {
      recipeId: r.id,
      name: r.name,
      kcal: r.kcal,
      emoji: r.emoji,
      meal,
      servings: r.servings,
    });
  }

  const cart = useCartStore.getState();
  for (const id of CART_RECIPES) {
    const r = byId.get(id);
    if (!r) continue;
    cart.syncRecipeMissing(
      r.name,
      r.ingredients
        .filter((i) => !i.in_inventory)
        .map((i) => ({ name: i.name, nameEn: i.name, qty: i.qty, unit: i.unit, category: i.category }))
    );
  }
  // Yarısı işaretli market listesi: ilk tarifin eksikleri "alındı" olsun.
  const first = byId.get(CART_RECIPES[0]);
  for (const i of first?.ingredients.filter((i) => !i.in_inventory) ?? []) {
    useCartStore.getState().toggleChecked(cartItemKey(i.name, i.unit));
  }
  const second = byId.get(CART_RECIPES[1]);
  const secondMissing = second?.ingredients.filter((i) => !i.in_inventory) ?? [];
  if (secondMissing.length > 0) {
    useCartStore.getState().toggleChecked(cartItemKey(secondMissing[0].name, secondMissing[0].unit));
  }
}
