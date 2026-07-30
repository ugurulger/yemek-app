# Yemek App — Veri Envanteri (App Privacy etiketleri + gizlilik politikası girdisi)

**Tarih:** 2026-07-19 · **Kapsam:** uygulamanın topladığı/işlediği TÜM veri türleri — nerede durduğu ve hangi sunuculara gittiği. Kaynak: kod taraması (.telemetry/product.md) + bu oturumda eklenen analitik.

Kimlik modeli: hesap/auth YOK. Tek kalıcı tanımlayıcı, cihazda üretilen **anonim UUID** (PostHog distinct_id; Sentry user.id olarak da aynı değer). Ad, e-posta, telefon, konum, rehber, sağlık verisi vb. HİÇBİR YERDE toplanmaz.

## 1) Yalnızca CİHAZDA kalan veriler (AsyncStorage / dosya cache — hiçbir sunucuya yazılmaz)

| Veri | Nerede | Not |
|---|---|---|
| Envanter listesi (ürün adları TR/EN, miktar, birim, marka, kategori, confidence) | `inventoryStore` (AsyncStorage) | Kalıcı sunucu kaydı yok; yalnız işleme için AI sağlayıcılarına gönderilir (bkz. §2) |
| Kiler (Temel Malzemeler) durumu | `pantryStore` | — |
| Üretilmiş tarifler + önbellek parmak izi | `recipeStore` | — |
| Defterler, kayıtlı/içe aktarılmış tarifler | `cookbookStore` | — |
| Haftalık plan | `planStore` | — |
| Market sepeti + işaretli satırlar | `cartStore` | — |
| Şefe Sor sohbet geçmişi | `chefChatStore` | Cihazda kalır; her soru işlem için Claude API'ye gider (§2) |
| Ürün eşleştirme düzeltmeleri + mağaza fiyat cache'i | `matchCacheStore`, `storePriceStore` | — |
| Dil tercihi, tarif tercihleri | AsyncStorage / `recipeStore` | — |
| Tarif görselleri | FileSystem cache (`recipe-images/`) | — |
| Analitik milestone bayrakları (`first_*_at`) | `tracking/milestones.ts` (AsyncStorage) | — |
| Fotoğraf/video (buzdolabı, fiş) | Geçici — analiz için okunur | Cihazda saklanmaz; işleme için AI sağlayıcısına gönderilir (§2), sunucularımızda tutulmaz |

## 2) SUNUCUYA giden veriler — İŞLEME amaçlı (üçüncü taraf AI/mağaza API'leri; uygulama tarafında kalıcı sunucu kaydı yok)

| Veri | Alıcı | Amaç |
|---|---|---|
| Buzdolabı/fiş FOTOĞRAF ve VİDEOLARI | Google Gemini API (varsayılan) veya Anthropic Claude API | Envanter çıkarımı. >18MB video Gemini Files API'ye geçici yüklenir |
| Envanter/kiler ürün ADLARI + tercihler | Anthropic Claude API; RAG açıkken Supabase edge function (`generate-recipe`, proje bwifrndcigjxdqvurltw) → Anthropic | Tarif üretimi |
| Şefe Sor mesaj metni + tarif bağlamı | Anthropic Claude API | Tarif sohbeti |
| Asistanla ekleme serbest metni | Anthropic Claude API (haiku) | Malzeme ayrıştırma |
| Envanter adları (çeviri için) | Anthropic Claude API | TR↔EN backfill |
| Tarif görsel prompt'u (EN, malzeme özeti) | Google Gemini image API | Tarif görseli üretimi |
| Sepet malzeme adları (NL sorguları) | Albert Heijn API, Jumbo GraphQL API (+ eşleştirme için Claude haiku) | Fiyat karşılaştırma. AH/Jumbo'ya kimlik GÖNDERİLMEZ (anonim istekler) |

Not (App Privacy açısı): bu akışlarda veri "bizim" sunucumuzda saklanmaz; üçüncü taraf işleyicilere (Google, Anthropic, Supabase, AH/Jumbo) API çağrısı olarak gider. Gizlilik politikasında işleyici olarak sayılmalı.

## 3) SUNUCUDA toplanan veriler — ANALİTİK (PostHog EU, `eu.i.posthog.com`, Almanya/Frankfurt)

- **Kimlik:** anonim cihaz UUID (distinct_id). Ad/e-posta/telefon YOK; `identify()` çağrılmıyor.
- **Event verisi (23 event):** yalnız SAYI/ENUM/BAYRAK — ör. yakalama yöntemi (photo|video|assistant), ürün SAYISI, eksik malzeme SAYISI, süre (ms), başarı/hata tipi, mağaza (ah|jumbo), dil (tr|en). **Envanter/tarif/malzeme adları, chat metinleri, arama sorguları, fotoğraflar ASLA gönderilmez.**
- **Kişi profili property'leri:** `language`, `first_seen_at`, 5 aktivasyon milestone tarihi, `inventory_item_count` (sayı).
- **SDK'nın otomatik cihaz bağlamı:** uygulama sürümü, OS adı/sürümü, cihaz modeli, ekran, ülke/bölge (PostHog IP'den türetir; IP EU sunucusunda işlenir). Session replay + autocapture KAPALI.
- **Dev build'ler veri göndermez** (`__DEV__` → SDK disabled).

**App Privacy etiketi (Apple) karşılığı:** "Data Linked to You" YOK → **Data Not Linked to You**: Usage Data (Product Interaction), Identifiers (Device ID / user ID = anonim UUID), Diagnostics. Tracking (ATT anlamında cross-app izleme) YOK.

## 4) SUNUCUDA toplanan veriler — CRASH RAPORLAMA (Sentry, EU bölgesi `ingest.de.sentry.io`)

- Crash/JS hata stack trace'leri, cihaz/OS bilgisi, uygulama sürümü, olay öncesi breadcrumb izleri (**console mesajları `[redacted]` ile maskelenir** — envanter/LLM içeriği sızmaz).
- `sendDefaultPii: false` → IP adresi toplanmaz. Kullanıcı bağlamı yalnız anonim UUID (`user.id`).
- Performans izleme: işlemlerin %10 örneklemesi (süre metrikleri).
- **App Privacy karşılığı:** Diagnostics (Crash Data, Performance Data) — Not Linked to You.

## 5) Toplanmayan / bilinçli kapsam dışı

- Hesap bilgisi, e-posta, ad, telefon, ödeme verisi (uygulamada hesap/ödeme yok)
- Konum verisi
- ATT kapsamında izleme / reklam tanımlayıcısı (IDFA) — kullanılmıyor
- Session replay, ekran kaydı, tuş kaydı
- PostHog'a serbest metin/kullanıcı içeriği; Sentry'ye console içeriği

## Gizlilik politikası için işleyici listesi

| İşleyici | Bölge | Veri |
|---|---|---|
| PostHog Cloud EU | AB (Frankfurt) | Anonim kullanım analitiği |
| Sentry (EU residency) | AB | Crash/tanılama |
| Anthropic (Claude API) | ABD | Tarif üretimi/chat/ayrıştırma/çeviri girdileri (işleme) |
| Google (Gemini API) | ABD | Fotoğraf/video envanter çıkarımı, görsel üretimi (işleme) |
| Supabase (proje bwifrndcigjxdqvurltw) | proje bölgesi | RAG tarif üretimi edge function'ı (envanter adları geçer; kullanıcı verisi tablosu yok) |
| Albert Heijn / Jumbo API'leri | NL | Anonim ürün arama/fiyat sorguları |
