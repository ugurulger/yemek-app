/**
 * Market fiyat karşılaştırması — mağaza sağlayıcı katmanının ortak tipleri.
 * `services/vision/types.ts` ile aynı mimari: tek arayüz + tek domain hata
 * tipi; sağlayıcılar (AH, Jumbo, mock, ileride Pepesto gibi ücretli bir
 * servis) bu arayüzün arkasında serbestçe değiştirilebilir.
 *
 * Resmi API olmadığı için canlı sağlayıcılar unofficial mobil API
 * endpoint'lerini kullanır — endpoint'lerin haber vermeden kırılabileceği
 * varsayılır (bkz. healthCheck + tests/store-smoke/run-smoke.ts).
 */

export type StoreId = 'ah' | 'jumbo';

export const STORE_IDS: readonly StoreId[] = ['ah', 'jumbo'];

export interface StoreProduct {
  storeId: StoreId;
  /** Mağazanın ürün kimliği (AH: webshopId, Jumbo: ürün id'si). */
  sku: string;
  /** Mağazanın döndürdüğü Hollandaca ürün adı. */
  name: string;
  brand?: string;
  /**
   * Fiyat, euro cent (ör. 129 = €1,29). `null` = fiyat alınamadı — UI bu
   * durumda "fiyat alınamadı" fallback'ini gösterir, asla 0 varsaymaz.
   */
  priceCents: number | null;
  /** API'den gelen ham birim/miktar metni: "500 g", "1 l", "per stuk"... */
  unitSize?: string;
  imageUrl?: string;
  /** Ürünün web sayfası — deeplink/web fallback tabanı. */
  webUrl?: string;
}

export type StoreApiErrorKind = 'network' | 'auth' | 'parse' | 'rate-limit';

/**
 * Tüm sağlayıcı hataları bu tek tipe normalize edilir (InventoryVisionError
 * kalıbı) — çağıran taraf mağaza ayrımı yapmadan "fiyat alınamadı" durumuna
 * düşebilir.
 */
export class StoreApiError extends Error {
  constructor(
    message: string,
    readonly storeId: StoreId,
    readonly kind: StoreApiErrorKind,
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'StoreApiError';
  }
}

export interface StoreHealth {
  storeId: StoreId;
  ok: boolean;
  latencyMs: number;
  /** Log için kısa açıklama (hata mesajı, sonuç sayısı vb.). */
  detail?: string;
}

export interface SearchOptions {
  /** Döndürülecek en fazla ürün sayısı (varsayılan 8 — Tier-3 aday sayısı). */
  limit?: number;
  signal?: AbortSignal;
}

export interface StoreProvider {
  readonly id: StoreId;
  /** Kullanıcıya görünen ad: "Albert Heijn", "Jumbo". */
  readonly displayName: string;
  searchProducts(query: string, options?: SearchOptions): Promise<StoreProduct[]>;
  /**
   * Bilinen bir SKU'nun güncel fiyatını/detayını getirir. Opsiyonel —
   * tanımlı değilse çağıran taraf `searchProducts` ile çözer
   * (VisionProvider'daki opsiyonel metod kalıbı).
   */
  getPrice?(sku: string, options?: SearchOptions): Promise<StoreProduct | null>;
  /**
   * Tek ucuz canlı istek. Smoke script'i ve Market ekranındaki durum
   * banner'ı kullanır — endpoint kırılmalarını erken fark etme kanaryası.
   */
  healthCheck(): Promise<StoreHealth>;
}
