import type { InventoryItem } from '@/types/inventory';

export type { InventoryItem };

/**
 * Fotoğraf/görüntülerden envanter çıkarımı sırasında oluşan hatalar için
 * kullanılan tek hata tipi. Çağıran taraf bunu yakalayarak kullanıcıya
 * "tekrar dene" durumu gösterebilir — hangi sağlayıcı (Claude/Gemini) hata
 * verirse versin aynı tip fırlatılır.
 */
export class InventoryVisionError extends Error {}

/**
 * Tüm vision sağlayıcılarının uyması gereken ortak arayüz. Sağlayıcılar
 * (Claude, Gemini, ...) SKILL.md'deki "Fotoğraf/Video → envanter" JSON
 * şemasıyla birebir aynı çıktıyı üretmek zorundadır.
 */
export interface VisionProvider {
  extractInventory(images: string[]): Promise<InventoryItem[]>;
}

export type VisionProviderName = 'claude' | 'gemini';
