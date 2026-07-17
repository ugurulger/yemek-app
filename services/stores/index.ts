/**
 * Mağaza sağlayıcı kaydı + env anahtarıyla seçim (services/vision/index.ts
 * kalıbı).
 *
 * `EXPO_PUBLIC_STORE_PROVIDER = live | mock`:
 * - `live`  → unofficial AH + Jumbo mobil API client'ları
 * - `mock`  → sabit katalog (fixtures/mock-products.ts)
 * - tanımsız → web'de `mock` (mağaza API'leri tarayıcıda CORS'a takılır,
 *   canlı yol web'de HİÇBİR ZAMAN çalışamaz), native'de `live`.
 */

import { Platform } from 'react-native';

import { ahStoreProvider } from './ah-provider';
import { jumboStoreProvider } from './jumbo-provider';
import { createMockProvider } from './mock-provider';
import type { StoreId, StoreProvider } from './types';

export { StoreApiError, STORE_IDS } from './types';
export type { SearchOptions, StoreHealth, StoreId, StoreProduct, StoreProvider } from './types';

const LIVE_PROVIDERS: Record<StoreId, StoreProvider> = {
  ah: ahStoreProvider,
  jumbo: jumboStoreProvider,
};

const MOCK_PROVIDERS: Record<StoreId, StoreProvider> = {
  ah: createMockProvider('ah', 'Albert Heijn'),
  jumbo: createMockProvider('jumbo', 'Jumbo'),
};

type StoreProviderMode = 'live' | 'mock';

function resolveMode(): StoreProviderMode {
  const raw = process.env.EXPO_PUBLIC_STORE_PROVIDER?.trim().toLowerCase();
  if (raw === 'live') {
    return 'live';
  }
  if (raw === 'mock') {
    return 'mock';
  }
  return Platform.OS === 'web' ? 'mock' : 'live';
}

export function getStoreProviders(): Record<StoreId, StoreProvider> {
  return resolveMode() === 'mock' ? MOCK_PROVIDERS : LIVE_PROVIDERS;
}
