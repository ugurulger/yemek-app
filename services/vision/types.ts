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
 * Bir sağlayıcı çağrısının (tek aşamalı veya çok aşamalı) gerçek token
 * kullanımı. `onUsage` callback'i ile raporlanır — eval script'inin
 * (`tests/vision-eval/run-eval.ts`) karakter/piksel sayımına dayalı kaba
 * tahmin yerine API'den dönen gerçek `usage` rakamlarını kullanabilmesi
 * için var; production akışında kullanılması ZORUNLU değildir.
 */
export interface UsageEvent {
  /** Örn. "single" (tek çağrı), "observation", "structuring" (çok aşamalı akış). */
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ExtractInventoryOptions {
  onUsage?: (event: UsageEvent) => void;
  /**
   * Aşama 1 (gözlem) tamamlanır tamamlanmaz, ham serbest metin haliyle
   * (yapılandırma/parse öncesi) çağrılır — DEBUG amaçlı, bkz. SKILL.md
   * "Debug: Aşama 1 ham metnini gör".
   */
  onObservation?: (text: string) => void;
  /**
   * DENEYSEL — sadece Gemini native video girişi için (bkz.
   * `gemini-provider.ts`, `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO`). Sağlanırsa
   * ve bayrak açıksa, Gemini video karelerini çıkarmak yerine ham videoyu
   * TEK bir `inlineData` parçası olarak gönderir. Claude bu alanı YOK
   * SAYAR (video kabul etmiyor, bkz. SKILL.md).
   */
  video?: { data: string; mimeType: string };
}

/**
 * Tüm vision sağlayıcılarının uyması gereken ortak arayüz. Sağlayıcılar
 * (Claude, Gemini, ...) SKILL.md'deki "Fotoğraf/Video → envanter" bölümünde
 * tanımlı InventoryItem şemasıyla birebir aynı çıktıyı üretmek zorundadır —
 * dahili olarak (tek çağrı ya da çok aşamalı) nasıl ulaştıkları serbesttir.
 */
export interface VisionProvider {
  extractInventory(images: string[], options?: ExtractInventoryOptions): Promise<InventoryItem[]>;
}

export type VisionProviderName = 'claude' | 'gemini';
