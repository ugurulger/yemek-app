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
- **AI:** Claude API + Gemini API (vision sağlayıcı karşılaştırması,
  `VISION_PROVIDER` ile seçilir) — envanter çıkarımı için, bkz. `services/vision/`.
  MVP-2 testi sonrası varsayılan `claude` (kazanan sağlayıcı, bkz. "Sağlayıcı
  karşılaştırma notları"); Gemini kod tabanında A/B için tutulur.
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
- **Fotoğraf:** `resizeImageToBase64` ile uzun kenar 1568px'i aşmayacak
  şekilde küçültülüp base64 image bloğu olarak gönderilir.
- **Video:** Claude API video kabul etmez. Cihazda `expo-video-thumbnails`
  ile videodan kare çıkarılır (saniyede 1 kare, en fazla 8 kare), her kare
  aynı 1568px sınırından geçirilir (bkz. `lib/media/extractVideoFrames.ts`),
  kareler tek istekte çoklu image bloğu olarak gönderilir. Sistem
  talimatına "kareler aynı buzdolabının farklı anları, ürünleri
  TEKİLLEŞTİR" kuralı eklenir. Kare sayısı (8) MVP-2 testinde bilinçli
  tutuldu — 8 saniyelik test videosunda farklı ürünler kare 1, 4, 5, 6, 7,
  8'e dağılmıştı; azaltmak kayda değer ürün kaybına yol açardı.

Sistem talimatı (MVP-2'de güncellendi — bkz. altta): fiş/buzdolabı
görüntülerinden ürünleri çıkar, SADECE JSON dön:
`[{ "name": string, "qty": number, "unit": "adet|g|kg|ml|l|demet", "emoji": string, "confidence": "high|low" }]`
`"name"` alanı **Türkçe ve genel ürün adı** olmalı (örn. "süt", "peynir",
"domates") — marka adı veya ambalaj üzerindeki yabancı dil metni
KULLANILMAMALI; aynı genel üründen birden fazla adet/paket varsa TEK
satırda toplanıp miktar buna göre verilmeli. Markdown backtick yok,
açıklama yok. `confidence: low` olan ürünler arayüzde "onayla" rozetiyle
gösterilir. Yanıt parse edilemezse kullanıcıya "tekrar dene" durumu göster,
asla boş envanter yazma.

> **MVP-2 prompt değişikliği neden yapıldı:** İlk testte modeller ürünleri
> doğru buluyor ama markalı/yabancı dil isimlerle dönüyordu (örn. "süt"
> yerine "Arla Bio Halfvolle Melk", "domates" yerine "tomato"). Bu hem
> test eşleşmesini hem de gerçek tarif eşleştirmesini (envanterdeki isim
> tarif malzemesiyle örtüşmeli) bozuyordu. Genel Türkçe isim + tekilleştirme
> kuralı eklenince doğruluk Claude'da %18 → %91, Gemini'de %0 → %82'ye
> çıktı (bkz. "Sağlayıcı karşılaştırma notları").

Bu çıkarım artık sağlayıcıdan bağımsız (`services/vision/`, bkz.
`VisionProvider` arayüzü): Claude (`claude-provider.ts`) ve Gemini
(`gemini-provider.ts`) aynı sistem talimatını ve yukarıdaki JSON şemasını
kullanır, ikisi de aynı şekilde parse/doğrulanır. `EXPO_PUBLIC_VISION_PROVIDER`
(`claude` | `gemini`) ile kod değiştirmeden geçiş yapılır. Sistem talimatı
Claude tarafında `cache_control: {"type": "ephemeral"}` ile işaretlenir
(maliyet kuralı); Gemini tarafında 2.5 modellerinin varsayılan "implicit
caching"i aynı işlevi görür, ayrıca kod gerekmez.

### Envanter → tarif önerisi
Girdi: envanter listesi. Çıktı: SADECE JSON, 4-6 tarif:
`[{ "name", "emoji", "kcal", "servings", "time_min", "macros": {"protein","karb","yag"}, "match_pct", "ingredients": [], "steps": [] }]`
`match_pct` = envanterde bulunan malzeme oranı.

### Tarif chat'i
Her istek şunları içerir: tarifin tamamı + o tarife ait geçmiş mesajlar
(`recipe_chats` tablosundan). Sistem talimatı: "Türkçe konuşan bir şefsin,
yalnızca bu tarif bağlamında yanıt ver, tarifte değişiklik önerirken
miktarları da güncelle."

## Sağlayıcı karşılaştırma notları

**MVP-2 test sonucu (2026-07-04, 1 video fixture — 8 saniyelik buzdolabı
videosu, 11 ürünlük ground truth, MVP-2 prompt+boyutlandırma
optimizasyonundan sonra):**

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Tahmini maliyet |
|---|---|---|---|---|
| **Claude Sonnet 4.6 (kazanan)** | %91 (10/11) | 4 | 8.1s | ~$0.05 |
| Gemini 2.5 Flash | %82 (9/11) | 2 | 17.6s | hesaplanmadı (fiyat girilmedi) |

**Karar: `EXPO_PUBLIC_VISION_PROVIDER=claude` varsayılan.** Claude hem daha
doğru hem ~2 kat daha hızlı; Gemini'nin daha az yanlış pozitif üretmesi
(2 vs 4) bu farkı dengelemiyor. Örneklem küçük (tek video) — daha fazla
fixture eklenip eval tekrar çalıştırıldıkça bu karar güncellenmeli.

Optimizasyon öncesi (ilk ham test, aynı video): sistem talimatı marka/yabancı
dil isimlerini engellemiyordu ve video kareleri 1568px sınırından
geçmiyordu — Claude %18, Gemini %0 doğruluk ölçülmüştü (görünüşte düşük
ama aslında çoğu ürün doğru bulunmuş, sadece "Arla Bio Halfvolle Melk" gibi
markalı/yabancı isimlerle dönmüştü, ground truth'taki jenerik Türkçe
isimlerle eşleşmedi). Bkz. "Fotoğraf/Video → envanter" bölümündeki prompt
notu ve altındaki eval seti açıklaması.

Karar için elle ölçüm sağlayan bir eval seti var: `tests/vision-eval/`.
Kullanıcı `fixtures/` altına gerçek fotoğraf/video + elle girilmiş
ground-truth.json koyar; `npx tsx tests/vision-eval/run-eval.ts` her
fixture'ı hem Claude hem Gemini'den geçirip doğruluk oranı, yanlış pozitif
sayısı, yanıt süresi ve tahmini token/maliyet raporunu
`tests/vision-eval/results/` altına tarihli bir `.md` dosyası olarak yazar
(bkz. `fixtures/README.md`). Video fixture'ları için ffmpeg kurulu olmalı
(`brew install ffmpeg`) — uygulamadaki gerçek kare çıkarımı
`expo-video-thumbnails` ile yapılır, script masaüstünde çalıştığı için
ffmpeg'e ihtiyaç duyar.

## Çalışma kuralları

- Her sayfa ayrı görev olarak geliştirilir; sayfa bitince `npx expo start`
  ile test edilebilir durumda bırak.
- Commit mesajları Türkçe ve conventional format: `feat: envanter sayfası`,
  `fix: sepet rozet sayacı`.
- Yeni paket eklemeden önce mevcut bağımlılıklarla çözülebiliyor mu kontrol et.
- Mock veri yalnızca `__mocks__/` altında yaşar; production kodunda mock
  kalmışsa temizle.
