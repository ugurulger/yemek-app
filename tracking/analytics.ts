/**
 * PostHog istemcisi — TEK örnek (singleton). Ekranlar bu dosyayı DEĞİL,
 * `tracking/events.ts` içindeki tipli fonksiyonları kullanır.
 *
 * KURAL (GDPR — kullanıcı kararı): host HER ZAMAN EU cloud
 * (https://eu.i.posthog.com). Kimlik = PostHog'un AsyncStorage'da ürettiği
 * anonim cihaz UUID'si; identify() HİÇBİR YERDE çağrılmaz (auth yok).
 * Supabase auth gelirse anonim geçmiş `posthog.identify(supabaseUserId)`
 * ile bağlanır.
 *
 * KURAL (iç kullanıcı politikası — .telemetry/tracking-plan.yaml meta):
 * __DEV__ build'ler event GÖNDERMEZ; geliştirmede test için
 * EXPO_PUBLIC_ANALYTICS_DEBUG=true ile açılır.
 */
import PostHog from 'posthog-react-native';

const API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY ?? '';
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';
const DEBUG_ENABLED = process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true';

/** Gönderim kapalı mı — anahtar yoksa veya debug bayraksız dev build'iyse. */
export const trackingDisabled = (__DEV__ && !DEBUG_ENABLED) || !API_KEY;

export const posthog = new PostHog(API_KEY || 'phc_disabled', {
  host: HOST, // GDPR: EU cloud — değiştirme
  flushAt: 20,
  flushInterval: 10000,
  // app.opened'ı kendimiz üretiyoruz (is_first_open + language property'leri
  // gerekli) — SDK'nın otomatik lifecycle event'leri kapalı ki çift sayım olmasın.
  captureAppLifecycleEvents: false,
  disabled: trackingDisabled,
});

if (DEBUG_ENABLED && __DEV__) {
  posthog.debug(true);
}
