/**
 * Uygulama dışı bağlantılar (Ayarlar ekranı) — App Store gereksinimi:
 * gizlilik politikası + destek sayfası. URL'ler env ile override edilebilir;
 * yoksa GERÇEK yayın URL'leri (GitHub Pages, main + /docs) kullanılır —
 * 1 Ağu'da placeholder'lardan gerçek adreslere geçildi.
 */
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? 'https://ugurulger.github.io/yemek-app/privacy.html';

export const SUPPORT_URL =
  process.env.EXPO_PUBLIC_SUPPORT_URL ?? 'https://ugurulger.github.io/yemek-app/#support';
