# App Store Connect — App Privacy anketi cevap anahtarı

Kaynak: `.telemetry/data-inventory.md` (2026-07-19 kod taraması). App Store
Connect → App Privacy bölümünü doldururken birebir bunu kullan.

## Do you collect data from this app? → **Yes**

## Toplanan veri türleri (hepsi **Data Not Linked to You**, hepsi **NOT used for tracking**)

| App Store kategorisi | Alt tip | Amaç (anket seçimi) | Kaynak |
|---|---|---|---|
| **Usage Data** | Product Interaction | Analytics | PostHog eventleri (sayı/enum — içerik yok) |
| **Identifiers** | User ID *(anonim, cihazda üretilen UUID)* | Analytics | PostHog distinct_id = Sentry user.id |
| **Diagnostics** | Crash Data | App Functionality | Sentry |
| **Diagnostics** | Performance Data | App Functionality | Sentry %10 örnekleme |

## Bilerek "Hayır" işaretlenecekler

- Contact Info, Health, Financial, Location, Contacts, User Content*, Browsing/Search History, Purchases: **toplanmıyor**
- Tracking (ATT / cross-app): **No** — IDFA kullanılmıyor
- Data Linked to You: **yok** (hesap/kimlik yok)

*User Content notu: fotoğraf/video ve metinler İŞLEME için AI API'lerine
gider ama saklanmaz ve kimliğe bağlanmaz — Apple'ın tanımına göre
"collected" sayılmaz (sunucuda cihaz dışı kalıcı tutma yok). Politikada
açıkça anlatılıyor.

## Diğer App Store Connect alanları

- **Age rating anketi:** şiddet/kumar vb. yok → 4+ beklenir
- **Encryption (ITSAppUsesNonExemptEncryption):** app.json'da `false` gömülü —
  App Store Connect ayrıca sormaz
- **Privacy Policy URL:** yayınlanan privacy-policy sayfasının URL'si
  (Ayarlar ekranındaki EXPO_PUBLIC_PRIVACY_POLICY_URL ile aynı olmalı)
