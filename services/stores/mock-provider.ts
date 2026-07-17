/**
 * Mock mağaza sağlayıcısı.
 *
 * NEDEN `__mocks__/` ALTINDA DEĞİL: `__mocks__/` geliştirme aşamasında
 * silinecek geçici stub'lar içindir. Bu sağlayıcı ise KALICI ve env ile
 * seçilen bir çalışma yoludur — Expo WEB önizlemesi mağaza API'lerine
 * CORS nedeniyle asla erişemez, bu yüzden web'de UI doğrulaması her zaman
 * bu mock üzerinden yapılır (bkz. `index.ts` sağlayıcı seçimi ve plan).
 *
 * Basit token-içeren arama yapar; ufak yapay gecikme ile gerçekçi
 * yükleme durumları üretir. `EXPO_PUBLIC_STORE_MOCK_FAIL=ah|jumbo|both`
 * ile mağaza çökmesi senaryoları simüle edilir (Faz 4 doğrulaması).
 */

import { MOCK_PRODUCTS } from './fixtures/mock-products';
import { StoreApiError, type SearchOptions, type StoreHealth, type StoreId, type StoreProduct, type StoreProvider } from './types';

const MOCK_DELAY_MS = 250;
const DEFAULT_LIMIT = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldFail(storeId: StoreId): boolean {
  const raw = process.env.EXPO_PUBLIC_STORE_MOCK_FAIL?.trim().toLowerCase();
  return raw === 'both' || raw === storeId;
}

function normalizeForSearch(text: string): string {
  return text.toLocaleLowerCase('nl-NL').normalize('NFC');
}

export function createMockProvider(storeId: StoreId, displayName: string): StoreProvider {
  async function searchProducts(query: string, options?: SearchOptions): Promise<StoreProduct[]> {
    await sleep(MOCK_DELAY_MS);
    if (shouldFail(storeId)) {
      throw new StoreApiError(`${storeId}: mock çökme simülasyonu (EXPO_PUBLIC_STORE_MOCK_FAIL)`, storeId, 'network');
    }
    const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean);
    const limit = options?.limit ?? DEFAULT_LIMIT;
    return MOCK_PRODUCTS[storeId]
      .filter((product) => {
        const haystack = normalizeForSearch(`${product.name} ${product.brand ?? ''}`);
        return tokens.some((token) => haystack.includes(token));
      })
      .slice(0, limit);
  }

  async function getPrice(sku: string): Promise<StoreProduct | null> {
    await sleep(MOCK_DELAY_MS);
    if (shouldFail(storeId)) {
      throw new StoreApiError(`${storeId}: mock çökme simülasyonu (EXPO_PUBLIC_STORE_MOCK_FAIL)`, storeId, 'network');
    }
    return MOCK_PRODUCTS[storeId].find((product) => product.sku === sku) ?? null;
  }

  async function healthCheck(): Promise<StoreHealth> {
    const startedAt = Date.now();
    if (shouldFail(storeId)) {
      return { storeId, ok: false, latencyMs: Date.now() - startedAt, detail: 'mock çökme simülasyonu' };
    }
    return { storeId, ok: true, latencyMs: Date.now() - startedAt, detail: 'mock sağlayıcı' };
  }

  return { id: storeId, displayName, searchProducts, getPrice, healthCheck };
}
