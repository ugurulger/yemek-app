/**
 * Tipli event fonksiyonları — tracking-plan.yaml v1'in birebir uygulanışı.
 * Ekranlar/store'lar SADECE buradaki fonksiyonları çağırır; ham
 * `posthog.capture()` çağrısı ve serbest event adı stringi YASAK.
 *
 * KURAL (pii_policy: none — GDPR): hiçbir property'de serbest metin,
 * envanter/tarif/malzeme ADI, chat içeriği, arama sorgusu veya fotoğraf
 * taşınmaz — yalnız sayılar, enum'lar ve bayraklar.
 */
import { AppState } from 'react-native';

import { posthog } from './analytics';
import { claimFirst, initMilestones, milestoneAt } from './milestones';

/** Merkezi event adı kaydı — tracking-plan.yaml ile birebir. */
export const EVENTS = {
  APP_OPENED: 'app.opened',
  INVENTORY_CAPTURE_STARTED: 'inventory.capture_started',
  INVENTORY_CAPTURE_COMPLETED: 'inventory.capture_completed',
  INVENTORY_CAPTURE_FAILED: 'inventory.capture_failed',
  INVENTORY_UNCERTAIN_ITEM_RESOLVED: 'inventory.uncertain_item_resolved',
  RECIPES_GENERATION_STARTED: 'recipes.generation_started',
  RECIPES_GENERATION_COMPLETED: 'recipes.generation_completed',
  RECIPES_GENERATION_FAILED: 'recipes.generation_failed',
  RECIPE_VIEWED: 'recipe.viewed',
  RECIPE_SAVED: 'recipe.saved',
  RECIPE_IMPORTED: 'recipe.imported',
  CHEF_CHAT_MESSAGE_SENT: 'chef_chat.message_sent',
  PLAN_RECIPE_ADDED: 'plan.recipe_added',
  CART_INGREDIENTS_ADDED: 'cart.ingredients_added',
  MARKET_VIEWED: 'market.viewed',
  MARKET_ITEM_CHECKED: 'market.item_checked',
  MARKET_MATCH_RUN_COMPLETED: 'market.match_run_completed',
  MARKET_MATCH_CORRECTED: 'market.match_corrected',
  MARKET_STORE_LINK_OPENED: 'market.store_link_opened',
  PREFERENCES_UPDATED: 'preferences.updated',
  PANTRY_ITEM_TOGGLED: 'pantry.item_toggled',
  LANGUAGE_CHANGED: 'language.changed',
  COOKBOOK_CREATED: 'cookbook.created',
} as const;

export type AppLanguageProp = 'tr' | 'en';
export type CaptureMethod = 'photo' | 'receipt' | 'video' | 'assistant';
export type VisionProviderProp = 'gemini' | 'claude';
export type CaptureErrorType =
  | 'network'
  | 'parse'
  | 'empty_result'
  | 'permission'
  | 'cancelled'
  | 'unknown';
export type GenerationPath = 'rag' | 'two_phase';
export type GenerationTrigger = 'auto' | 'refresh' | 'preferences_changed';
export type GenerationErrorType = 'network' | 'api_error' | 'parse' | 'unknown';
export type RecipeViewSource = 'generated_list' | 'cookbook' | 'plan' | 'import' | 'market';
export type RecipeSaveSource = 'generated' | 'imported';
export type ImportSource = 'instagram' | 'web' | 'photo';
export type StoreProp = 'ah' | 'jumbo';
export type StoreLinkType = 'app' | 'web';

