/**
 * SERVİS KONTRATLARI (orkestrasyon Faz 1) — frontend ve backend paralel
 * geliştirildiği için tüm AI/veri servislerinin imzaları burada SABİTTİR.
 * Frontend agent'ları geliştirme sırasında `__mocks__/aiServices.ts`'teki
 * mock'ları kullanır; entegrasyonda (Faz 3) gerçek implementasyonlara bağlanır.
 *
 * Gerçek implementasyon yerleri:
 * - `parseIngredients` → lib/claude/parseIngredients.ts (backend-agent yazar)
 * - `askChef`          → lib/claude/askChef.ts (backend-agent yazar)
 * - `generateRecipes`  → lib/claude/generateRecipes.ts —
 *   `generateRecipesTwoPhase(inventory, options)` MEVCUT; backend-agent
 *   imzaya `preferences` + `activePantryNames` ekler (bkz. altta).
 * - `scanVideo`        → services/vision/ (ZATEN GERÇEK — mock değil;
 *   `getVisionProvider().extractInventoryFromVideo`, değiştirilmez).
 *
 * Envanter CRUD ve sepet işlemleri store kontratlarıdır (Faz 1'de yazıldı):
 * store/inventoryStore.ts, store/pantryStore.ts, store/cartStore.ts,
 * store/chefChatStore.ts, store/recipeStore.ts.
 */
import type { ChefChatMessage } from '@/store/chefChatStore';
import type { InventoryItem } from '@/types/inventory';
import type { RecipePreferences } from '@/types/preferences';
import type { Recipe } from '@/types/recipe';

/**
 * Asistanla ekleme (spec §3): serbest Türkçe metinden ("süt, 4 domates,
 * kaşar...") malzeme listesi çıkarır. Sesli giriş MVP dışı — ileride ses
 * transkripti de aynı fonksiyona metin olarak girer.
 * Adlar jenerik Türkçe olmalı; miktar/birim metinde yoksa 1 adet varsayılır.
 */
export type ParseIngredients = (text: string) => Promise<InventoryItem[]>;

/**
 * Şefe Sor (spec §5): tarifin tamamı + o tarife ait geçmiş mesajlar + yeni
 * mesaj gönderilir, şefin Türkçe yanıtı döner. Sistem talimatı: "yalnızca bu
 * tarif bağlamında yanıt ver; malzeme değişimi önerirken miktarları da
 * güncelle."
 */
export type AskChef = (
  recipe: Recipe,
  history: ChefChatMessage[],
  message: string
) => Promise<string>;

/**
 * Tarif üretimi — mevcut iki aşamalı akışın (MVP-15/16) tercihlerle
 * genişletilmiş sözleşmesi. Backend-agent `generateRecipesTwoPhase`'i şu
 * imzaya taşır:
 *
 *   generateRecipesTwoPhase(inventory, {
 *     preferences,        // RecipePreferences — boş kategoriler yok sayılır
 *     activePantryNames,  // kullanıcının AKTİF kiler malzemeleri (statik
 *                         //   PANTRY_STAPLES yerine bu liste prompt'a girer)
 *     onPlanReady?, onDetailSettled?,  // mevcut canlı-gösterim callback'leri
 *   }) → Promise<Recipe[]>
 *
 * Çıktı kuralları (mevcut + yeni):
 * - 6 tarif, eksik-malzeme bazlı katmanlar (0 / 1-2 / 3-4 eksik) — DEĞİŞMEDİ.
 * - Her malzeme artık { name, qty, unit, kcal, category, in_inventory } —
 *   qty/kcal varsayılan porsiyon içindir (bkz. types/recipe.ts).
 * - Her tarif tek `nutrition_tag` taşır (NUTRITION_TAGS enum'u).
 * - `match_pct`/`missing_count` KODDA hesaplanmaya devam eder (MVP-15).
 */
export type GenerateRecipesOptions = {
  preferences: RecipePreferences;
  activePantryNames: string[];
  onPlanReady?: (plans: unknown) => void;
  onDetailSettled?: (result: unknown) => void;
};
