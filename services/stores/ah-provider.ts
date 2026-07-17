/**
 * Albert Heijn sağlayıcısı — resmi public API yok; AH mobil uygulamasının
 * (Appie) unofficial endpoint'leri kullanılır (SupermarktConnector'ın
 * yaklaşımı). Endpoint'ler haber vermeden değişebilir: alan eşlemesi
 * savunmacıdır (tek ürünün bozuk gelmesi tüm sonucu düşürmez) ve
 * `healthCheck` + smoke script kanarya görevi görür.
 *
 * Kimlik: anonim token (kullanıcı hesabı/şifresi YOK — karşı uygulamanın
 * sepetine yazma bilinçli kapsam dışı, sadece okuma/arama).
 */

import { createStoreFetcher } from './http';
import { StoreApiError, type SearchOptions, type StoreHealth, type StoreProduct, type StoreProvider } from './types';

const AH_AUTH_URL = 'https://api.ah.nl/mobile-auth/v1/auth/token/anonymous';
// DOĞRULA: arama endpoint'i ve parametre adları smoke script ile canlı doğrulanır.
const AH_SEARCH_URL = 'https://api.ah.nl/mobile-services/product/search/v2';
const AH_HEADERS = {
  'User-Agent': 'Appie/8.22.3',
  'X-Application': 'AHWEBSHOP',
  'Content-Type': 'application/json',
};
const DEFAULT_LIMIT = 8;

const storeFetch = createStoreFetcher('ah');

/** Modül seviyesi anonim token cache'i (vision'daki modül-seviyesi state kalıbı). */
let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAnonymousToken(force = false): Promise<string> {
  if (!force && cachedToken && Date.now() < cachedToken.expiresAt - 30_000) {
    return cachedToken.accessToken;
  }
  const response = await storeFetch(AH_AUTH_URL, {
    method: 'POST',
    headers: AH_HEADERS,
    body: JSON.stringify({ clientId: 'appie' }),
  });
  const json = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number }
    | null;
  if (!json?.access_token) {
    throw new StoreApiError('ah: anonim token alınamadı (yanıt biçimi değişmiş olabilir)', 'ah', 'auth');
  }
  cachedToken = {
    accessToken: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 600) * 1000,
  };
  return cachedToken.accessToken;
}

/** AH yanıtındaki tek bir ürünü savunmacı biçimde `StoreProduct`'a eşler. */
function mapProduct(raw: unknown): StoreProduct | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const p = raw as Record<string, unknown>;
  const sku = p.webshopId != null ? String(p.webshopId) : null;
  const name = typeof p.title === 'string' ? p.title : null;
  if (!sku || !name) {
    return null;
  }
  // Bonus varsa currentPrice, yoksa priceBeforeBonus; ikisi de yoksa null.
  const priceEur =
    typeof p.currentPrice === 'number'
      ? p.currentPrice
      : typeof p.priceBeforeBonus === 'number'
        ? p.priceBeforeBonus
        : null;
  const images = Array.isArray(p.images) ? (p.images as Array<Record<string, unknown>>) : [];
  const smallestImage = images
    .filter((img) => typeof img?.url === 'string')
    .sort((a, b) => Number(a.width ?? 0) - Number(b.width ?? 0))[0];
  return {
    storeId: 'ah',
    sku,
    name,
    brand: typeof p.brand === 'string' ? p.brand : undefined,
    priceCents: priceEur == null ? null : Math.round(priceEur * 100),
    unitSize: typeof p.salesUnitSize === 'string' ? p.salesUnitSize : undefined,
    imageUrl: typeof smallestImage?.url === 'string' ? smallestImage.url : undefined,
    webUrl: `https://www.ah.nl/producten/product/wi${sku}`,
  };
}

async function searchProducts(query: string, options?: SearchOptions): Promise<StoreProduct[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT;

  async function requestSearch(forceToken: boolean): Promise<Response> {
    const token = await getAnonymousToken(forceToken);
    const url = `${AH_SEARCH_URL}?query=${encodeURIComponent(query)}&sortOn=RELEVANCE&size=${limit}`;
    return storeFetch(url, {
      headers: { ...AH_HEADERS, Authorization: `Bearer ${token}` },
      signal: options?.signal,
    });
  }

  let response: Response;
  try {
    response = await requestSearch(false);
  } catch (error) {
    // Token süresi dolmuş/geçersiz olabilir — bir kez tazeleyip yeniden dene.
    if (error instanceof StoreApiError && error.kind === 'auth') {
      response = await requestSearch(true);
    } else {
      throw error;
    }
  }

  const json = (await response.json().catch(() => null)) as { products?: unknown[] } | null;
  if (!json || !Array.isArray(json.products)) {
    throw new StoreApiError('ah: arama yanıtı beklenen biçimde değil', 'ah', 'parse');
  }
  const products = json.products.map(mapProduct).filter((p): p is StoreProduct => p !== null);
  // Sanal bundle'lar (örn. "3-pack" bonus paketleri) fiyat alanı boş gelir —
  // fiyatsızları sona at ki eşleştirme fiyatlı adayları öne alsın
  // (kararlı sıralama, alaka düzenini korur).
  return [...products.filter((p) => p.priceCents != null), ...products.filter((p) => p.priceCents == null)].slice(
    0,
    limit
  );
}

async function healthCheck(): Promise<StoreHealth> {
  const startedAt = Date.now();
  try {
    const products = await searchProducts('melk', { limit: 1 });
    const ok = products.length > 0 && products[0].priceCents != null;
    return {
      storeId: 'ah',
      ok,
      latencyMs: Date.now() - startedAt,
      detail: ok ? `ilk ürün: ${products[0].name}` : 'sonuç boş veya fiyatsız',
    };
  } catch (error) {
    return {
      storeId: 'ah',
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export const ahStoreProvider: StoreProvider = {
  id: 'ah',
  displayName: 'Albert Heijn',
  searchProducts,
  healthCheck,
};
