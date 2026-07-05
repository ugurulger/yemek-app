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
- **AI:** Claude API (`claude-sonnet-4-6`) — tarif üretimi, tarif chat'i
- **AI:** Claude API + Gemini API (vision sağlayıcı karşılaştırması,
  `VISION_PROVIDER` ile seçilir) — envanter çıkarımı için, bkz. `services/vision/`.
  Varsayılan `gemini` (MVP-4 kararı, kullanıcının kalite tercihi — bkz.
  "Sağlayıcı karşılaştırma notları"); Claude kod tabanında A/B için tutulur.
  İkisi de aynı iki aşamalı mimariyi kullanır: gözlem (şemasız serbest
  metin) + yapılandırma (JSON'a dönüştürme) — bkz. "Fotoğraf/Video →
  envanter". `app/(tabs)/index.tsx` bu modülü `getVisionProvider()`
  üzerinden çağırır.
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
   yükleme; vision sağlayıcısıyla (varsayılan Gemini, bkz. "Mimari") ürün
   çıkarımı; düzenlenebilir envanter listesi (miktar +/-, silme). Video
   doğrudan API'ye gönderilmez: cihazda karelere ayrılır (bkz.
   "Fotoğraf/Video → envanter").
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

## AI çağrı formatları

### Fotoğraf/Video → envanter

> ✅ **MVP-3'te düzeltildi:** `app/(tabs)/index.tsx` daha önce bu bölümde
> anlatılan `services/vision/` modülünü DEĞİL, ondan önce yazılmış eski bir
> kopya olan `lib/claude/extractInventoryFromImages.ts` + `lib/claude/client.ts`'i
> çağırıyordu (eski tek-şema prompt, `claude-sonnet-4-6`, Gemini seçeneği
> yok) — yani MVP-2'deki optimizasyonlar canlı uygulamada aktif değildi. Bu
> düzeltildi: ekran artık `services/vision`'ı (`getVisionProvider()`)
> kullanıyor, eski `extractInventoryFromImages.ts` kaldırıldı
> (`lib/claude/client.ts` tarif üretimi için hâlâ kullanıldığından korundu).

- **Fotoğraf:** `resizeImageToBase64` ile uzun kenar 2576px'i aşmayacak
  şekilde küçültülüp base64 image bloğu olarak gönderilir (MVP-3'te
  1568 → 2576, bkz. altta "MVP-3" notu).
- **Video:** Claude API video kabul etmez. Cihazda `expo-video-thumbnails`
  ile videodan kare çıkarılır (saniyede 1 kare, en fazla 12 kare — MVP-3'te
  8 → 12, bkz. `lib/media/extractVideoFrames.ts`), her kare aynı 2576px
  sınırından geçirilir. "Sahne bazlı" kare seçimi (`kamera hareketine göre`)
  `expo-video-thumbnails`'in zaman-bazlı API'siyle YAPILAMIYOR (içerik
  farkına bakan bir filtre sunmuyor) — bu yüzden uygulanmadı, sabit
  aralıklı örnekleme kullanılıyor.

**İki sağlayıcı, ORTAK iki aşamalı mimari** (`services/vision/`, bkz.
`VisionProvider` arayüzü; paylaşılan promptlar `services/vision/prompt.ts`'te
tanımlı). Kök neden: tek-aşamalı sıkı JSON şeması modelin gözlem detayını
kısıtlıyordu (kullanıcı, kısıtlamasız/serbest bir promptla çok daha
detaylı/doğru sonuç alındığını doğruladı — bkz. altta MVP-3/MVP-4 notları).
Çözüm ikisi için de aynı:

1. **Aşama 1 — gözlem** (vision, yüksek çözünürlük): görselleri/kareleri
   ŞEMA DAYATMADAN, serbest metinle "gördüğün TÜM ürünleri madde madde
   anlat; marka, raf/çekmece konumu, miktar, emin olamadığın noktaları
   belirt" diye ister (`OBSERVATION_SYSTEM_PROMPT`). Düz metin döner,
   JSON değil. Claude: `claude-sonnet-5` (2576px'e kadar yüksek çözünürlük
   destekler, `thinking: {type:"disabled"}` ile — bkz. altta). Gemini:
   `gemini-2.5-flash` (`EXPO_PUBLIC_GEMINI_MODEL` ile değiştirilebilir).
