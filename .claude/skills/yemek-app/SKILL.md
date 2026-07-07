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
- **AI:** Gemini görsel üretimi (`gemini-3.1-flash-lite-image`) — tarif
  kartı/detay görselleri, bkz. `services/images/` ("Tarif görselleri"
  bölümü). Vision (envanter çıkarımı) hattından TAMAMEN bağımsızdır.
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
- **Ürün adı / marka ayrımı (MVP-8):** kart başlığında ürün adı büyük ve
  kalın (`Outfit_600SemiBold`, `text-base text-stone-900`); marka varsa
  altında küçük, gri, ikincil bir etiket olarak (`Outfit_400Regular`,
  `text-xs text-stone-400`). Marka adı ASLA ürün adıyla birleştirilip tek
  uzun başlık yapılmaz.
- **Kategori grupları + "Buzdolabım" dış kart (MVP-10):** ham 7 kategori
  (bkz. "Envanter ekranı" altında) görüntülemede 5 üst gruba birleştirilir
  (`CATEGORY_GROUPS`, `app/(tabs)/index.tsx`): **Süt & Peynir, Et &
  Şarküteri, Meyve & Sebze, İçecek & Sos, Diğer**. Tüm gruplar TEK bir
  "🧊 Buzdolabım" dış kartı (`rounded-2xl`, `shadow-sm`, `ring-stone-200`)
  içinde, aralarında ince `border-stone-100` ayraçlarla ayrılan iç
  bölümler olarak gösterilir (düz art arda kartlar DEĞİL, "dolap/raf"
  hissi). Grup başlıkları "chip" görünümünde: `bg-stone-100 rounded-full
  px-3 py-1`, `Outfit_600SemiBold`, `text-sm` — önceki (MVP-8) soluk
  `text-sm text-stone-500` başlıktan daha belirgin.
- **Kart ikonu yerine renkli şerit (MVP-10):** kart solunda tabak/çatal
  emoji'si YERİNE grup bazlı ince bir renkli şerit (`GROUP_STRIPE_COLORS`)
  — emerald-900/amber-500 paletinin ton varyasyonları (emerald-900,
  emerald-500, amber-500, amber-300, stone-300), yeni bir renk ailesi
  İCAT EDİLMEDİ. Confidence rozeti (`%92` gibi) ana kategorili listede
  ARTIK GÖSTERİLMİYOR (zaten `CONFIDENCE_THRESHOLD`'un üzerindeki ürünler
  gösteriliyor, rozet bilgi değeri taşımıyordu) — SADECE "emin olunamayan
  ürünler" modalında gösterilmeye devam ediyor.
