/**
 * Sentry crash raporlama — PostHog'dan bağımsız; hatalar SADECE Sentry'ye
 * gider (PostHog'a error event'i üretilmez — hacim + triage ayrımı).
 *
 * GDPR: sendDefaultPii kapalı (IP toplanmaz); console breadcrumb'ları
 * envanter adı / LLM çıktısı sızdırabildiği için mesajları maskelenir.
 * Kimlik köprüsü: PostHog'un anonim distinct_id'si Sentry user.id olarak
 * bağlanır ki bir crash, PostHog'daki yolculukla çapraz incelenebilsin.
 *
 * Expo Go sınırı: native crash yakalama dev build gerektirir — Expo Go'da
 * yalnız JS hataları raporlanır.
 */
import * as Sentry from '@sentry/react-native';

let initialized = false;

export function initCrashReporting(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;

  try {
    Sentry.init({
      dsn, // EU bölgesi DSN'i (…ingest.de.sentry.io) — README'ye bak
      enabled: !__DEV__,
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
      beforeSend(event) {
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((crumb) =>
            crumb.category === 'console'
              ? { ...crumb, message: '[redacted]', data: undefined }
              : crumb
          );
        }
        return event;
      },
    });
    initialized = true;
  } catch (error) {
    // Telemetri uygulamayı asla kıramaz (ör. web'de native modül yokluğu).
    console.warn('[tracking] Sentry init atlandı:', error);
  }
}

/** PostHog anonim kimliğini Sentry'ye bağlar (yalnız id — PII yok). */
export function bindCrashIdentity(distinctId: string): void {
  if (!initialized) return;
  try {
    Sentry.setUser({ id: distinctId });
  } catch {
    // sessiz — yukarıdaki kuralla aynı
  }
}

/** Root bileşeni Sentry ile sarar (init edilmemişse dokunmadan geri verir). */
export function wrapRoot<P extends Record<string, unknown>>(
  component: React.ComponentType<P>
): React.ComponentType<P> {
  if (!initialized) return component;
  try {
    return Sentry.wrap(component);
  } catch {
    return component;
  }
}
