---
name: yemek-app
description: Yemek uygulaması (4 sayfalı, AI destekli envanter + tarif uygulaması) üzerinde yapılan TÜM geliştirme işlerinde bu skill'i kullan. Kullanıcı bu projede yeni sayfa, bileşen, ekran, API çağrısı, veritabanı tablosu veya tasarım değişikliği istediğinde — "yemek uygulaması", "envanter", "tarif sayfası", "şef AI", "sepet" gibi ifadeler geçtiğinde — mutlaka bu skill'e uy. Tasarım sistemi, mimari kararlar ve AI prompt formatları burada tanımlıdır.
---

# Yemek App — Proje Skill'i

Bu skill, 4 sayfalı AI destekli yemek uygulamasının geliştirme kurallarını içerir.
Bu projede kod yazmadan önce bu dosyayı oku ve buradaki kararlara uy.
Buradaki bir kuralı değiştirmen gerekiyorsa önce kullanıcıya sor.

## Mimari

- **Framework:** React Native + Expo (managed workflow, TypeScript)
- **Navigasyon:** expo-router, alt tab bar ile 4 sekme
- **Backend:** Supabase (auth, Postgres, storage)
- **AI:** Claude API (`claude-sonnet-4-6`) — fotoğraf analizi, tarif üretimi, tarif chat'i
- **State:** Zustand (global), TanStack Query (server state)
- API anahtarları asla client koduna gömülmez; Supabase Edge Function
  üzerinden proxy'lenir.

## MVP kapsamı (öncelik sırası)

Şu an SADECE iki özellik geliştiriliyor; diğer sayfalar için istek gelirse
kullanıcıya MVP kapsamını hatırlat:
1. Fotoğraf/video ile ürün tanıma → envantere ekleme (Mutfağım sayfası)
2. Envanterden kaliteli tarif üretimi (Tarifler sayfası, chat HARİÇ)

Kayıtlı yemekler, sepet ve tarif chat'i MVP SONRASI eklenecek.

## Sayfalar ve sorumlulukları

1. **Mutfağım (`/`)** — Fiş fotoğrafı veya buzdolabı fotoğrafı/videosu
   yükleme; Claude vision ile ürün çıkarımı; düzenlenebilir envanter
   listesi (miktar +/-, silme). Video doğrudan API'ye gönderilmez:
   cihazda karelere ayrılır (bkz. "Fotoğraf/Video → envanter").
2. **Tarifler (`/recipes`)** — Envantere göre AI tarif önerileri. Her kart:
   kalori, kişi sayısı, süre, makrolar, envanter uyum yüzdesi.
   Detayda adım adım hazırlanış + **tarife özel chat** (her tarif için ayrı
   konuşma geçmişi, `recipe_id` ile saklanır).
3. **Kayıtlı (`/saved`)** — Kaydedilen tarifler; malzemeler ve hazırlanış;
   "malzemeleri sepete ekle" aksiyonu.
4. **Sepet (`/cart`)** — Tarife göre gruplu alışveriş listesi; işaretleme,
   silme, temizleme.

## Tasarım sistemi

Demo'da onaylanan görsel dil. Bundan sapma:

- **Renkler:** zemin `stone-50`, kartlar beyaz + `ring-stone-100`,
  birincil `emerald-900`, vurgu `amber-500`, hata `red-500`
- **Tipografi:** başlıklar Fraunces (serif), gövde Outfit
- **Bileşen dili:** `rounded-2xl` kartlar, yumuşak gölge (`shadow-sm`),
  rozetler (`Badge`) ikon + metin ile, dokunmada `active:scale-95`
- **Kopya dili:** Türkçe, samimi ama net ("Bugün ne pişsin?" tonu);
  buton metinleri eylemi söyler ("Malzemeleri sepete ekle", "Gönder" değil)
- Boş durumlar yönlendirme içerir ("Tarif sayfasından malzeme
  ekleyebilirsin"), asla sadece "Liste boş" yazmaz.

## Veritabanı şeması (Supabase)

- `inventory_items(id, user_id, name, qty, unit, emoji, updated_at)`
- `recipes(id, user_id, name, kcal, servings, time_min, macros jsonb,
  ingredients jsonb, steps jsonb, created_at)`
- `saved_recipes(user_id, recipe_id)`
- `recipe_chats(id, recipe_id, user_id, role, content, created_at)`
- `cart_items(id, user_id, name, recipe_name, checked)`
- Tüm tablolarda RLS aktif: `user_id = auth.uid()`

## Claude API çağrı formatları

### Fotoğraf/Video → envanter
- **Fotoğraf:** doğrudan base64 image bloğu olarak gönderilir.
- **Video:** Claude API video kabul etmez. Cihazda `expo-video-thumbnails`
  ile videodan kare çıkarılır (saniyede 1 kare, en fazla 8 kare),
  kareler tek istekte çoklu image bloğu olarak gönderilir. Sistem
  talimatına "kareler aynı buzdolabının farklı anları, ürünleri
  TEKİLLEŞTİR" kuralı eklenir.

Sistem talimatı: fiş/buzdolabı görüntülerinden ürünleri çıkar, SADECE JSON dön:
`[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, "confidence": "high|low" }]`
Markdown backtick yok, açıklama yok. `confidence: low` olan ürünler
arayüzde "onayla" rozetiyle gösterilir. Yanıt parse edilemezse kullanıcıya
"tekrar dene" durumu göster, asla boş envanter yazma.

### Envanter → tarif önerisi
Girdi: envanter listesi. Çıktı: SADECE JSON, 4-6 tarif:
`[{ "name", "emoji", "kcal", "servings", "time_min", "macros": {"protein","karb","yag"}, "match_pct", "ingredients": [], "steps": [] }]`
`match_pct` = envanterde bulunan malzeme oranı.

### Tarif chat'i
Her istek şunları içerir: tarifin tamamı + o tarife ait geçmiş mesajlar
(`recipe_chats` tablosundan). Sistem talimatı: "Türkçe konuşan bir şefsin,
yalnızca bu tarif bağlamında yanıt ver, tarifte değişiklik önerirken
miktarları da güncelle."

## Çalışma kuralları

- Her sayfa ayrı görev olarak geliştirilir; sayfa bitince `npx expo start`
  ile test edilebilir durumda bırak.
- Commit mesajları Türkçe ve conventional format: `feat: envanter sayfası`,
  `fix: sepet rozet sayacı`.
- Yeni paket eklemeden önce mevcut bağımlılıklarla çözülebiliyor mu kontrol et.
- Mock veri yalnızca `__mocks__/` altında yaşar; production kodunda mock
  kalmışsa temizle.