2. **Aşama 2 — yapılandırma** (ucuz, metin girdili): Aşama 1'in metnini
   `[{ name, qty, unit, brand, confidence }]` şemasına çevirir ("hiçbir
   ürünü atlama" talimatıyla, `STRUCTURING_SYSTEM_PROMPT`). `"name"` yine
   jenerik Türkçe; marka ayrı `"brand"` alanına konur (bkz.
   `types/inventory.ts` — `InventoryItem.brand`, opsiyonel). Claude:
   `claude-haiku-4-5`. Gemini: aynı `gemini-2.5-flash` (sağlayıcı
   bağımsızlığı için — Gemini akışı Claude API'sine bağımlı olmamalı).

Aşama 2'nin çıktısı her iki sağlayıcıda da aynı `parseInventoryItems` ile
ayrıştırılır (opsiyonel `brand` alanı dahil) — ikisi de aynı
`InventoryItem[]` şeklini üretir. `EXPO_PUBLIC_VISION_PROVIDER`
(`claude` | `gemini`) ile kod değiştirmeden sağlayıcı geçişi yapılır.
`confidence: low` olan ürünler arayüzde "onayla" rozetiyle gösterilir.
Yanıt parse edilemezse kullanıcıya "tekrar dene" durumu göster, asla boş
envanter yazma. Claude sistem talimatını `cache_control: {"type":
"ephemeral"}` ile önbellekler; Gemini 2.5'in varsayılan "implicit
caching"i aynı işlevi görür.

> **MVP-2 prompt değişikliği neden yapıldı** (her iki sağlayıcının
> yapılandırma promptu için hâlâ geçerli): İlk testte modeller ürünleri
> doğru buluyor ama markalı/yabancı dil isimlerle dönüyordu (örn. "süt"
> yerine "Arla Bio Halfvolle Melk"). Genel Türkçe isim + tekilleştirme
> kuralı eklenince doğruluk Claude'da %18 → %91, Gemini'de %0 → %82'ye
> çıktı.

> **MVP-3 iki aşamalı mimari + çözünürlük artışı (Claude):** Kullanıcı,
> aynı videoda Gemini'ye şemasız prompt verildiğinde çok daha detaylı/doğru
> sonuç alındığını doğruladı — sorun model kapasitesi değil, Claude
> tarafındaki sıkı şemanın gözlem detayını kısıtlamasıydı. İki aşamalı akış
> + 1568→2576px çözünürlük artışı + 8→12 kare sınırıyla Claude'un doğruluğu
> %91 → %100'e çıktı, ama yanıt süresi/maliyet arttı (bkz. altta).
> `thinking: {type:"disabled"}` ile bu artış kısmen geri alındı.

> **MVP-4 aynı mimari Gemini'ye de uygulandı:** MVP-3 sonrası kullanıcı,
> Claude'un iki aşamalı çıktısının hâlâ kendi Gemini testindeki kaliteye
> ulaşmadığını belirtti. Kök neden aynıydı — bizim Gemini çağrımız hâlâ
> tek-aşamalı sıkı şemayı kullanıyordu, kullanıcıyı etkileyen serbest
> prompt değildi. Gemini'ye de aynı gözlem+yapılandırma akışı uygulandı ve
> varsayılan sağlayıcı `gemini` yapıldı — bkz. "Sağlayıcı karşılaştırma
> notları".

> **Debug/deneysel notlar:** Aşama 1 (gözlem) ham metnini görmek için
> Mutfağım ekranındaki **geçici** "[DEBUG] Ham Metni Gör" butonu
> kullanılabilir (analiz sonrası görünür, bir modal'da düz metin gösterir —
> kaldırılana kadar orada, `app/(tabs)/index.tsx` içinde "DEBUG — kaldırılacak"
> yorumuyla işaretli). Gemini'nin **native video girişi** denemesi
> `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO=true` ile test edilebilir — açıkken video
> seçildiğinde kareler çıkarılmaz, ham video tek `inlineData` parçası olarak
> Gemini'ye gönderilir (`services/vision/gemini-provider.ts`); sadece Gemini
> aktifken anlamlıdır, Claude video kabul etmiyor. İnline video için Google'ın
> önerdiği sınır ~20MB/istek — aşılırsa API'ye hiç istek atılmadan net bir
> hata gösterilir (Files API bu deneysel yol kapsamında UYGULANMADI).

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

**MVP-4 test sonucu (2026-07-05, aynı video fixture, iki aşamalı mimari
ARTIK HER İKİ sağlayıcıda da; rakamlar API `usage` alanından GERÇEK):**

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Gerçek maliyet |
|---|---|---|---|---|
| Claude (iki aşamalı) | %100 (11/11) | 10 | 52.5s | $0.153 |
| **Gemini (iki aşamalı, kazanan/varsayılan)** | %100 (11/11) | 14 | 61.8s | hesaplanmadı (fiyat girilmedi) |

**Karar: `EXPO_PUBLIC_VISION_PROVIDER=gemini` varsayılan (kullanıcı
tercihi).** Kullanıcı kendi (kod dışı) Gemini testinde gördüğü kaliteyi
uygulamada da istedi; kök sorun Gemini'ye ait DEĞİL, bizim kodumuzun hâlâ
sıkı şema kullanmasıydı — düzeltilince Gemini de %100 doğruluğa ulaştı.
Bu ölçümde Gemini biraz daha yavaş ve daha fazla ek ürün buldu (muhtemelen
yine ground truth'un eksikliğinden, bkz. MVP-3 notu) — **ama çarpıcı fark
token tarafında:** Gemini'nin gözlem aşaması aynı görseller için sadece
~3.300 girdi tokeni kullandı, Claude'un aynı işi ~57.800 tokenle yapmasına
karşılık (~17 kat fark) — Gemini'nin görsel tokenizasyonu Claude'unkinden
çok daha ucuz görünüyor. Gemini fiyatlandırması doğrulanmadığı için dolar
bazında kıyaslanamıyor, ama bu oran gerçek maliyetin de Gemini lehine
büyük farkla düşük olacağına işaret ediyor. Claude kod tabanında A/B için
tutuluyor.

---

**MVP-3 test sonucu (2026-07-05, aynı 1 video fixture — 8 saniyelik
buzdolabı videosu, 11 ürünlük ground truth, iki aşamalı Claude mimarisi +
2576px/12-kare optimizasyonundan sonra, henüz Gemini tek aşamalıyken;
rakamlar API `usage` alanından GERÇEK, tahmini değil):**

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Gerçek maliyet |
|---|---|---|---|---|
| Claude (iki aşamalı, thinking açık — ilk ölçüm) | %100 (11/11) | 10 | 58.2s | $0.158 |
| **Claude (iki aşamalı, thinking kapalı — bkz. altta)** | %100 (11/11) | 8 | 42.5s | $0.144 |
| Gemini 2.5 Flash (değişmedi) | %73–100 (varyans, bkz. altta) | 5–7 | 17.9–19.5s | hesaplanmadı (fiyat girilmedi) |

Claude aşama dökümü: Aşama 1 (gözlem, `claude-sonnet-5`) 57.806 girdi /
3.293 çıktı token, $0.149 — toplam maliyetin ~%94'ü. Aşama 2 (yapılandırma,
`claude-haiku-4-5`) 2.134 girdi / 1.435 çıktı token, $0.009 — toplam
maliyetin sadece ~%6'sı. **"Aşama 2 ucuz, toplam maliyet artışı sınırlı"
iddiası aşama bazında doğru** (Haiku çağrısı gerçekten ucuz) — ama
**toplamda MVP-2'ye göre maliyet ~3 kat, yanıt süresi ~7 kat arttı**
(MVP-2: $0.051 / 8.1s → MVP-3: $0.158 / 58.2s). Artışın asıl kaynağı Aşama
2 değil, Aşama 1'in kendisi: yüksek çözünürlük (2576px, ~2.7x piksel) +
daha pahalı model (Sonnet 5) + `claude-sonnet-5`'te varsayılan olarak açık
gelen adaptive thinking + tek istek yerine iki sıralı istek (yapılandırma,
gözlem bitmeden başlayamıyor).

**Doğruluk gerçekten arttı ve muhtemelen raporlanandan da yüksek:** "10
yanlış pozitif" olarak görünen ürünlerin (yoğurt, bira, reçel, jambon vb.)
çoğu muhtemelen GERÇEK ürünler — MVP-2'de elle çıkarılan ground truth,
düşük çözünürlüklü/bulanık kareler izlenerek oluşturulmuştu ve muhtemelen
eksikti; yüksek çözünürlük + detaylı gözlem bu videoda daha önce
görülemeyen ürünleri de yakaladı. Ground truth yeniden gözden geçirilmedi
— bu yüzden "yanlış pozitif" rakamı temkinli okunmalı.

**Karar (kullanıcı onayladı — gecikmeyi azalt):** Aşama 1'de
(`claude-sonnet-5`) `thinking: {type: "disabled"}` eklendi — Sonnet 5
`thinking` belirtilmezse varsayılan olarak adaptive (açık) çalışıyor ve
bu, ölçülen 58.2s'nin başlıca kaynağıydı. Sonuç: yanıt süresi 58.2s →
**42.5s**'ye düştü (~%27 azalma), maliyet $0.158 → **$0.144**'e düştü
(gözlem çıktı token'ı 3.293 → 1.915), doğruluk hâlâ %100 (11/11) —
thinking'in bu görev için gözle görülür bir doğruluk katkısı yoktu, sadece
gecikme/maliyet ekliyordu. 42.5s hâlâ MVP-2'nin 8.1s'sinden ~5 kat yavaş
(kaynağı: yüksek çözünürlük + iki sıralı istek + daha büyük görsel
payload'ı) — daha fazla hızlanma için UI'da ilerleme göstergesi eklemek
veya daha agresif optimizasyon (örn. çözünürlüğü/kare sayısını video
uzunluğuna göre dinamikleştirmek) ayrı bir görev olarak değerlendirilebilir.

Gemini'nin doğruluğu ölçümler arasında %82 → %73 → %100 arasında
değişti, ama Gemini'nin kodu hiçbir turda DEĞİŞTİRİLMEDİ (hâlâ tek
aşamalı, aynı prompt) — bu dalgalanma tamamen modelin çıktısındaki doğal
varyanstan kaynaklanıyor (aynı istek tekrar çalıştırılınca farklı sonuç),
tek fixture'lı küçük örneklemde beklenen bir durum; sağlayıcı kararını
etkilemiyor (Claude zaten kod değişikliğiyle kazanan).

---

**MVP-2 test sonucu (2026-07-04, aynı video, MVP-2 prompt+boyutlandırma
optimizasyonundan sonra, tahmini rakamlar):**

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Tahmini maliyet |
|---|---|---|---|---|
| Claude Sonnet 4.6 | %91 (10/11) | 4 | 8.1s | ~$0.05 |
| Gemini 2.5 Flash | %82 (9/11) | 2 | 17.6s | hesaplanmadı (fiyat girilmedi) |

Optimizasyon öncesi (ilk ham test, aynı video): sistem talimatı marka/yabancı
dil isimlerini engellemiyordu ve video kareleri 1568px sınırından
geçmiyordu — Claude %18, Gemini %0 doğruluk ölçülmüştü (görünüşte düşük
ama aslında çoğu ürün doğru bulunmuş, sadece "Arla Bio Halfvolle Melk" gibi
markalı/yabancı isimlerle dönmüştü, ground truth'taki jenerik Türkçe
isimlerle eşleşmedi).

Karar için elle ölçüm sağlayan bir eval seti var: `tests/vision-eval/`.
Kullanıcı `fixtures/` altına gerçek fotoğraf/video + elle girilmiş
ground-truth.json koyar; `npx tsx tests/vision-eval/run-eval.ts` her
fixture'ı hem Claude hem Gemini'den geçirip doğruluk oranı, yanlış pozitif
sayısı, yanıt süresi ve (MVP-3'ten itibaren) API `usage` alanından
hesaplanan GERÇEK token/maliyet raporunu (Claude'da aşama bazında dahil)
`tests/vision-eval/results/` altına tarihli bir `.md` dosyası olarak yazar
(bkz. `fixtures/README.md`, `services/vision/types.ts` — `UsageEvent`).
Video fixture'ları için ffmpeg kurulu olmalı (`brew install ffmpeg`) —
uygulamadaki gerçek kare çıkarımı `expo-video-thumbnails` ile yapılır,
script masaüstünde çalıştığı için ffmpeg'e ihtiyaç duyar.

## Çalışma kuralları

- Her sayfa ayrı görev olarak geliştirilir; sayfa bitince `npx expo start`
  ile test edilebilir durumda bırak.
- Commit mesajları Türkçe ve conventional format: `feat: envanter sayfası`,
  `fix: sepet rozet sayacı`.
- Yeni paket eklemeden önce mevcut bağımlılıklarla çözülebiliyor mu kontrol et.
- Mock veri yalnızca `__mocks__/` altında yaşar; production kodunda mock
  kalmışsa temizle.
