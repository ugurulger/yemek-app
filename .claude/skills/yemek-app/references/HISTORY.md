# yemek-app — Tarihçe ve ölçüm arşivi

Bu dosya session başında OKUNMAZ. SKILL.md yalnız güncel kural ve dersleri
tutar; "bu neden böyleydi / rakamlar neydi?" gerektiğinde bu arşiv açılır.
Buradaki anlatılar taşındıkları günkü halleriyle korunur — güncel davranış
için DAİMA SKILL.md ve kod esastır.

## MVP-2 (2026-07-04)

> **MVP-2 prompt değişikliği neden yapıldı** (her iki sağlayıcının
> yapılandırma promptu için hâlâ geçerli): İlk testte modeller ürünleri
> doğru buluyor ama markalı/yabancı dil isimlerle dönüyordu (örn. "süt"
> yerine "Arla Bio Halfvolle Melk"). Genel Türkçe isim + tekilleştirme
> kuralı eklenince doğruluk Claude'da %18 → %91, Gemini'de %0 → %82'ye
> çıktı.

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

## MVP-3 (2026-07-05)

> **MVP-3 iki aşamalı mimari + çözünürlük artışı (Claude):** Kullanıcı,
> aynı videoda Gemini'ye şemasız prompt verildiğinde çok daha detaylı/doğru
> sonuç alındığını doğruladı — sorun model kapasitesi değil, Claude
> tarafındaki sıkı şemanın gözlem detayını kısıtlamasıydı. İki aşamalı akış
> + 1568→2576px çözünürlük artışı + 8→12 kare sınırıyla Claude'un doğruluğu
> %91 → %100'e çıktı, ama yanıt süresi/maliyet arttı (bkz. altta).
> `thinking: {type:"disabled"}` ile bu artış kısmen geri alındı.

Canlı akış düzeltmesi (aynı MVP):

> ✅ **MVP-3'te düzeltildi:** `app/(tabs)/index.tsx` daha önce bu bölümde
> anlatılan `services/vision/` modülünü DEĞİL, ondan önce yazılmış eski bir
> kopya olan `lib/claude/extractInventoryFromImages.ts` + `lib/claude/client.ts`'i
> çağırıyordu (eski tek-şema prompt, `claude-sonnet-4-6`, Gemini seçeneği
> yok) — yani MVP-2'deki optimizasyonlar canlı uygulamada aktif değildi. Bu
> düzeltildi: ekran artık `services/vision`'ı (`getVisionProvider()`)
> kullanıyor, eski `extractInventoryFromImages.ts` kaldırıldı
> (`lib/claude/client.ts` tarif üretimi için hâlâ kullanıldığından korundu).

### MVP-3 ölçüm ve kararlar

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

## MVP-4 (2026-07-05) — ölçüm ve karar

> **MVP-4 aynı mimari Gemini'ye de uygulandı:** MVP-3 sonrası kullanıcı,
> Claude'un iki aşamalı çıktısının hâlâ kendi Gemini testindeki kaliteye
> ulaşmadığını belirtti. Kök neden aynıydı — bizim Gemini çağrımız hâlâ
> tek-aşamalı sıkı şemayı kullanıyordu, kullanıcıyı etkileyen serbest
> prompt değildi. Gemini'ye de aynı gözlem+yapılandırma akışı uygulandı ve
> varsayılan sağlayıcı `gemini` yapıldı — bkz. "Sağlayıcı karşılaştırma
> notları".

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

## MVP-5 — confidence şemasının yüzdeselleştirilmesi

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

## MVP-6 — Gemini Aşama 2'yi doğal sezgiye bırakma

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

## Native-video maliyeti ölçülmedi (MVP-7 notu)

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

## MVP-8 — kategori + marka + eşik

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

## MVP-9 (2026-07-05) — performans profili

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

## MVP-10 (2026-07-05)

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