/** Tek geçit: analytics asla akışı kırmaz. */
function capture(event: string, properties?: Parameters<typeof posthog.capture>[1]) {
  try {
    posthog.capture(event, properties);
  } catch {
    // bilinçli sessiz — telemetri uygulama davranışını etkileyemez
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Açılış kurulumu: milestone cache'ini yükler, soğuk başlangıç için
 * app.opened üretir ve arka plandan öne dönüşlerde tekrar üretmek üzere
 * AppState dinleyicisi kurar. `app/_layout.tsx` bir kez çağırır.
 */
export async function initTracking(getLanguage: () => AppLanguageProp): Promise<void> {
  await initMilestones();

  const isFirstOpen = claimFirst('app_opened');
  const trackOpen = (isFirst: boolean) =>
    capture(EVENTS.APP_OPENED, {
      is_first_open: isFirst,
      language: getLanguage(),
      $set: { language: getLanguage() },
      $set_once: { first_seen_at: milestoneAt('app_opened') ?? new Date().toISOString() },
    });

  trackOpen(isFirstOpen);

  let appState = AppState.currentState;
  AppState.addEventListener('change', (next) => {
    if (appState.match(/inactive|background/) && next === 'active') {
      trackOpen(false);
    }
    appState = next;
  });
}

// ---------------------------------------------------------------------------
// Envanter yakalama
// ---------------------------------------------------------------------------

export function trackInventoryCaptureStarted(method: CaptureMethod) {
  capture(EVENTS.INVENTORY_CAPTURE_STARTED, {
    method,
    is_first: claimFirst('capture_started'),
  });
}

export function trackInventoryCaptureCompleted(p: {
  method: CaptureMethod;
  provider: VisionProviderProp;
  item_count: number;
  uncertain_item_count: number;
  write_mode: 'replace' | 'add';
  duration_ms: number;
  /**
   * Aşama kırılımı (tracking-plan v1.1, performans işi 2026-08-02):
   * prep_ms = seçimden model isteğine kadarki hazırlık (boyutlandırma/base64
   * + varsa Files API yüklemesi), model_ms = model isteğinden sonuca.
   * Yalnız sayı — PII yok. Sağlayıcı onProgress vermezse gönderilmez.
   */
  prep_ms?: number;
  model_ms?: number;
}) {
  const { prep_ms, model_ms, ...rest } = p;
  const isFirst = claimFirst('capture_completed');
  capture(EVENTS.INVENTORY_CAPTURE_COMPLETED, {
    ...rest,
    duration_ms: Math.round(p.duration_ms),
    ...(prep_ms === undefined ? {} : { prep_ms: Math.round(prep_ms) }),
    ...(model_ms === undefined ? {} : { model_ms: Math.round(model_ms) }),
    is_first: isFirst,
    $set: { inventory_item_count: p.item_count },
    $set_once: { first_capture_completed_at: milestoneAt('capture_completed') ?? new Date().toISOString() },
  });
}

export function trackInventoryCaptureFailed(p: {
  method: CaptureMethod;
  provider: VisionProviderProp;
  error_type: CaptureErrorType;
  duration_ms?: number;
}) {
  const { duration_ms, ...rest } = p;
  capture(EVENTS.INVENTORY_CAPTURE_FAILED, {
    ...rest,
    ...(duration_ms === undefined ? {} : { duration_ms: Math.round(duration_ms) }),
  });
}

export function trackInventoryUncertainItemResolved(action: 'added' | 'deleted') {
  capture(EVENTS.INVENTORY_UNCERTAIN_ITEM_RESOLVED, { action });
}

// ---------------------------------------------------------------------------
// Tarif üretimi
// ---------------------------------------------------------------------------

export function trackRecipesGenerationStarted(p: {
  trigger: GenerationTrigger;
  path: GenerationPath;
  inventory_item_count: number;
}) {
  capture(EVENTS.RECIPES_GENERATION_STARTED, {
    ...p,
    is_first: claimFirst('generation_started'),
  });
}

export function trackRecipesGenerationCompleted(p: {
  path: GenerationPath;
  recipe_count: number;
  ready_count: number;
  failed_slot_count: number;
  duration_ms: number;
}) {
  claimFirst('generation_completed');
  capture(EVENTS.RECIPES_GENERATION_COMPLETED, {
    ...p,
    duration_ms: Math.round(p.duration_ms),
    $set_once: { first_recipe_generated_at: milestoneAt('generation_completed') ?? new Date().toISOString() },
  });
}

export function trackRecipesGenerationFailed(p: {
  path: GenerationPath;
  error_type: GenerationErrorType;
}) {
  capture(EVENTS.RECIPES_GENERATION_FAILED, p);
}

// ---------------------------------------------------------------------------
// Tarif etkileşimi
// ---------------------------------------------------------------------------

export function trackRecipeViewed(p: {
  source: RecipeViewSource;
  missing_count: number;
  is_fine_dining: boolean;
}) {
  capture(EVENTS.RECIPE_VIEWED, p);
}

export function trackRecipeSaved(source: RecipeSaveSource) {
  capture(EVENTS.RECIPE_SAVED, { source, ...firstRecipeAddedProps() });
}

export function trackRecipeImported(source: ImportSource) {
  capture(EVENTS.RECIPE_IMPORTED, {
    source,
    ...firstRecipeAddedProps(),
  });
}

/**
 * "İlk tarif ekleme" funnel'ı kayıt (recipe.saved) ve içe aktarmayı
 * (recipe.imported) TEK milestone'da birleştirir — hangisi önce yaşanırsa
 * is_first onda true olur.
 */
function firstRecipeAddedProps() {
  const isFirst = claimFirst('recipe_added');
  return {
    is_first: isFirst,
    $set_once: { first_recipe_added_at: milestoneAt('recipe_added') ?? new Date().toISOString() },
  };
}

export function trackChefChatMessageSent(p: {
  message_index: number;
  used_suggestion_chip: boolean;
}) {
  capture(EVENTS.CHEF_CHAT_MESSAGE_SENT, p);
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export function trackPlanRecipeAdded(source: 'recipe_detail' | 'plan_screen') {
  const isFirst = claimFirst('plan_entry');
  capture(EVENTS.PLAN_RECIPE_ADDED, {
    source,
    is_first: isFirst,
    $set_once: { first_plan_entry_at: milestoneAt('plan_entry') ?? new Date().toISOString() },
  });
}

// ---------------------------------------------------------------------------
// Market / sepet
// ---------------------------------------------------------------------------

export function trackCartIngredientsAdded(p: {
  ingredient_count: number;
  source: 'recipe_card' | 'recipe_detail';
}) {
  capture(EVENTS.CART_INGREDIENTS_ADDED, p);
}

export function trackMarketViewed(item_count: number) {
  const isFirst = claimFirst('market_use');
  capture(EVENTS.MARKET_VIEWED, {
    item_count,
    ...(isFirst
      ? { $set_once: { first_market_use_at: milestoneAt('market_use') ?? new Date().toISOString() } }
      : {}),
  });
}

export function trackMarketItemChecked(is_checked: boolean) {
  capture(EVENTS.MARKET_ITEM_CHECKED, { is_checked });
}

export function trackMarketMatchRunCompleted(p: {
  matched_count: number;
  unmatched_count: number;
  ah_available: boolean;
  jumbo_available: boolean;
  duration_ms: number;
}) {
  capture(EVENTS.MARKET_MATCH_RUN_COMPLETED, { ...p, duration_ms: Math.round(p.duration_ms) });
}

export function trackMarketMatchCorrected(p: { store: StoreProp; via_search: boolean }) {
  capture(EVENTS.MARKET_MATCH_CORRECTED, p);
}

export function trackMarketStoreLinkOpened(p: { store: StoreProp; link_type: StoreLinkType }) {
  capture(EVENTS.MARKET_STORE_LINK_OPENED, p);
}

// ---------------------------------------------------------------------------
// Yapılandırma
// ---------------------------------------------------------------------------

export function trackPreferencesUpdated(selected_count: number) {
  capture(EVENTS.PREFERENCES_UPDATED, { selected_count });
}

export function trackPantryItemToggled(enabled: boolean) {
  capture(EVENTS.PANTRY_ITEM_TOGGLED, { enabled });
}

export function trackLanguageChanged(language: AppLanguageProp) {
  capture(EVENTS.LANGUAGE_CHANGED, { language, $set: { language } });
}

export function trackCookbookCreated() {
  capture(EVENTS.COOKBOOK_CREATED);
}