- **⚠️ İki farklı kart render yolu var (MVP-10 mimari notu):** ana
  kategorili liste artık `components/inventory/InventoryRow.tsx`'i
  KULLANMIYOR — `app/(tabs)/index.tsx` içinde yerel tanımlı `ProductCard`
  (ikon yok, rozet yok, renkli şerit) kullanıyor. "Emin olunamayan
  ürünler" modalı ise HÂLÂ eski `InventoryList`/`InventoryRow`'u (ikon +
  confidence rozetiyle) kullanıyor — bilinçli bir ayrım (MVP-10 görevinin
  kapsamı SADECE `app/(tabs)/index.tsx`'in render katmanıyla
  sınırlandırılmıştı, `InventoryRow.tsx`'e dokunulmadı). Yani modal
  kartları ile ana liste kartları görsel olarak FARKLI — bu kasıtlı,
  birleştirme istenirse `InventoryRow.tsx`'in de kapsama alınması gerekir.
- **"Emin olunamayan ürünler" bildirimi (MVP-10):** artık soluk tek
  satırlık bir link değil, amber vurgu renginde ayrı bir uyarı kartı
  (`bg-amber-50`, `ring-amber-200`, `text-amber-900`, "⚠️ N ürün kontrol
  bekliyor" + `chevron-forward` ikonu) — "Buzdolabım" dış kartının
  DIŞINDA, listenin en üstünde.

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
  1568 → 2576, bkz. altta "MVP-3" notu). Bu akış DEĞİŞMEDİ, hâlâ altta
  anlatılan iki aşamalı JSON mimarisini kullanıyor.
- **Video, MVP-7'den itibaren sağlayıcıya göre AYRIŞIYOR** (bkz. altta
  "Video → envanter (native, MVP-7)"):
  - **Gemini** (varsayılan sağlayıcı): kare çıkarma YOK, video native
    olarak tek çağrıda gönderilir, iki aşamalı JSON mimarisi
    KULLANILMAZ — bkz. o bölüm.
  - **Claude:** video API'si kabul etmediği için DEĞİŞMEDİ — cihazda
    `expo-video-thumbnails` ile kare çıkarılır (saniyede 1 kare, en
    fazla 12 kare — MVP-3'te 8 → 12, bkz. `lib/media/extractVideoFrames.ts`),
    her kare aynı 2576px sınırından geçirilir, altta anlatılan iki
    aşamalı JSON mimarisi kullanılır. "Sahne bazlı" kare seçimi
    (`kamera hareketine göre`) `expo-video-thumbnails`'in zaman-bazlı
    API'siyle YAPILAMIYOR (içerik farkına bakan bir filtre sunmuyor) —
    bu yüzden uygulanmadı, sabit aralıklı örnekleme kullanılıyor. Bu
    kare-tabanlı akış, sağlayıcı `extractInventoryFromVideo` metodunu
    tanımlamadığında (`app/(tabs)/index.tsx`) genel geriye-dönük
    uyumluluk yolu olarak da kullanılır.

### Fotoğraf (ve Claude video) → envanter: iki aşamalı JSON mimarisi

**İki aşamalı mimari** (`services/vision/`, bkz. `VisionProvider` arayüzü;
paylaşılan Aşama 1 promptu `services/vision/prompt.ts`'te tanımlı). Kök
neden: tek-aşamalı sıkı JSON şeması modelin gözlem detayını kısıtlıyordu
(kullanıcı, kısıtlamasız/serbest bir promptla çok daha detaylı/doğru sonuç
alındığını doğruladı — bkz. altta MVP-3/MVP-4 notları).

1. **Aşama 1 — gözlem** (vision, yüksek çözünürlük, İKİ SAĞLAYICIDA DA
   AYNI): görselleri/kareleri ŞEMA DAYATMADAN, serbest metinle "gördüğün
   TÜM ürünleri madde madde anlat; marka, raf/çekmece konumu, miktar, emin
   olamadığın noktaları belirt" diye ister (`OBSERVATION_SYSTEM_PROMPT`).
   Düz metin döner, JSON değil. Claude: `claude-sonnet-5` (2576px'e kadar
   yüksek çözünürlük destekler, `thinking: {type:"disabled"}` ile — bkz.
   altta). Gemini: `gemini-2.5-flash` (`EXPO_PUBLIC_GEMINI_MODEL` ile
   değiştirilebilir).
2. **Aşama 2 — yapılandırma, MVP-6'dan itibaren SAĞLAYICIYA GÖRE FARKLI
   mimari** (bkz. altta "MVP-6" notu):
   - **Claude:** ayrı/bağımsız bir çağrı, katı JSON şeması
     (`STRUCTURING_SYSTEM_PROMPT`, `claude-haiku-4-5`) — "hiçbir ürünü
     atlama" talimatıyla Aşama 1 metnini
     `[{ name, qty, unit, brand, location, match_confidence }]` şemasına
     çevirir. Bu mimari DEĞİŞMEDİ (MVP-6, sadece Gemini'yi değiştirdi).
   - **Gemini:** ayrı bir çağrı DEĞİL — Aşama 1'in AYNI konuşmasının
     devamı (`contents` dizisinde ek `user`/`model` turları, bkz.
     `runInventoryConversation` in `gemini-provider.ts`). İkinci tur
     (`TABULATION_TURN_PROMPT`) kullanıcının kendi AI Studio testindeki
     basit talimata yakın, kısa ve az kısıtlayıcı: "envanteri bölüm/
     konuma göre gruplanmış bir tablo olarak göster, her satırda ad/
     miktar/0-100 net-olma yüzdesi ver" — bizim eski "her ürünü ayrı
     satır yap" gibi zorlayıcı kurallarımız YOK, Gemini'nin kendi
     tablolaştırma sezgisine güveniliyor. Aynı `gemini-2.5-flash` modeli
     kullanılır (ayrı bir yapılandırma modeline gerek yok, Gemini API
     durumsuz olduğu için ikinci tur ucuz — sadece metin girdisi).
   İkisinde de `"name"` jenerik Türkçe; marka ayrı `"brand"` alanına
   konur (bkz. `types/inventory.ts` — `InventoryItem.brand`, opsiyonel).
   Prompt'lardaki `"location"` alanı (MVP-5'te bölüm bazlı gruplama için
   eklenmişti) MVP-12'den itibaren `InventoryItem`'dan KALDIRILDI —
   prompt'lar hâlâ isteyebilir ama `parseInventoryItems` bu alanı yok
   sayar (iki aşamalı akışın davranışını değiştirmemek için prompt'lara
   dokunulmadı, sadece alan saklanmıyor). `"match_confidence"`
   0-100 arası tam sayı (MVP-5'te ikili `"high"|"low"`'dan bu şemaya
   geçildi — bkz. altta "Confidence şemasının yüzdeselleştirilmesi").

Aşama 2'nin çıktısı her iki sağlayıcıda da aynı `parseInventoryItems` ile
ayrıştırılır (opsiyonel `brand` alanı ve 0-100 aralık
kontrolünden geçen `match_confidence` dahil) — ikisi de aynı
`InventoryItem[]` şeklini üretir. Bu şema `"category"` ÜRETMEZ (iki aşamalı
JSON akışının şeması kategori sormuyor) — `app/(tabs)/index.tsx` bu akıştan
gelen ürünleri kategorisiz kabul edip "Diğer" bölümü altında gösterir (bkz.
altta "Envanter ekranı: kategori + eşik davranışı (MVP-8)"). `category`
sadece video → envanter akışının (MVP-12, responseSchema) doğrulayıcısı
(`parseVideoInventoryItems`, `services/vision/prompt.ts`) doldurur. `EXPO_PUBLIC_VISION_PROVIDER` (`claude` | `gemini`) ile kod
değiştirmeden sağlayıcı geçişi yapılır. Yanıt parse edilemezse kullanıcıya
"tekrar dene" durumu göster, asla boş envanter yazma. Claude sistem
talimatını `cache_control: {"type": "ephemeral"}` ile önbellekler; Gemini
2.5'in varsayılan "implicit caching"i aynı işlevi görür.

#### Envanter ekranı: kategori + eşik davranışı (MVP-8)

`app/(tabs)/index.tsx`'teki `CONFIDENCE_THRESHOLD` sabiti **50 → 90'a
çıkarıldı** — kullanıcı belirsiz ürünlerin ana listede yer kaplamasını
istemedi, eşik yükseltilerek daha az ürün "kesin" sayılıyor. Davranış:

- **`confidence >= 90` (veya `confidence` yok):** ürün, `item.category`'nin
  eşlendiği GÖRÜNTÜLEME grubuna (bkz. altta MVP-10 — `CATEGORY_GROUPS`,
  5 üst grup) göre "Buzdolabım" dış kartı içindeki bir bölümde `ProductCard`
  ile gösterilir. `category` alanı yoksa (iki aşamalı JSON akışı) "Diğer"
  grubuna düşer.
- **`confidence < 90`:** ürün kategorili listede HİÇBİR YER KAPLAMAZ.
  Bunun yerine listenin en üstünde belirgin bir amber uyarı kartı
  gösterilir ("⚠️ N ürün kontrol bekliyor", bkz. altta MVP-10). Tıklanınca
  bir `Modal` (pageSheet) açılır, içinde bu ürünler mevcut
  `InventoryList`/`InventoryRow` + "Envantere ekle" akışıyla tam kart
  olarak gösterilir — silinmiş değildir, "Envantere ekle" ile ana listeye
  taşınır (bu, ürünün `confidence` değerini eşiğin üzerine çıkarır).

> **MVP-10 (2026-07-05) — kategori grupları + kart redesign:** Kullanıcı
> ham 7 kategorinin çok ince taneli durduğunu, kart üzerindeki tabak/çatal
> emoji'sinin anlamsız/tekrarlı olduğunu ve "emin olunamayan ürünler"
> bildiriminin çok pasif kaldığını belirtti — SADECE görsel bir redesign
> istendi (yeni API çağrısı yok, `services/vision/` DEĞİŞMEDİ, mevcut
> cache'lenmiş `InventoryItem[]` üzerinde çalışır). Görev kapsamı SADECE
> `app/(tabs)/index.tsx`'in render katmanıyla sınırlandırıldığı için
> `components/inventory/InventoryRow.tsx`'e BİLİNÇLİ OLARAK dokunulmadı —
> bu yüzden ana liste artık `InventoryRow`'u değil yerel `ProductCard`'ı
> kullanıyor, "emin olunamayan ürünler" modalı ise eski `InventoryRow`'da
> kaldı (iki farklı kart görünümü şu an bilinçli olarak bir arada var,
> bkz. "Tasarım sistemi" — "İki farklı kart render yolu" notu). Detaylar
> için bkz. "Tasarım sistemi" — "Kategori grupları", "Kart ikonu yerine
> renkli şerit", "Emin olunamayan ürünler bildirimi" maddeleri.

### Video → envanter (native, MVP-7; MVP-12'de structured output)

MVP-7 kararı: video girdisi için TÜM işi (gözlem + yapılandırma AYRI
aşamalar değil) tek bir Gemini çağrısına devret. Bu mimari
SADECE Gemini'de var (`extractInventoryFromVideo`, `VisionProvider`
arayüzünde opsiyonel — bkz. `services/vision/types.ts`); Claude bu metodu
tanımlamıyor, video seçildiğinde `app/(tabs)/index.tsx` bu metodun
varlığını kontrol eder, yoksa yukarıdaki eski kare-tabanlı akışa döner.

**MVP-12 — markdown tablodan native structured output'a geçiş:** Kullanıcı
aynı videodan her analizde FARKLI sonuçlar alındığını bildirdi. Salt-okunur
inceleme raporunun bulduğu kök nedenler: (1) `temperature` hiç
ayarlanmamıştı (`gemini-2.5-pro` varsayılanı 1.0 — tespit görevi için çok
yüksek), (2) serbest markdown çıktı + kırılgan `parseInventoryTable`
kombinasyonu satırları SESSİZCE düşürüyordu (sadece ilk `|`'lu blok
okunuyor, `**%90**` gibi formatlar confidence regex'ine takılıyor, dar
birim regex'i, 7'den az hücreli satırlar atlanıyor), (3) store'daki
birikimli `addItems` her analizde miktarları katlıyordu (bkz. altta "Store
modları"). Çözüm: MVP-7/8'in markdown tablo akışı, Gemini'nin native
structured output'una (`responseSchema`) taşındı — şema yapıyı API
tarafında garanti ettiği için parser kırılganlığı sınıfça ortadan kalktı.

- **Prompt** (`VIDEO_INVENTORY_PROMPT`, `services/vision/prompt.ts`):
  ÇOK kısa — buzdolabı videosunu sistematik analiz et (her raf/kapı
  gözü/çekmece), TÜM ürünleri çıkar; `name` SPESİFİK Türkçe ürün adı,
  sıfat tamlaması tercih edilir ("Küflü Peynir", "Cherry Domates",
  "Kırmızı Biber"; tekli ürünler sade: "Süt", "Marul") ve marka adı
  `name`'e DEĞİL `brand`'e yazılır; kategori SADECE şemadaki sabit
  listeden; `confidence` görsel netlik/etiket okunabilirliğine göre.
  Eski `VIDEO_TABLE_PROMPT`'un markdown tablo, sütun, placeholder satırı,
  konum ve gerekçe talimatlarının TAMAMI kaldırıldı — yapıyı şema garanti
  ediyor, prompt sadece görevi ve isimlendirme kurallarını anlatıyor
  (çıktı tokeni tasarrufu da cabası).
- **Çağrı** (`extractInventoryFromVideoNative`, `gemini-provider.ts`):
  TEK istek, `systemInstruction` KULLANILMAZ (talimat tek `user` mesajının
  `text` parçası). `config`: `temperature: 0.2`
  (`VIDEO_INVENTORY_TEMPERATURE`), `responseMimeType: "application/json"`,
  `responseSchema: VIDEO_INVENTORY_RESPONSE_SCHEMA` — şu yapının array'i:
  `{ name: string, brand: string|null, qty: number, unit: enum(12 birim,
  bkz. types/inventory.ts INVENTORY_UNITS), category: enum(7 kategori,
  INVENTORY_CATEGORIES), reasoning: string, confidence: integer 0-100 }`.
  `reasoning` MVP-13'te eklendi (bkz. altta "Confidence kalibrasyon
  düzeltmesi") — SADECE modelin kendi kalibrasyonu için, `InventoryItem`'a
  YAZILMAZ. `propertyOrdering` `reasoning`i `confidence`'tan HEMEN ÖNCEye
  koyar (`gemini-provider.ts`) — Gemini yapılandırılmış çıktıda alanları bu
  sırada üretir, yani model skoru vermeden önce gerekçesini yazmak zorunda
  kalır (chain-of-thought benzeri etki) — bu sıra DEĞİŞTİRİLMEMELİ. KALDIRILAN alanlar
  (MVP-12): `location`, `detail`, `note` — artık üretilmiyor ve
  `InventoryItem`'dan da silindi. Birim enum'u genişletildi: eski akışta
  "adet"e eşlenen paket/kutu/kavanoz/dilim + şişe/poşet artık birinci
  sınıf birim (`detail`'e gerek kalmadı). Model: `gemini-2.5-pro` (aynı
  `EXPO_PUBLIC_GEMINI_MODEL` ile override). Video ~18MB'ı geçerse otomatik
  Gemini Files API'sine yüklenir (`uploadVideoToFilesApi`) — bu kısım
  DEĞİŞMEDİ. `onUsage` tek bir `stage: "video-inventory"` event'iyle
  çağrılır (eski adı "video-table" idi).
- **Doğrulama** (`parseVideoInventoryItems`, `services/vision/prompt.ts`):
  markdown parser yerine basit bir JSON doğrulayıcı — alan tipleri, enum
  ve 0-100 aralık kontrolü. Geçersiz öğeleri düşürmek yerine mümkünse
  DÜZELTİR: tanınmayan kategori → "Diğer", aralık dışı confidence →
  0-100'e kırpılır, geçersiz qty/unit → `1 adet`; sadece isimsiz öğe
  düşürülür. Hiç geçerli öğe yoksa `InventoryVisionError` ("tekrar dene").
- **mimeType (MVP-12):** `app/(tabs)/index.tsx` artık sabit `'video/mp4'`
  GÖNDERMİYOR — `asset.mimeType` varsa o, yoksa uzantıdan tahmin
  (`resolveVideoMimeType`; .MOV → `video/quicktime`), bilinmiyorsa
  `video/mp4` fallback.
- **Eski markdown tablo akışı (geçmiş not):**
  `services/vision/markdown-table.ts` artık canlı akışta KULLANILMIYOR —
  başında `@deprecated` notuyla duruyor (git geçmişi/referans için), bir
  sonraki temizlikte kaldırılacak. `VIDEO_TABLE_PROMPT` silindi. MVP-7/8
  dönemine ait tablo sütunları, placeholder satırı ve `parseInventoryTable`
  detayları için o dosyaya ve git geçmişine bakın.

#### Store modları: tam tarama vs ekleme (MVP-12)

`store/inventoryStore.ts` iki mod sunar; hangisinin kullanılacağına
`app/(tabs)/index.tsx` analiz akışında karar verir:

- **Video analizi = TAM TARAMA (`replaceItems`):** analiz başarıyla
  tamamlanınca mevcut envanter yeni listeyle DEĞİŞTİRİLİR — miktar toplama
  yok. Kök neden: video buzdolabının o anki TAM halini gösterir; eski
  birikimli `addItems` davranışı aynı videonun ikinci analizinde miktarları
  katlıyordu (2 süt → 4 süt). Kullanıcının elle eklediği/düzenlediği
  kayıtlar da yenilenir — BİLİNÇLİ olarak basit tutuldu, karmaşık
  birleştirme mantığı KURULMADI. Değiştirmeden önce `Alert` ile onay
  istenir ("Mevcut envanter yeni taramayla değiştirilecek, onaylıyor
  musun?") — onay, 40+ saniyelik analiz boşa gitmesin diye API çağrısından
  ÖNCE sorulur; envanter zaten boşsa sorulmaz.
- **Fiş/fotoğraf akışı = EKLEME (`addItems`):** mevcut davranış korundu —
  aynı ad+birim varsa miktarlar toplanır, yoksa yeni kayıt eklenir.

> **MVP-12 varyans testi (2026-07-07, `IMG_8425.MOV` fixture, gerçek API,
> 3 ardışık koşu):** 22 / 19 / 23 ürün; süreler 44.2 / 43.2 / 45.8s;
> tokenlar 7.006 girdi + 1.162–1.460 çıktı (eski markdown akışının
> ölçülen 7.389–7.659 girdisinden hafif düşük — konum/gerekçe sütunlarının
> kaldırılması çıktıyı da kısalttı). Üç koşuda da yanıt şemaya %100 uydu,
> doğrulayıcı HİÇBİR öğeyi düşürmedi/düzeltmedi (0-2ms). Çekirdek ~17 ürün
> (süt, yumurta, jambonlar, peynirler, domates, avokado, mayonez...) üç
> koşuda da mevcut; kalan fark iki kaynaktan: (1) İSİMLENDİRME varyansı —
> aynı ürün "Dilim/Dilimli/Dilimlenmiş Peynir", "Sirke" vs "Balzamik
> Sirke", "Süt" vs "Yarım Yağlı Süt" olarak dönebiliyor, (2) düşük
> confidence'lı (%50-80) kenar ürünler (humus, kıyma, su, hellim, margarin,
> pancar) koşudan koşuya girip çıkıyor. Bu kalan varyans temperature
> 0.2'yle bile süren doğal model varyansı — ama artık YAPISAL kayıp
> (parser'ın sessizce satır düşürmesi) yok ve `CONFIDENCE_THRESHOLD=90`
> zaten bu oynak kenar ürünleri ana liste yerine "kontrol bekliyor"
> modalına yönlendiriyor. İsimlendirme tutarlılığı için ileride prompt'a
> az sayıda örnekli sabitleme (few-shot) denenebilir — ayrı görev.

> **MVP-13 (2026-07-07) — confidence kalibrasyon düzeltmesi:** MVP-12
> sonrası kullanıcı, daha önce %100 alan net etiketli ürünlerin (örn.
> Milner peynir, Dulano Coppa, Jumbo jambon) responseSchema'ya geçtikten
> sonra %90-95'te "tavan yaptığını" ve %90 eşiğinin altına düşüp yanlışlıkla
> "kontrol bekliyor" modalına gittiğini bildirdi. Çözüm: şemaya SADECE
> modelin kendi kalibrasyonu için bir `reasoning` alanı eklendi (bkz.
> yukarıda "Çağrı" maddesi — `propertyOrdering` ile `confidence`'tan HEMEN
> ÖNCE üretilir, UI'da gösterilmez/`InventoryItem`'a yazılmaz,
> `parseVideoInventoryItems` okuyup `console.debug` ile atar) ve prompt'a
> somut bir kalibrasyon rehberi eklendi (`VIDEO_INVENTORY_PROMPT`):
> 95-100 = etiket/ambalaj net okunuyor VEYA ürün şekli tartışmasız; 80-94 =
> tür belli ama detay/marka net değil; 50-79 = form tahmin edilebilir ama
> emin değil; <50 = sadece tahmin. **Sonuç (tek koşu, `IMG_8425.MOV`):**
> net markalı ürünler artık tavana ulaşıyor (Milner peynir %90→%100, Dulano
> Coppa %95→%100, Jumbo jambon %95→%100, Mozzarella %70-80→%95); 90 eşiğinin
> altında kalan ürün oranı 22 üründe 12 (%55) → 23 üründe 6'ya (%26) düştü.
> Kalan 6 düşük-skorlu ürünün (salata sosu, balzamik sirke, tereyağı, salam,
> gazlı içecek, siyah biber) `reasoning` metinleri gerçek görsel belirsizlik
> gösteriyor (örn. tereyağı için *"tipik bir tereyağı VEYA margarin
> ambalajı"*) — yapay bir kalibrasyon sorunu değil, model dürüstçe emin
> olmadığını söylüyor. **Karar (kullanıcı onayladı):** `CONFIDENCE_THRESHOLD`
> 90'da KALDI, eşik değiştirilmedi — kalan belirsiz ürünlerin modalde onay
> istemesi doğru davranış kabul edildi. Token maliyeti arttı (~1.2-1.5K →
> 2.190 çıktı token, `reasoning` cümleleri yüzünden) ama tek seferlik video
> analizi için kabul edilebilir görüldü.

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

> **MVP-5 confidence şemasının yüzdeselleştirilmesi:** Kullanıcı, kendi
> manuel Gemini (AI Studio) testinde uygulamadan daha detaylı envanter
> çıkarımı aldığını gözlemledi. Kök neden: (a) yapılandırma şeması
> kullanıcının kendi akışı kadar esnek değildi (konum/bölüm bilgisi
> alınmıyordu), (b) `confidence` ikili (`high`/`low`) olduğu için ürün
> bazlı güvenilirlik ayrımı yapılamıyordu. Çözüm: `STRUCTURING_SYSTEM_PROMPT`
> şemasına opsiyonel `"location"` alanı ve 0-100 arası `"match_confidence"`
> eklendi (yukarıdaki "Aşama 2" maddesine bakın); UI'da `CONFIDENCE_THRESHOLD`
> (varsayılan 50) altındaki ürünler ayrı bir bölümde gösteriliyor. Eski
> `confidence: low` → "onayla" rozeti davranışı kaldırıldı.

> **MVP-6 Gemini Aşama 2'yi kendi şema mühendisliğimizden Gemini'nin doğal
> tablolaştırma sezgisine bıraktık:** Kullanıcı kendi manuel Gemini (AI
> Studio) testinde HİÇBİR bizim tarzı mühendislik yapmadan (gruplama
> yasağı, confidence hesaplama talimatı vb. yok), sadece iki doğal mesajla
> ("ürünleri tanımlayıp envanterini çıkar" → "bunu tablo olarak göster,
> bölüm bölüm, sadece gerekli bilgiler") çok iyi sonuç aldığını gözlemledi.
> Karar: bu basit iki-mesajlık akışı birebir taklit etmek için Gemini'nin
> Aşama 1 (gözlem) ve Aşama 2 (yapılandırma) çağrılarını AYRI/BAĞIMSIZ
> istekler olmaktan çıkarıp `contents` dizisinde `user`/`model` turları
> olan TEK bir konuşmaya birleştirdik (`runInventoryConversation`,
> `gemini-provider.ts`) ve Aşama 2 talimatını (`TABULATION_TURN_PROMPT`,
> `prompt.ts`) kullanıcının kendi promptuna yakın, kısa ve az kısıtlayıcı
> hale getirdik — eski "aşırı gruplama yasağı" paragrafları kaldırıldı,
> Gemini'nin kendi tablolaştırma/gruplama sezgisine güveniliyor. Sorun
> çıkarsa gerçek veriyle (eval sonuçlarıyla) düzeltilecek — önden aşırı
> kısıtlama yapılmadı. Claude'un mimarisi DEĞİŞMEDİ (hâlâ ayrı çağrı +
> katı şema, `STRUCTURING_SYSTEM_PROMPT`) — Claude zaten A/B için pasif
> tutuluyor, öncelik Gemini'de.

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

> **MVP-8 kategori + marka ayrımı + eşik yükseltme:** Kullanıcı üç UI/veri
> iyileştirmesi istedi: (1) ürünleri kategoriye göre grupla, (2) doğruluk
> eşiğini yükselt (50 → 90), belirsiz ürünleri minimal göster, (3) genel
> ürün adını markadan görsel olarak ayır. Kapsam SADECE `services/vision/`,
> `app/(tabs)/index.tsx`, `types/inventory.ts` olarak verildi, ama madde
> (3)'ün kart görünümü değişikliği (`components/inventory/InventoryRow.tsx`)
> bu dosyalardan hiçbirinde yaşamıyor — kullanıcıya soruldu, kapsam bu tek
> dosyayı da kapsayacak şekilde genişletildi (bkz. `InventoryRow.tsx` —
> ad büyük/kalın başlık, marka küçük/gri ikincil etiket). `VIDEO_TABLE_PROMPT`
> 5 sütundan 7 sütuna çıktı (Marka + Kategori eklendi, bkz. yukarıda),
> `parseInventoryTable` buna göre güncellendi, `InventoryItem.category`
> eklendi (opsiyonel — iki aşamalı JSON akışı bu alanı üretmiyor).

### Envanter → tarif önerisi

**Bu akış SADECE Claude API kullanır** (`claude-sonnet-4-6`, `lib/claude/`) —
vision tarafının Claude/Gemini karşılaştırma mimarisiyle (bkz. yukarıda
"Mimari" ve "Sağlayıcı karşılaştırma notları") HİÇ ilgisi yok, ortak bir
sağlayıcı seçim mekanizması (`VISION_PROVIDER` benzeri) YOK — iki özellik
birbirinden bağımsız, sabit birer sağlayıcıya bağlı (tarif üretimi hep
Claude, envanter çıkarımı hep Gemini/Claude karşılaştırması).

Girdi: envanter listesi (`{name, qty, unit}`'e sadeleştirilmiş). Çıktı:
**TAM 9 tarif, kademeli 3 katman** (MVP-11): 3 tarif `match_pct = 100`
(SADECE envanter + temel kiler malzemeleri: tuz, karabiber, su, sıvı yağ),
3 tarif `match_pct 75-99` (1-2 eksik malzeme), 3 tarif `match_pct 50-74`
(birkaç eksik malzeme). Birleşik `Recipe` şeması (`types/recipe.ts`):
```
{ name, emoji, kcal, servings, time_min,
  difficulty: "Kolay" | "Orta" | "Zor",
  macros: {protein, karb, yag}, match_pct,
  ingredients: [{ name, in_inventory: boolean }],
  missing_count, steps: string[], chef_tip, image_prompt_en? }
```
`match_pct` = kiler malzemeleri (tuz, karabiber, su, sıvı yağ) hariç
tutularak hesaplanan, envanterde bulunan malzeme oranı. `difficulty`
gerçekçi olmalı (çoğu ev yemeği Kolay/Orta, Zor nadiren). `chef_tip` =
tarife özel kısa bir şef önerisi.

**`ingredients` şeması (MVP-11'de `string[]`'ten değişti):** her malzeme
`{ name, in_inventory }` objesidir — `in_inventory` işaretlemesini MODEL
yapar (sistem talimatı: "envanter listesine göre işaretle; temel kiler
malzemelerini in_inventory: true say"). `missing_count` = `in_inventory:
false` malzeme sayısı; client tarafında `toRecipe` bu sayıyı işaretlerden
YENİDEN HESAPLAR (model sayıyla işaretler çelişirse işaretler kazanır —
rozet ile detay listesi aynı kaynaktan beslensin diye). `image_prompt_en`
görsel üretimi içindir (bkz. "Tarif görselleri"): tool şemasında zorunlu
(Claude tarif üretirken doldurur, ekstra LLM çağrısı YOK) ama TS tipinde
opsiyonel (eski cache'lerle uyum).

**UI (app/(tabs)/recipes.tsx, MVP-11):** liste iki bölüm halinde —
"Hemen Yapabilirsin" (`match_pct = 100`, üstte, emerald-900 chip başlık)
ve "Küçük Bir Alışverişle" (kalan 6 tarif, stone-100 chip başlık; MVP-10
grup başlığı chip stiliyle tutarlı). `match_pct < 100` kartlarda amber-500
"N eksik" rozeti (`missing_count`) gösterilir. Tarif detayında
`in_inventory: false` malzemelerin yanında amber "eksik" mikro-rozeti +
sepet ikonu vardır; `in_inventory: true` olanlar sade kalır (tik ikonu
YOK — gürültü olur, bilinçli karar).

**Tarif önbelleği (MVP-11):** `store/recipeStore.ts` zustand `persist` ile
AsyncStorage'a yazılır (`yemek-app-recipes`) ve tariflerin hangi envanter
için üretildiği `inventoryFingerprint` (sadeleştirilmiş + sıralanmış
`{name, qty, unit}` listesinin JSON'u) olarak saklanır. Envanter
DEĞİŞMEDİYSE (parmak izi aynıysa) 9 tarif yeniden ÜRETİLMEZ — ekrandaki
üret/yenile aksiyonları API'ye gitmeden mevcut listeyi kullanır.

### Tarif görselleri (AI görsel üretimi, MVP-11)

`services/images/recipe-image.ts` — **`services/vision/`'dan TAMAMEN
bağımsız** bir modül: envanter çıkarım hattıyla ortak kod/sağlayıcı seçim
mekanizması YOKTUR, yalnızca aynı `EXPO_PUBLIC_GOOGLE_API_KEY` anahtarını
kullanır. Vision'a dokunmadan değiştirilebilir.

- **Model:** `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) —
  metin/vision modelleri görsel ÜRETEMEZ, görsel üretim ayrı bir model
  ailesidir; Lite, güncel görsel üretim modellerinin en hızlısı/ucuzu
  (ölçüldü: ~3s, ~$0.034/görsel civarı). `EXPO_PUBLIC_GEMINI_IMAGE_MODEL`
  ile değiştirilebilir. Çağrı: `generateContent` + `config.imageConfig.
  aspectRatio: "4:3"`, yanıt `inlineData` (base64 JPEG) olarak gelir.
- **Prompt şablonu** (kullanıcının test edip beğendiği format, İngilizce):
  `"Appetizing {dish description}. {plating cümlesi}. Clean food
  photography, bright studio lighting, white background, simple, high
  contrast, mobile app banner, 4:3 aspect ratio."` — dish description
  Claude'un tarifle birlikte doldurduğu `image_prompt_en`'den gelir
  (AYRI bir LLM çağrısı YAPILMAZ); alan yoksa (eski cache) tarif adı +
  malzeme özetinden basit birleştirme kullanılır.
- **Lazy + sıralı kuyruk (ZORUNLU maliyet kuralı):** liste render olunca
  9 görsel birden İSTENMEZ. Kartlar mount oldukça `enqueueRecipeImage`
  ile modül seviyesindeki kuyruğa girer; kuyruk istekleri SIRAYLA (aynı
  anda tek API çağrısı) işler, görsel hazır olana kadar kartta mevcut
  emoji gösterilir (`useRecipeImage` hook'u, null → emoji).
- **Cache (ZORUNLU):** üretilen orijinal + thumbnail, FileSystem cache'ine
  (`Paths.cache/recipe-images/`) TARİF ADI anahtarıyla yazılır
  (slug + hash). Aynı tarif adı için görsel bir daha ÜRETİLMEZ — envanter
  değişse bile ad aynıysa cache'ten gelir. Cache kontrolü senkron
  (`File.exists`), karar için API'ye gidilmez.
- **Thumbnail:** listede `expo-image-manipulator` ile 320px'e küçültülmüş
  kopya, detay ekranında (`RecipeHeroImage`) orijinal gösterilir. Thumbnail
  üretimi NON-FATAL: başarısız olursa kartta da orijinal kullanılır.
- **Dosya yazımı `write(base64, {encoding:'base64'})` KULLANMAZ** — bu
  seçeneğin native desteği expo-file-system 19.0.16'da eklendi ve Expo
  Go'nun gömülü native modülü node_modules'taki JS sürümünden BAĞIMSIZ
  (daha eski) olabilir; ilk sürümde görsellerin telefonda hiç görünmemesinin
  kök nedeni buydu (MVP-9'daki "masaüstünde çalıştı, cihazda çöktü"
  dersinin üçüncü örneği — hata, hook'taki sessiz catch yüzünden görünmezdi).
  Bunun yerine base64 JS'te çözülüp `Uint8Array` overload'ıyla yazılır
  (yeni FS API'sinin ilk gününden beri var, sürüm farkından etkilenmez).
- **Placeholder/layout:** görsel alanı ve placeholder BİREBİR aynı boyutta —
  kartta 80px kare (`rounded-xl`), detayda tam genişlik 4:3 (`rounded-2xl`);
  placeholder emerald-50 zemin + ortada büyük emoji
  (`RecipeImagePlaceholder`), üretim sürerken hafif opacity pulse'ı oynar
  (spinner YOK). Görsel gelince kart boyutu zıplamaz.
- Üretim başarısız olursa placeholder'da kalınır ve tam hata mesajı
  `[recipe-image]` etiketiyle console'a yazılır (kuyruk her aşamayı loglar:
  kuyruğa ekleme, üretim başlangıcı, API süresi/boyutu, dosya yazımları,
  cache HIT "API çağrısı yok"); kart yeniden mount olduğunda tekrar denenir.

**Native structured output (Claude tool-use ile), markdown/JSON.parse YOK:**
Gemini'nin `responseMimeType`/`responseSchema`'sının Claude'daki karşılığı
zorunlu tool-use'dur — `lib/claude/generateRecipes.ts` istekte tek bir
`submit_recipes` aracı tanımlar (`input_schema`: yukarıdaki şemanın array
hali) ve `tool_choice: {type: "tool", name: "submit_recipes"}` ile modeli
bu aracı çağırmaya zorlar (bkz. `lib/claude/client.ts` —
`callClaudeForToolInput`). Yanıt `tool_use` bloğunun `input` alanından
doğrudan bir JS objesi olarak gelir — eski markdown-fence temizleme ve
JSON.parse yeniden deneme mantığı tamamen kaldırıldı, sadece minimal bir
alan/tip kontrolü (`toRecipe`) kaldı. Karar nedeni: tutarlılık (şema
zorunlu tool ile garanti edilir) ve markdown-parse riskinin ortadan
kalkması — Gemini'nin native JSON şema kısıtlı üretimiyle aynı prensip,
Claude'un API yüzeyine uyarlanmış hali.

Sistem talimatı `cache_control: {"type": "ephemeral"}` ile önbelleklenir
(`system` bir blok dizisi olarak gönderilir, bkz. `ClaudeSystemBlock`).

### Tarif chat'i
Her istek şunları içerir: tarifin tamamı + o tarife ait geçmiş mesajlar
(`recipe_chats` tablosundan). Sistem talimatı: "Türkçe konuşan bir şefsin,
yalnızca bu tarif bağlamında yanıt ver, tarifte değişiklik önerirken
miktarları da güncelle."

## Sağlayıcı karşılaştırma notları

> **Native-video (MVP-7) maliyet karşılaştırması — ÖLÇÜLMEDİ:** Bu bölümdeki
> MVP-2/3/4 rakamlarının hepsi `tests/vision-eval/run-eval.ts`'in her iki
> sağlayıcı için de çağırdığı **iki aşamalı `extractInventory`** akışına ait
> (video fixture'ları bile bu script'te ffmpeg ile karelere ayrılıp iki
> aşamalı akıştan geçiyor, bkz. `extractFramesFromVideo`). Script,
> `extractInventoryFromVideoNative`'i (MVP-7 tek-çağrı video→tablo akışı,
> `stage: "video-table"`) HİÇ ÇAĞIRMIYOR — bu yüzden `tests/vision-eval/
> results/` altında `video-table` aşamalı bir rapor yok ve bu akışın gerçek
> token/maliyet rakamı henüz kaydedilmedi. Rakam uydurmak yerine bu boşluk
> burada açıkça belirtiliyor: karşılaştırma yapılabilmesi için `run-eval.ts`'e
> native-video yolunu da çağıran bir kol eklenmesi gerekiyor (ayrı bir görev
> olarak değerlendirilebilir — mevcut script sadece `provider.extractInventory`
> çağırıyor, `provider.extractInventoryFromVideo` opsiyonel metodunu hiç
> kullanmıyor). Yön tahmini: native akış TEK çağrı (gözlem+yapılandırma
> ayrımı yok) olduğu için toplam token/gecikme muhtemelen iki aşamalı
> gemini akışından daha düşük olacaktır, ama bu DOĞRULANMADI — `gemini-2.5-pro`
> (video-table'ın varsayılan modeli) `gemini-2.5-flash`'tan (iki aşamalı
> akışın varsayılanı) pahalı olduğu için bu tahmin ters de çıkabilir.

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

## Performans notları

**MVP-9 (2026-07-05) — native-video (MVP-7) gecikme profili, gerçek API
çağrılarıyla ölçüldü** (aynı `tests/vision-eval/fixtures/IMG_8425.MOV`
fixture'ı — 24.5MB, 23s, 1920×1080 HEVC; gerçek `EXPO_PUBLIC_GOOGLE_API_KEY`
ile, masaüstünde geçici bir Node/tsx script'iyle — `run-eval.ts` bu akışı
çağırmıyor, bkz. yukarıdaki "Native-video (MVP-7) maliyet karşılaştırması"
notu). Her ölçüm ayrı bir gerçek API çağrısı, rakamlar tahmini değil.

**Ölçüm sonucu — aşama dökümü** (optimizasyon sonrası, `gemini-provider.ts`
içindeki `logStage` console.log'larından, aynı fixture, `gemini-2.5-pro`):

| Aşama | Süre (4 gerçek çalıştırma aralığı) | Not |
|---|---|---|
| (a) video sıkıştırma/işleme | yok (0ms) | Cihazda hiçbir sıkıştırma/küçültme adımı YOK — video olduğu gibi gönderiliyor (bkz. altta "720p" bulgusu) |
| (b) base64'e çevirme (client) | ~10ms (masaüstünde) | MVP-9 sonrası SADECE inline (<18MB) videolarda çalışıyor; Files API yoluna giden büyük videolarda ARTIK HİÇ ÇALIŞMIYOR (bkz. altta) |
| (c) Files API yükleme + işleme bekleme | ~12–14s (3 ölçüm) | Sabit maliyet, dosya boyutuyla orantılı büyür |
| (c) Gemini isteği (model çıkarımı) | ~14.5–35s (4 ölçüm, BÜYÜK varyans) | Toplam sürenin en büyük ve en değişken parçası — sunucu/model tarafı, client kodundan etkilenmiyor |
| (d) markdown parse | ~1–3ms | İhmal edilebilir |
| (d) state güncelleme (`addItems`) | ölçülmedi (RN gerektirir) | Zustand `set` + küçük dizi (~15-20 öğe) için mikrosaniyeler mertebesinde beklenir, cihazda ayrıca ölçülmedi |
| **TOPLAM** | **~35–47s** (4 gerçek çalıştırma) | Aynı kod/prompt/model ile bile geniş varyans — Gemini'nin video anlama gecikmesi doğası gereği değişken (bkz. SKILL.md'deki MVP-3 notundaki benzer varyans gözlemi) |

**Ana bulgu: gecikmenin ~%70-95'i ağ/model tarafında (Files API + model
çıkarımı), client tarafındaki kod (encode/parse/state) toplamın %1'inden
az.** Bu yüzden client-side mikro-optimizasyonların (base64/parse hızı)
wall-clock süreye etkisi ölçülemeyecek kadar küçük; asıl kaldıraç video
boyutu/süresi ve model seçimi.

**Uygulanan optimizasyonlar** (hepsi çıktı şemasını/kaliteyi DEĞİŞTİRMEDİ):

1. ~~Çift base64 dönüşümü kaldırıldı~~ — **DENENDİ, GERÇEK CİHAZDA ÇÖKTÜ,
   GERİ ALINDI.** İlk versiyon `expo-file-system`'in `File`'ını (Blob'u
   implemente ediyor, `.size` senkron) `ai.files.upload`'a DOĞRUDAN
   geçiriyordu — masaüstü Node script'inde (bu bölümdeki tüm ölçümler)
   sorunsuz çalıştı, ama kullanıcı gerçek iOS cihazında test edince şu
   hatayla çöktü: `"Creating blobs from 'ArrayBuffer' and 'ArrayBufferView'
   are not supported"`. **Kök neden:** `@google/genai`'nin resumable/chunked
   upload'ı büyük dosyaları `file.slice()` ile parçalıyor;
   `expo-file-system`'in `File.slice()` implementasyonu bir noktada
   `new Blob([arrayBuffer])` çağırıyor, ve React Native'in `Blob` polyfill'i
   (Node'un `Blob`'unun aksine) ArrayBuffer/ArrayBufferView'dan Blob
   oluşturmayı DESTEKLEMİYOR — bu yüzden Node testinde YAKALANAMADI
   (masaüstü ölçüm metodolojisinin bir sınırı: RN'e özgü polyfill
   farklarını göremez). **Düzeltme** (`extractInventoryFromVideoNative`):
   Files API'ye yüklenecek videolar için hâlâ `video.file.base64()`
   çağrılıyor, ama şimdi `fetch(\`data:...;base64,...\`).blob()` ile RN'in
   KENDİ native (ağ tabanlı) Blob'u elde ediliyor — bu blob'un `.slice()`'ı
   native olarak destekleniyor (bu, MVP-7'nin özgün, cihazda çalıştığı
   doğrulanmış çözümüydü). **Sonuç: bu optimizasyon aslında UYGULANAMADI**
   — Files API yoluna giden (>18MB, pratikte neredeyse tüm gerçek
   videolar) her istek hâlâ base64 dönüşümünden geçiyor, MVP-7 öncesiyle
   aynı. Ders: masaüstü/Node ile ölçülen "client tarafı ihmal edilebilir"
   bulgusu (aşağıda) hâlâ doğru (base64 encode ~10-20ms, wall-clock'a
   etkisi yok) ama BU YÜZDEN zaten kaybedilecek bir şey yoktu — gerçek
   kazanç yalnızca poll aralığı oldu (altta) — streaming de aşağıdaki gibi
   geri alındı.
2. ~~Streaming (`generateContentStream`)~~ — **DENENDİ, GERÇEK CİHAZDA
   ÇÖKTÜ, GERİ ALINDI.** "Gemini video tablo çağrısı başarısız oldu:
   Response body is empty". **Kök neden:** `@google/genai`'nin stream
   okuyucusu (`processStreamResponse`) yanıtı `response.body.getReader()`
   ile okuyor — bu, fetch'in gerçek bir `ReadableStream` body döndürmesini
   gerektirir. React Native'in yerleşik `fetch`'i (Node/tarayıcı fetch'inin
   aksine) `response.body`'yi ReadableStream olarak SUNMUYOR (RN'de
   `undefined`) — bu yüzden yine Node testinde (Node'un fetch'i WHATWG
   streams'i tam destekliyor) YAKALANAMADI, gerçek cihazda ortaya çıktı.
   **Bu, MVP-9'daki İKİNCİ "masaüstünde çalıştı ama cihazda çökmedi"
   bulgusu** (ilki yukarıdaki Blob/ArrayBuffer sorunu) — ders: bu tür
   RN'e özgü network/polyfill farkları masaüstü Node script'leriyle asla
   YAKALANAMAZ, gerçek cihaz/simülatör testi ZORUNLU. **Düzeltme:** normal
   (non-streaming) `callGemini`/`generateContent`'e geri dönüldü,
   `app/(tabs)/index.tsx`'teki "canlı ilerleme" (`streamedRowCount`)
   göstergesi de kaldırıldı (artık hiçbir zaman tetiklenmeyecekti — RN'de
   gerçek streaming olmadan `onObservation` yine tek seferde, sonda
   çağrılıyor). Gerçek streaming isteniyorsa (`expo/fetch` gibi
   ReadableStream destekli bir fetch polyfill'i eklemek) AYRI bir
   bağımlılık kararı gerekir.
3. **Files API poll aralığı 2000ms → 1000ms** (`FILES_API_POLL_INTERVAL_MS`):
   dosya `PROCESSING`den `ACTIVE`'e geçtikten sonraki "boşa" bekleme
   süresini kısaltır. Ölçümde poll sayısı 2-3 arasında değişti, net etki
   küçük ve gürültü seviyesinde kaldı (bkz. tablo) — zararsız, tutuldu.

**Test edildi ama UYGULANMADI (bulgu raporlandı, kod DEĞİŞTİRİLMEDİ):**

- **gemini-2.5-flash vs gemini-2.5-pro** (aynı fixture, gerçek çağrı):
  Flash %36 daha hızlı (27.6s vs 38.9s) ama ground-truth doğruluğu
  belirgin düştü (**%64 (7/11) vs %82 (9/11)**, `tereyağı, turşu,
  mozzarella, salata sosu` kaçırıldı). Kullanıcının kendi kriterine göre
  ("kalite belirgin düşüyorsa pro'da kal") — **varsayılan `gemini-2.5-pro`
  olarak KALDI**, flash'a geçilmedi. Tek fixture'lı ölçüm — yine de fark
  (18 puan) MVP-3/4'teki ölçüm gürültüsünden büyük, karar için yeterli
  görüldü.
- **720p'ye sıkıştırma** (ffmpeg ile masaüstünde `scale=-2:720, libx264,
  crf 23` — cihazda YAPILMADI, sadece hipotezi test etmek için): dosya
  boyutu **24.49MB → 2.72MB (%89 küçülme)**, bu da dosyayı Files API
  eşiğinin (18MB) ALTINA düşürdü — yükleme+poll aşaması TAMAMEN atlandı
  (0ms), toplam süre **25.9s** (24.5MB HEVC ile aynı promptla ölçülen
  35-47s aralığının belirgin altında). **Ama iki önemli bulgu:** (1) girdi
  token sayısı AZALMADI, hatta hafif arttı (7659 vs 7389) — Gemini'nin
  video tokenizasyonu kare/süre bazlı görünüyor, bit hızı/çözünürlükten
  bağımsız; bu optimizasyon TOKEN/maliyet kazandırmaz, sadece
  yükleme süresini (ve Files API eşiğini aşıp aşmama durumunu) etkiler.
  (2) Ground-truth doğruluğu **%73 (8/11)** — pro'nun bu videodaki diğer
  ölçümlerinden (%82-100) düşük ama tek örneklemli karşılaştırmalarda
  zaten görülen doğal varyans aralığında (bkz. MVP-3 notu) — kaliteyi
  KESİN olarak bozduğu SÖYLENEMEZ, ama KESİN olarak korunduğu da
  söylenemez (n=1). **Karar: uygulanmadı.** Cihazda gerçek video
  sıkıştırma/transcode yapmak için projede HİÇBİR bağımlılık yok
  (`expo-video-thumbnails` sadece kare/thumbnail çıkarır, transcode
  etmez) — yeni bir native paket (örn. `react-native-compressor` veya
  `ffmpeg-kit-react-native`) eklemek gerekir, bu "yeni paket eklemeden
  önce kullanıcıya sor" kuralına göre AYRI bir karar. **Öneri:** birden
  fazla fixture'la (n>1) doğruluk teyit edilirse ve kullanıcı yeni
  bağımlılığı onaylarsa, bu güçlü bir sonraki adım adayı (upload+poll
  aşamasını komple atlıyor, ~12-20s kazandırıyor).
- **Ölü kare kırpma ipucu:** kullanıcı bunu opsiyonel/UI-ipucu olarak
  tanımladığı için kod eklenmedi — Bölüm B'nin ekranı yeniden düzenlediği
  göz önüne alınarak, ekleme kararı o redesign'dan sonraya bırakıldı.

## Çalışma kuralları

- Her sayfa ayrı görev olarak geliştirilir; sayfa bitince `npx expo start`
  ile test edilebilir durumda bırak.
- Commit mesajları Türkçe ve conventional format: `feat: envanter sayfası`,
  `fix: sepet rozet sayacı`.
- Yeni paket eklemeden önce mevcut bağımlılıklarla çözülebiliyor mu kontrol et.
- Mock veri yalnızca `__mocks__/` altında yaşar; production kodunda mock
  kalmışsa temizle.