Renkli şerit maddesi (MVP-21'de kaldırıldı):

- **Kart ikonu yerine renkli şerit (MVP-10):** ⚠️ ŞERİT MVP-21'DE
  KALDIRILDI (bkz. altta, "Kategori arka plan renkleri" maddesinin
  sonundaki not) — tarihi kayıt: kart solunda tabak/çatal emoji'si
  YERİNE grup bazlı ince bir renkli şerit (`GROUP_STRIPE_COLORS`)
  kullanılıyordu — emerald-900/amber-500 paletinin ton varyasyonları
  (emerald-900, emerald-500, amber-500, amber-300, stone-300), yeni bir
  renk ailesi İCAT EDİLMEMİŞTİ. Confidence rozeti (`%92` gibi) ana
  kategorili listede ARTIK GÖSTERİLMİYOR (zaten `CONFIDENCE_THRESHOLD`'un
  üzerindeki ürünler gösteriliyor, rozet bilgi değeri taşımıyordu) —
  SADECE "emin olunamayan ürünler" modalında gösterilmeye devam ediyor.

## MVP-12 (2026-07-07)

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

## MVP-13 (2026-07-07)

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

## MVP-14 (2026-07-08)

**MVP-14 (2026-07-08, tarihi not — MVP-15 ile DEĞİŞTİRİLDİ) — 9 tarifi 3
paralel çağrıya bölme:** Profilleme, tek `submit_recipes` çağrısıyla 9
tarifin TAMAMININ üretilmesinin ~88s sürdüğünü ve bunun ~%99'unun tek model
çıkarım süresi olduğunu gösterdi. Çözüm: 9 tarif, katman başına 3'er
tarif üreten 3 BAĞIMSIZ paralel çağrıya (`ready`/`closeMatch`/`fewMissing`)
bölündü, ~35.7s'ye indi. **Ancak kullanıcı bu mimariyle üretilen 9 tarifin
çeşitliliğinin düştüğünü bildirdi** (benzer/klasik tarifler, aynı ana
malzemenin — patates, tavuk, yoğurt — tekrar tekrar farklı katmanlarda
çıkması) — kök neden, her katmanın DİĞER İKİSİNDEN HABERSİZ, kendi 3
tarifini bağımsız planlamasıydı; 9 tarif hiçbir zaman BİRLİKTE
düşünülmüyordu. Bu, MVP-15'in çözdüğü sorundur (altta). Bu bölümde
tanımlanan `generateRecipeLayer`/`generateRecipesInLayers`/`RECIPE_LAYERS`
fonksiyonları/tipleri artık KODDA YOK, MVP-15'in aşağıdaki fonksiyonlarıyla
DEĞİŞTİRİLDİ.

## MVP-15 (2026-07-09) — ölçüm

**Ölçüm (2026-07-09, gerçek API çağrısı, aynı 12 ürünlük örnek envanter,
`npx tsx` ile masaüstünde — SKILL.md'nin diğer perf ölçümleriyle aynı
yöntem, MVP-14 ölçümüyle birebir karşılaştırılabilir):** Aşama 1 (isim
planı) **8.8s**, Aşama 2 (9 paralel detay) **24.0s** (en yavaş tekil detay
çağrısı da 24.0s — paralelleşmenin kazandırdığı, dokuzun TOPLAMI değil),
**TOPLAM 32.8s duvar-saati**. Bu, MVP-14'ün 35.7s'sinden hafif daha hızlı
(gürültü seviyesinde, iki ölçüm de aynı ~30-36s bandında) ve orijinal
tek-çağrı ~88s'ye göre ~%63 azalma — yani MVP-15 HIZ kazanımını
KORUYARAK çeşitlilik sorununu çözdü. 9/9 tarif BENZERSİZ (tekilleştirme
gerekmedi). **Çeşitlilik karşılaştırması:** MVP-14 ölçümünde 8 tarifin
çoğu aynı temaların (patates/tavuklu/yoğurtlu/pilav) yeniden karışımıydı
(örn. "Sarımsaklı Patates Yoğurtlu" ve "Patates Yoğurtlu Sarımsaklı Tavuk"
neredeyse aynı yemeğin yeniden adlandırılmış hali); MVP-15 ölçümünde 9
tarif (Menemen, Tavuklu Pirinç Pilavı, Patates Çorbası, Sarımsaklı Yoğurt
Soslu Makarna, Fırın Tavuklu Patates, Domates Soslu Beyaz Peynirli Omlet,
Tavuk Sote, Izgara Patates & Yoğurtlu Sos, Beyaz Peynirli & Domatesli Soğuk
Pirinç Salatası) farklı pişirme tekniklerine (çorba, fırın, sote, ızgara,
soğuk salata, omlet) ve öğün tiplerine yayıldı — aynı ana malzeme (ör.
patates, tavuk) birden fazla tarifte geçse de her seferinde belirgin
şekilde FARKLI bir yemek formatında. **Kendi kendini düzeltme örneği:**
"Menemen" Aşama 1'de `estimated_layer: ready` olarak planlandı ama Aşama
2'de gerçek malzeme listesi hesaplanınca match_pct=78 çıktı — kod bunu
OTOMATİK `closeMatch` bölümüne yerleştirdi (model tahmini değil, gerçek
hesap kazandı); aynı şekilde "Tavuklu Pirinç Pilavı" `ready` tahmin edildi
ama match_pct=73 ile `fewMissing`e yerleşti.

## MVP-16 (2026-07-11) — ölçüm

- **Ölçüm (2026-07-11, gerçek API, aynı 12 ürünlük örnek envanter, `npx
  tsx` masaüstünde — önceki MVP ölçümleriyle aynı yöntem, tek koşu):**
  Aşama 1 (plan) **7.3s**, Aşama 2 (6 paralel detay) **29.5s**, TOPLAM
  **36.8s** — MVP-14/15'in ~30-37s bandında (MVP-15: 32.8s; fark tek-koşu
  gürültüsü seviyesinde, hız hedefi korundu). Sonuç: 6/6 tarif üretildi,
  **3 tarif missing_count=0** ("Hemen Yapabilirsin" ≥2 kabul kriterini
  aştı — Menemen, Cacık, Tavuklu Yoğurt Çorbası), 1 tarif 1 eksik, 2 tarif
  3-4 eksik. Ready-retry hiç TETİKLENMEDİ (iki ready tarif de ilk denemede
  0 eksik döndü — kısıtlı prompt işe yarıyor). Kendi kendini düzeltme
  örneği: "Tavuklu Yoğurt Çorbası" `closeMatch` planlandı ama detayı 0
  eksik çıktı — kod ready bölümüne taşıdı (dağılım bu yüzden 3/1/2 oldu;
  2/2/2 katı bir UI garantisi DEĞİL, kesin katman her zaman gerçek eksik
  sayısından gelir). Çeşitlilik: kahvaltı (menemen), meze/salata (cacık),
  çorba, fırın graten, börek, fırın tavuk — farklı format/öğün tiplerine
  yayıldı.

