/**
 * Jumbo sağlayıcısı — web sitesinin GraphQL API'si üzerinden (unofficial).
 *
 * NOT (2026-07-18, canlı doğrulandı): SupermarktConnector'ın kullandığı
 * mobileapi.jumbo.com bu ağdan tamamen yanıtsızdı (bot/geo koruması veya
 * kapatılmış); www.jumbo.com/api/graphql ise yalnızca Apollo
 * clientAwareness header'larıyla (`apollographql-client-name/-version`)
 * anonim çalışıyor. Şema, tarayıcıdaki gerçek trafikten çıkarıldı.
 *
 * Endpoint'ler haber vermeden değişebilir: alan eşlemesi savunmacıdır,
 * `healthCheck` + smoke script kanaryadır.
 */

import { createStoreFetcher } from './http';
import { StoreApiError, type SearchOptions, type StoreHealth, type StoreProduct, type StoreProvider } from './types';

const JUMBO_GRAPHQL_URL = 'https://www.jumbo.com/api/graphql';
const JUMBO_HEADERS = {
  'Content-Type': 'application/json',
  // "No client headers set" hatasını önleyen zorunlu ikili:
  'apollographql-client-name': 'jumbo-web',
  'apollographql-client-version': '1.0.0',
};
const DEFAULT_LIMIT = 8;

// DOĞRULA: alan adları 2026-07-18'de canlı şemadan alındı (searchProducts/
// ProductSearchInput). Kırılırsa smoke script 'parse' hatasıyla yakalar.
const SEARCH_QUERY = `query SearchProducts($input: ProductSearchInput!) {
  searchProducts(input: $input) {
    products { id title subtitle brand link image price { price promoPrice } }
  }
}`;

const storeFetch = createStoreFetcher('jumbo');

/** Jumbo yanıtındaki tek bir ürünü savunmacı biçimde `StoreProduct`'a eşler. */
function mapProduct(raw: unknown): StoreProduct | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const p = raw as Record<string, unknown>;
  const sku = typeof p.id === 'string' && p.id ? p.id : null;
  const name = typeof p.title === 'string' ? p.title : null;
  if (!sku || !name) {
    return null;
  }
  // price.price euro cent; promosyon varsa promoPrice öncelikli.
  const price = (p.price ?? {}) as Record<string, unknown>;
  const amount =
    typeof price.promoPrice === 'number' ? price.promoPrice : typeof price.price === 'number' ? price.price : null;
  const link = typeof p.link === 'string' ? p.link : null;
  return {
    storeId: 'jumbo',
    sku,
    name,
    brand: typeof p.brand === 'string' ? p.brand : undefined,
    priceCents: amount == null ? null : Math.round(amount),
    unitSize: typeof p.subtitle === 'string' ? p.subtitle : undefined,
    imageUrl: typeof p.image === 'string' ? p.image : undefined,
    webUrl: link ? `https://www.jumbo.com${link}` : undefined,
  };
}

async function searchProducts(query: string, options?: SearchOptions): Promise<StoreProduct[]> {
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const response = await storeFetch(JUMBO_GRAPHQL_URL, {
    method: 'POST',
    headers: JUMBO_HEADERS,
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { input: { searchType: 'keyword', searchTerms: query, offSet: 0, limit } },
    }),
    signal: options?.signal,
  });
  const json = (await response.json().catch(() => null)) as
    | { data?: { searchProducts?: { products?: unknown[] } }; errors?: Array<{ message?: string }> }
    | null;
  const data = json?.data?.searchProducts?.products;
  if (!Array.isArray(data)) {
    const detail = json?.errors?.[0]?.message ?? 'yanıt beklenen biçimde değil';
    throw new StoreApiError(`jumbo: arama yanıtı hatalı: ${detail}`, 'jumbo', 'parse');
  }
  const products = data.map(mapProduct).filter((p): p is StoreProduct => p !== null);
  // Fiyatsız ürünler (nadiren sepet-dışı/bundle) sona — eşleştirme fiyatlı
  // adayları öne alsın (kararlı sıralama, alaka düzenini korur).
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
      storeId: 'jumbo',
      ok,
      latencyMs: Date.now() - startedAt,
      detail: ok ? `ilk ürün: ${products[0].name}` : 'sonuç boş veya fiyatsız',
    };
  } catch (error) {
    return {
      storeId: 'jumbo',
      ok: false,
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export const jumboStoreProvider: StoreProvider = {
  id: 'jumbo',
  displayName: 'Jumbo',
  searchProducts,
  healthCheck,
};
