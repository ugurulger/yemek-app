import { claudeVisionProvider } from './claude-provider';
import { geminiVisionProvider } from './gemini-provider';
import type { InventoryItem, VisionProvider, VisionProviderName } from './types';

export { InventoryVisionError } from './types';
export type { InventoryItem, VisionProvider, VisionProviderName } from './types';

const PROVIDERS: Record<VisionProviderName, VisionProvider> = {
  claude: claudeVisionProvider,
  gemini: geminiVisionProvider,
};

function resolveProviderName(): VisionProviderName {
  const raw = process.env.EXPO_PUBLIC_VISION_PROVIDER?.trim().toLowerCase();
  if (raw === 'gemini') {
    return 'gemini';
  }
  return 'claude';
}

/**
 * Geçici A/B test ayarı: EXPO_PUBLIC_VISION_PROVIDER=claude|gemini (.env).
 * Değer boş/tanımsızsa veya "gemini" değilse Claude varsayılan olarak kullanılır.
 */
export function getVisionProvider(): VisionProvider {
  return PROVIDERS[resolveProviderName()];
}

/**
 * Bir veya daha fazla görüntüden (base64, data URI prefix'i olmadan) seçili
 * vision sağlayıcısıyla (bkz. EXPO_PUBLIC_VISION_PROVIDER) envanter ürünleri
 * çıkarır. Birden fazla görüntü, aynı buzdolabının/mutfağın videodan
 * çıkarılmış farklı kareleri olarak kabul edilir ve tekilleştirilir.
 */
export function extractInventory(images: string[]): Promise<InventoryItem[]> {
  return getVisionProvider().extractInventory(images);
}