## MVP-17→21 tasarım sagası (2026-07-11)

Envanter kartı/yerleşimi deneme-geri alma zinciri. Nihai durum SKILL.md
"Tasarım sistemi" bölümündedir; buradaki her şey tarihi kayıttır.

- **2'li grid — kategori bölümleri yan yana (MVP-17, 2026-07-11):** ⚠️ Bu
  MADDENİN YAN YANA GRID KISMI MVP-19'DA GERİ ALINDI (bkz. altta) — uzun
  ürün adları dar sütunda görünmüyordu. `chunkPairs` fonksiyonu da MVP-19'da
  SİLİNDİ (kullanım yeri kalmadı). Tarihi kayıt olarak bırakılıyor. İlk
  denemede ürünler kendi grubu İÇİNDE ikişerli eşlenmişti; kullanıcı bunu
  reddedip KATEGORİ BÖLÜMLERİNİN kendisinin yan yana olmasını istedi
  ("Süt & Peynir ve Et & Şarküteri yanyana"). O hâl: `categorizedSections`
  (`GROUP_ORDER` sırasına göre) `chunkPairs` ile ikişerli satırlara
  bölünürdü, her satırda iki `CategoryColumn` (`flex-1`) yan yana —
  her sütun kendi başlık chip'i + altında TEK SÜTUN halinde dikey sıralı
  `ProductCard`'lar içerir (bölümler farklı ürün sayısına sahip olabilir,
  sütun yükseklikleri farklı olabilir — bu normal). Tek sayıda bölümde son
  satırın ikinci hücresi boş `flex-1` (son sütun tam genişliğe YAYILMAZ).
  `ProductCard` kompaktlaştırıldı (kart yüksekliği DEĞİŞMEDİ — kullanıcı
  şartı): ad satırında sağda küçük sil ikonu (`h-5 w-5`, ilk denemede
  kontrol satırındaydı ama dar sütunda 3 buton + miktar metni sığmadığı
  için — "1 li..." gibi kesiliyordu — ad satırına taşındı), marka altında,
  en altta TEK satırda `[−] [qty unit] [+]` (`h-6 w-6` butonlar, ikonlar
  13/14, miktar metni `text-xs` `flex-1`); ad/marka `numberOfLines={1}` ile
  üç noktayla kısalır. **⚠️ Bu paragraftaki `[−] [qty unit] [+]` kontrol
  satırı MVP-18'de KALDIRILDI** (bkz. altta) — butonlar tamamen gitti,
  satır tek satıra indi; kalan kısımlar (2'li grid, `CategoryColumn`,
  sil ikonunun ad satırında olması) hâlâ geçerli. "Emin olunamayan
  ürünler" modalı TEK SÜTUN kaldı (kullanıcı kararı — MVP-10'un iki
  render yolu ayrımı sürüyor).

