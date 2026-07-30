# tracking/ — PostHog EU + Sentry entegrasyon rehberi

Tracking plan: `.telemetry/tracking-plan.yaml` (v1, 23 event) · Delta: `.telemetry/delta.md` · SDK rehberi: `.telemetry/instrument.md`

## Kurulum

Paketler kurulu: `posthog-react-native`, `@sentry/react-native`, `expo-application`, `expo-device` (`npx expo install` ile eklendi; `@sentry/react-native` config plugin'i app.json'a otomatik girdi).

### Ortam değişkenleri (`.env`)

```bash
EXPO_PUBLIC_POSTHOG_API_KEY=phc_...                        # PostHog EU projesi API anahtarı
EXPO_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com          # GDPR: EU cloud — DEĞİŞTİRME
EXPO_PUBLIC_SENTRY_DSN=https://...@o...ingest.de.sentry.io/...  # Sentry EU bölgesi DSN
EXPO_PUBLIC_ANALYTICS_DEBUG=                               # "true" → dev build'de de event gönder
```

Kurulum adımları (bir kez):
1. [PostHog EU Cloud](https://eu.posthog.com)'da proje aç → Project API Key'i `EXPO_PUBLIC_POSTHOG_API_KEY`'e yaz.
2. [Sentry](https://sentry.io)'de **EU data residency** seçili org + React Native projesi aç → DSN'i `EXPO_PUBLIC_SENTRY_DSN`'e yaz. Release build'lerde source map yüklemek istersen `SENTRY_AUTH_TOKEN` + app.json plugin'ine `{"organization": "...", "project": "..."}` ekle (opsiyonel; yokken build kırılmaz, yalnız stack trace'ler map'lenmez).

## Kullanım

```ts
import { trackRecipeViewed } from '@/tracking';

trackRecipeViewed({ source: 'generated_list', missing_count: 2, is_fine_dining: false });
```

Kurallar:
- **Ham `posthog.capture()` çağrısı ekran koduna yazılmaz** — her event `tracking/events.ts`'te tipli bir fonksiyondur; yeni event = önce `.telemetry/tracking-plan.yaml`'a ekle (instrument-new-feature skill'i), sonra buraya fonksiyon.
- **`lib/` ve `services/` bu modülü import ETMEZ** (i18n kuralıyla aynı gerekçe: Node eval/test script'leri kırılmasın). Ekranlar ve `store/` katmanı import edebilir (istisna: `store/marketMatchStore.ts` koşu metriği).
- **PII yasak:** property'lerde envanter/tarif/malzeme adı, chat metni, arama sorgusu, fotoğraf taşınmaz — sayı/enum/bayrak.
- Kimlik: PostHog'un ürettiği anonim cihaz UUID'si. `identify()` çağrılmaz; Supabase auth gelirse `posthog.identify(supabaseUserId)` ile bağlanır.
- Hatalar SADECE Sentry'ye — PostHog'a error event'i üretme.

## Dev'de doğrulama

1. `.env`'e `EXPO_PUBLIC_ANALYTICS_DEBUG=true` yaz, uygulamayı başlat.
2. Metro konsolunda `[PostHog]` debug logları görünür; PostHog → Activity → Live Events'te (EU projesi) event'ler ~10 sn içinde düşer.
3. Sentry testi: herhangi bir ekranda `Sentry.captureException(new Error('test'))` (native crash testi dev build ister; Expo Go yalnız JS hatası yakalar). `initCrashReporting` `enabled: !__DEV__` ile kuruludur — dev'de Sentry'ye gönderim kapalıdır, test için geçici olarak `enabled: true` yapıp geri al.
4. Prod izleme (ilk hafta): PostHog'da event bazlı hacim (ani sıçrama = render döngüsünde çağrı), Sentry'de yeni issue oranı.

Not: dev build'ler varsayılan olarak event GÖNDERMEZ (`__DEV__` + bayrak kapalı → SDK `disabled`); prod'u kirletme koruması budur.

## Dosyalar

| Dosya | Sorumluluk |
|---|---|
| `analytics.ts` | PostHog singleton (EU host, dev opt-out, lifecycle autocapture kapalı) |
| `events.ts` | `EVENTS` sabit kaydı + 23 tipli event fonksiyonu + `initTracking` (app.opened + AppState) |
| `milestones.ts` | `is_first` bayrakları / `first_*_at` $set_once değerleri (AsyncStorage) |
| `crash.ts` | Sentry init + kimlik köprüsü + `wrapRoot` |
