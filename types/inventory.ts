export type InventoryUnit = 'adet' | 'g' | 'kg' | 'ml' | 'l' | 'demet';

/** 0-100 arası model güven skoru (vision şemasındaki "match_confidence"). */
export type InventoryConfidence = number;

/**
 * Sabit kategori listesi (video → tablo akışının "Kategori" sütunundan gelir,
 * bkz. `services/vision/prompt.ts` — `VIDEO_TABLE_PROMPT`). Model bu listeden
 * biri dışında bir değer dönerse `parseInventoryTable` "Diğer"e eşler (bkz.
 * `services/vision/markdown-table.ts`).
 */
export type InventoryCategory =
  | 'İçecek'
  | 'Süt Ürünleri'
  | 'Peynir'
  | 'Şarküteri'
  | 'Meyve & Sebze'
  | 'Sos & Baharat'
  | 'Diğer';

export interface InventoryItem {
  id: string;
  name: string;
  qty: number;
  unit: InventoryUnit;
  emoji: string;
  confidence?: InventoryConfidence;
  /** Marka/çeşit bilgisi (opsiyonel) — "name" jenerik kalsın diye ayrı tutulur. */
  brand?: string;
  /**
   * Sabit kategori listesinden biri (opsiyonel) — sadece video → tablo akışı
   * (MVP-7) doldurur; iki aşamalı JSON akışının şeması bu alanı üretmez,
   * `app/(tabs)/index.tsx` kategorisiz ürünleri "Diğer" altında gösterir.
   */
  category?: InventoryCategory;
  /** Buzdolabı/mutfaktaki konum (opsiyonel, örn. "buzdolabı kapısı", "sebze çekmecesi"). */
  location?: string;
  /**
   * Miktar/birimin ham metin hali (opsiyonel, örn. "2 dilim", "1 kutu (500g)") —
   * `parseInventoryTable`'ın (video → tablo akışı) qty/unit'e ayrıştıramadığı
   * detayı kaybetmemek için saklanır, bkz. `services/vision/markdown-table.ts`.
   */
  detail?: string;
  /**
   * Modelin doğruluk yüzdesi için verdiği gerekçe (opsiyonel, örn. "Marka ve
   * logo net okunuyor") — video → tablo akışında `Notlar / Gerekçe`
   * sütunundan gelir, bkz. `services/vision/markdown-table.ts`.
   */
  note?: string;
}
