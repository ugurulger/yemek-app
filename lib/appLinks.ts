/**
 * Uygulama dışı bağlantılar (Ayarlar ekranı) — App Store gereksinimi:
 * gizlilik politikası + destek sayfası. URL'ler env ile override edilebilir;
 * yoksa PLACEHOLDER kullanılır. Gönderim ÖNCESİ gerçek URL'ler zorunlu
 * (bkz. analysis/app-store-review-riskleri.md).
 */
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://example.com/yemek-app/privacy';

export const SUPPORT_URL =
  process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://example.com/yemek-app/support';