- **+/- butonları kalktı, satır kaydırmaya (swipe) geçti (MVP-18):**
  ⚠️ Bu maddenin KAYDIRMA/MİKTAR kısmı MVP-20'de TAMAMEN kaldırıldı (bkz.
  altta) — tarihi kayıt olarak bırakılıyor, `PanResponder`/`Animated`/
  chevron/peek-hint kodu artık YOK. +/- butonlarının kaldırılması ve
  kartın tek satıra inmesi kararı hâlâ geçerli.
  kullanıcı satırların "buton grubu" değil gerçek bir liste gibi
  görünmesini istedi. `ProductCard` (`app/(tabs)/index.tsx`) artık TEK
  satır: `[ad, flex-1] [miktar+birim] [silme kutusu]` + (varsa) altında
  küçük marka satırı — azalt/artır `Pressable`leri ve ayrı kontrol satırı
  TAMAMEN kaldırıldı, şerit `h-10` → `h-8`, satır dolgusu `py-3` → `py-2`
  (kart doğal olarak kısaldı). Miktar artık **kaydırma** ile değişiyor:
  sola kaydırma TEK EŞİKLİ (`SWIPE_THRESHOLD = 40`, `SWIPE_MAX_OFFSET =
  56`) — miktarı 1 azaltır, miktar zaten 1 ise AYNI hareket ürünü SİLER;
  sağa kaydırma miktarı 1 artırır. İki eşikli (kısmi=azalt, tam=sil)
  tasarım kullanıcı kararıyla ELENDİ — 2'li grid sütunu zaten dar
  (~150-170px), iki eşiği ayırt etmek zorlaşırdı; satırdaki sabit silme
  kutusu (çöp ikonu, kaydırmadan bağımsız, onaysız anında siler) büyük
  miktarları tek seferde silmek için zaten yeterli. **Yeni paket
  EKLENMEDİ** — proje `react-native-gesture-handler` içermiyor (kontrol
  edildi: sadece `react-native-reanimated` var, `react-native-screens`'in
  kendi iç kopyası uygulama kodundan kullanılamaz); kaydırma React
  Native çekirdeğinin `PanResponder` + `Animated` API'siyle yazıldı.
  `PanResponder.create(...)` her render'da YENİDEN oluşturulur (bir
  `useRef` içine SARILMAZ) — aksi halde `onPanResponderRelease` içindeki
  "azalt mı sil mi" kararı ilk mount'taki bayat `item.qty` değerini
  kullanırdı (stale closure hatası). Keşfedilebilirlik için — kullanıcı
  kararıyla İKİSİ BİRDEN: (a) her satırın sol/sağ kenarında sabit soluk
  `chevron-back`/`chevron-forward` ikonları (`size 12`, `#d6d3d1`,
  kaydırılan `Animated.View`'ın DIŞINDA, statik), (b) ekran ilk mount
  olduğunda listedeki İLK satır için tek seferlik bir "peek" animasyonu
  (`translateX` kısaca -14 → 0) — bir daha TEKRARLANMAMASI için
  `AsyncStorage` üzerinde kalıcı bir bayrak (`yemek-app-swipe-hint-seen`)
  kullanılır (`showSwipeHintOnFirstItem` prop'u `CategoryColumn` →
  `ProductCard`'a `itemIndex === 0` olan karta iletilir). `store/
  inventoryStore.ts`'e YENİ bir action EKLENMEDİ — mevcut `decrementQty`/
  `incrementQty`/`removeItem` yeterli, "azaltınca sıfırlanırsa sil"
  kararı `index.tsx`'teki swipe handler'da veriliyor. **Kapsam dışı,
  bilinçli:** "Buzdolabım" başlığına gelecek "Ekle" butonu (elle malzeme
  girişi açacak) kullanıcının ayrı talimatını bekliyor, bu görevde
  YAPILMADI.

- **Bölümler tekrar alt alta + kategori arka plan renkleri (MVP-19,
  2026-07-11):** ⚠️ "ALT ALTA" YERLEŞİMİ MVP-20'de TEKRAR YAN YANA'ya
  DÖNDÜ (`chunkPairs` geri getirildi, bkz. altta) — kullanıcı bu sefer
  kartın miktar/kaydırma taşımadığı için dar sütunda sığacağını
  düşündü. ARKA PLAN RENKLERİ (`GROUP_BACKGROUND_COLORS`) ve krem tonu
  DEĞİŞMEDİ, hâlâ geçerli. "Kaydırma daha görünür" alt maddesi MVP-20'de
  konusu KALKTI (kaydırma tamamen silindi). Tarihi bağlam için: kullanıcı
  MVP-17'nin yan yana 2'li bölüm düzeninde uzun ürün adlarının
  (`numberOfLines={1}` ile) kesildiğini bildirmişti — dar sütun
  (~150-170px) yeterli genişlik vermiyordu. O zamanki çözüm: `chunkPairs`
  SİLİNDİ, `categorizedSections` düz `.map()` ile TAM GENİŞLİK, ALT ALTA
  render ediliyordu (`app/(tabs)/index.tsx`, "Buzdolabım" kartı içinde
  `gap-3` ile ayrılan tek sütun). Aynı geri bildirimde kullanıcı iki
  tasarım isteği daha eklemişti:
  - **Kategori arka plan renkleri:** her `CategoryColumn` artık kendi
    soluk pastel arka plan tonuyla (`GROUP_BACKGROUND_COLORS`,
    `rounded-2xl px-3 py-3`) ayrı bir "raf" gibi görünüyor — bölümler
    arası eski `border-t` çizgi ayracı KALKTI, renk geçişinin kendisi
    ayırıyor. Bu palet o zamanki `GROUP_STRIPE_COLORS`'tan (emerald/amber
    ailesi) BİLEREK TÜRETİLMEMİŞTİ: türetilseydi Süt & Peynir ile Sos &
    Baharat aynı amber ailesinde neredeyse ayırt edilemez olurdu. Süt &
    Peynir = açık krem `#FAF3E7` (kullanıcının özel isteği — "daha açık
    krem yap"), Et & Şarküteri = soluk terracotta `#F6E8E2`, Meyve &
    Sebze = soluk adaçayı yeşili `#EAF3EA`, Sos & Baharat = soluk
    hardal/altın `#F5EFD6`, Diğer = soluk taş grisi `#F3F1EE`. O sırada
    `GROUP_STRIPE_COLORS` (item şeridi) BİLEREK DEĞİŞTİRİLMEMİŞTİ — Süt &
    Peynir zaten koyu emerald-900 şerit kullanıyordu, kontrastı krem
    arka planla bozulmuyordu ("rengi krem yap" isteği o an STRIPE değil
    bu ARKA PLAN katmanı olarak yorumlanmıştı). **MVP-21'de şeridin
    kendisi TAMAMEN KALDIRILDI** (`GROUP_STRIPE_COLORS` sabiti SİLİNDİ,
    kullanıcı "envanterdeki itemlerin solundaki renkli şeyi kaldır, ürün
    isimleri sola yaslansın" dedi) — artık kategori ayrımını TEK BAŞINA
    bu arka plan tonu taşıyor, `ProductCard`'ın stripe `View`'ı ve
    `stripeColor` prop'u tamamen gitti. Bölüm başlığı chip'i
    `bg-stone-100` → `bg-white/60` (yarı saydam beyaz, hangi pastel
    tonun üstünde olursa olsun "yüzüyor" gibi durur); satır içi ayraç
    `border-stone-50` → `border-stone-900/5` (sabit gri yerine düşük
    opaklıklı siyah, her pastel tonla uyumlu).
  - **Kaydırma daha görünür:** kullanıcı MVP-18'in soluk sabit
    (`stone-300`, `size 12`) kenar chevron'larının yeterince fark
    edilmediğini bildirdi. Chevron'lar büyüdü (`size 12 → 18`) ve yöne
    göre renklendirildi (sol `#fca5a5` soluk kırmızı = azalt/sil, sağ
    `#6ee7b7` soluk emerald = artır — tasarım sistemindeki hata/birincil
    renk çağrışımlarıyla tutarlı). Daha önemlisi: artık SADECE ilk
    satırdaki tek seferlik "peek" değil, HER satırda SÜREKLİ bir soluk
    nefes alma (opacity 0.4↔1, `Animated.loop`, `useNativeDriver: true`,
    900ms) animasyonu var — kaydırma artık kalıcı olarak fark ediliyor,
    tek seferlik ilk-açılış ipucuyla sınırlı değil.
  - **Doğrulama notu:** chevron animasyon LOOP'unun kendisi web
    önizlemesinde gözlemlenemedi (react-native-web'in `useNativeDriver`
    desteği platform farkı gösterebiliyor, bkz. MVP-9 dersi) — statik
    stiller (boyut, renk, opaklık başlangıç değeri) DOM'da doğrulandı,
    animasyonun gerçek akıcılığı cihazda kontrol edilmeli.

- **Kaydırma sistemi tamamen kaldırıldı, bölümler tekrar yan yana
  (MVP-20, 2026-07-11):** kullanıcı miktar (`qty`) bilgisinin UI'da
  gösterilmesine gerek olmadığına karar verdi ("bilgi olarak arkada
  tutulabilir" — `item.qty` veri modelinde/store'da AYNEN KALIYOR,
  sadece render edilmiyor); miktar gösterilmeyince onu değiştirecek bir
  kaydırma yönlendirmesine de gerek kalmadığını belirtti. Sonuç:
  - **`ProductCard` tamamen statikleşti:** MVP-18/19'un TÜM kaydırma
    kodu (`PanResponder`, `Animated.Value`/`translateX`, chevron
    `Animated.loop` nefes alma animasyonu, tek seferlik "peek" ipucu,
    `AsyncStorage` bayrağı `yemek-app-swipe-hint-seen`) SİLİNDİ. Kart
    artık sadece `[şerit] [ad, flex-1] [silme kutusu]` + (varsa) marka
    satırı — hiç hook/animasyon yok, tamamen statik bir View ağacı.
    `onIncrement`/`onDecrement` prop'ları `ProductCard`/`CategoryColumn`
    imzalarından TAMAMEN kalktı.
  - **Store'a DOKUNULMADI:** `incrementQty`/`decrementQty` action'ları
    `store/inventoryStore.ts`'te SİLİNMEDİ — "emin olunamayan ürünler"
    modalı (`InventoryList`/`InventoryRow`, MVP-10'dan beri ayrı tutulan
    render yolu) hâlâ bu action'ları kullanıyor, `MutfagimScreen`'deki
    `incrementQty`/`decrementQty` store seçicileri o modal için KALDI —
    sadece ana listeye (`CategoryColumn`/`ProductCard`) geçirilmekten
    çıkarıldılar.
  - **Bölümler tekrar YAN YANA:** `chunkPairs` geri getirildi
    (`app/(tabs)/index.tsx`), kategori bölümleri MVP-17/19-öncesi gibi
    2'li grid'de (`flex-row gap-3`, tek sayıda bölümde boş `flex-1`
    hücre). Kullanıcının gerekçesi: kart artık miktar metni/kaydırma
    taşımadığı için (sadece ad + silme kutusu) dar sütunda daha rahat
    sığıyor. MVP-19'un arka plan renkleri (`GROUP_BACKGROUND_COLORS`,
    krem dahil) ve başlık chip stili (`bg-white/60`) DEĞİŞMEDİ, aynen
    korundu — sadece yerleşim yönü (alt alta → yan yana) değişti. Uzun
    ürün adları (`numberOfLines={1}`) yine dar sütunda kısalabilir —
    bu MVP-17'de sorun olarak bildirilmişti, MVP-20'de kullanıcı bu
    trade-off'u bilerek tekrar tercih etti (kart artık daha az bilgi
    taşıdığı için kabul edilebilir görüldü).

## Çeşitli evrim notları

- **Eski markdown tablo akışı (geçmiş not):**
  `services/vision/markdown-table.ts` artık canlı akışta KULLANILMIYOR —
  başında `@deprecated` notuyla duruyor (git geçmişi/referans için), bir
  sonraki temizlikte kaldırılacak. `VIDEO_TABLE_PROMPT` silindi. MVP-7/8
  dönemine ait tablo sütunları, placeholder satırı ve `parseInventoryTable`
  detayları için o dosyaya ve git geçmişine bakın.
