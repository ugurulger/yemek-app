/**
 * Sabit birim listesi — video → envanter akışının responseSchema'sı (bkz.
 * `services/vision/gemini-provider.ts`) bu enum'u modele dayatır; iki aşamalı
 * JSON akışının prompt'ları (bkz. `services/vision/prompt.ts`) bunun bir alt
 * kümesini (adet|g|kg|ml|l|demet) kullanmaya devam eder. Paket/kutu/kavanoz/
 * dilim/şişe/poşet, eski markdown-tablo akışında "adet"e eşlenip ham metni
 * `detail` alanında saklanıyordu — responseSchema geçişiyle (kaldırılan
 * `detail` alanı yerine) birinci sınıf birim oldular.
 */
export const INVENTORY_UNITS = [
  'adet',
  'paket',
  'kutu',
  'kavanoz',
  'dilim',
  'şişe',
  'poşet',
  'demet',
  'g',
  'kg',
  'ml',
  'l',
] as const;

export type InventoryUnit = (typeof INVENTORY_UNITS)[number];

/** 0-100 arası model güven skoru (vision şemalarındaki confidence). */
export type InventoryConfidence = number;

/**
 * Sabit kategori listesi (video → envanter akışının responseSchema'sındaki
 * "category" enum'u, bkz. `services/vision/gemini-provider.ts`). Model buna
 * rağmen tanınmayan bir değer dönerse doğrulayıcı "Diğer"e eşler (bkz.
 * `services/vision/prompt.ts` — `parseVideoInventoryItems`).
 */
export const INVENTORY_CATEGORIES = [
  'İçecek',
  'Süt Ürünleri',
  'Peynir',
  'Şarküteri',
  'Meyve & Sebze',
  'Sos & Baharat',
  'Diğer',
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export interface InventoryItem {
  id: string;
  name: string;
  /**
   * İki dilli gösterim adları (dil değişiminde "topyekün" takas için):
   * tarama/ekleme hangi dilde yapıldıysa `name` o dildedir; çeviri adımı
   * (bkz. src/i18n/inventoryI18n.ts — bilingualizeItems) karşı dili doldurur.
   * Eski kayıtlarda bulunmayabilir — dil değişiminde backfill ile tamamlanır.
   */
  nameTr?: string;
  nameEn?: string;
  qty: number;
  unit: InventoryUnit;
  emoji: string;
  confidence?: InventoryConfidence;
  /** Marka/çeşit bilgisi (opsiyonel) — "name" jenerik kalsın diye ayrı tutulur. */
  brand?: string;
  /**
   * Sabit kategori listesinden biri (opsiyonel) — sadece video → envanter
   * akışı (responseSchema) doldurur; iki aşamalı JSON akışının şeması bu alanı
   * üretmez, `app/(tabs)/index.tsx` kategorisiz ürünleri "Diğer" altında gösterir.
   */
  category?: InventoryCategory;
}
