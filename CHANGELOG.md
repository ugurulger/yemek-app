# Changelog

> ⚠️ **Bu dosya MVP-4'ten sonra güncellenmedi ve KAPATILDI.** Proje
> tarihçesi ve ölçüm arşivi artık
> `.claude/skills/yemek-app/references/HISTORY.md`'de tutulur; güncel
> kurallar `.claude/skills/yemek-app/SKILL.md`'dedir.

## MVP-4 — 2026-07-05

Aynı iki aşamalı mimariyi Gemini'ye de uygula, varsayılan sağlayıcıyı
Gemini yap.

### Değiştirildi
- **İki aşamalı Gemini akışı** (`services/vision/gemini-provider.ts`):
  MVP-3'te Claude için işe yarayan gözlem+yapılandırma mimarisi Gemini'ye
  de uygulandı (ikisi de `gemini-2.5-flash`). Kök neden: kullanıcı, MVP-3
  sonrası Claude çıktısının kendi (kod dışı) Gemini testindeki kaliteye
  ulaşmadığını belirtti — asıl sorun bizim Gemini çağrımızın hâlâ
  tek-aşamalı sıkı şema kullanmasıydı, kullanıcıyı etkileyen serbest
  prompt değildi.
- Paylaşılan promptlar (`OBSERVATION_SYSTEM_PROMPT`, `buildObservationPrompt`,
  `STRUCTURING_SYSTEM_PROMPT`) `services/vision/prompt.ts`'e taşındı — artık
  hem `claude-provider.ts` hem `gemini-provider.ts` aynı promptları
  kullanıyor (kod tekrarı yok). Eski tek-aşamalı `BASE_SYSTEM_PROMPT` /
  `buildSystemPrompt` kaldırıldı (artık hiçbir sağlayıcı kullanmıyor).
- **Varsayılan sağlayıcı** `claude` → `gemini` (`.env`, `.env.example`,
  `services/vision/index.ts`) — kullanıcı kararı.

### Ölçülen sonuçlar (2026-07-05, aynı video fixture, 11 ürünlük ground truth — gerçek rakamlar)

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Gerçek maliyet |
|---|---|---|---|---|
| Claude (iki aşamalı) | %100 (11/11) | 10 | 52.5s | $0.153 |
| **Gemini (iki aşamalı, kazanan)** | %100 (11/11) | 14 | 61.8s | hesaplanmadı (fiyat girilmedi) |

İkisi de %100 doğruluk. Çarpıcı fark token tarafında: Gemini'nin gözlem
aşaması aynı görseller için ~3.300 girdi tokeni kullandı, Claude ~57.800
tokenle aynı işi yaptı (~17 kat fark) — Gemini'nin görsel tokenizasyonu
belirgin şekilde daha ucuz görünüyor, gerçek dolar maliyeti Gemini
fiyatlandırması doğrulanmadığı için kıyaslanamasa da.

### Karar
`EXPO_PUBLIC_VISION_PROVIDER=gemini` varsayılan yapıldı (kullanıcı
tercihi). Claude kod tabanında A/B karşılaştırması için tutuluyor.

## MVP-3 — 2026-07-05

Claude için iki aşamalı vision mimarisi (şemasız gözlem + ayrı JSON
yapılandırma) ve çözünürlük/kare optimizasyonu.

### Eklendi
- **İki aşamalı Claude akışı** (`services/vision/claude-provider.ts`):
  Aşama 1 — `claude-sonnet-5` ile şema dayatmadan serbest metin gözlem
  (marka, raf/çekmece konumu, miktar, belirsizlikler dahil detaylı anlatım).
  Aşama 2 — `claude-haiku-4-5` ile bu metni `[{name, qty, unit, brand,
  confidence}]` şemasına dönüştürme. Kök neden: sıkı JSON şeması modelin
  gözlem detayını kısıtlıyordu (kullanıcı, aynı videoda Gemini'ye şemasız
  prompt verildiğinde çok daha detaylı sonuç alındığını doğruladı).
- `InventoryItem.brand` (opsiyonel alan, `types/inventory.ts`) — marka
  bilgisi artık "name"den ayrı tutuluyor.
- `UsageEvent` / `ExtractInventoryOptions` (`services/vision/types.ts`) —
  sağlayıcılar artık gerçek API `usage` rakamlarını (`onUsage` callback)
  raporlayabiliyor; eval script'i artık tahmin değil GERÇEK token/maliyet
  kullanıyor.

### Değiştirildi
- **Çözünürlük** (`lib/media/resizeImageToBase64.ts`): `MAX_EDGE` 1568 →
  2576px. Claude Sonnet 5, gözlem aşamasında bu çözünürlüğü destekliyor;
  küçük ambalaj yazılarının okunabilmesi için gerekliydi.
- **Video kare sınırı** (`lib/media/extractVideoFrames.ts`): `DEFAULT_MAX_FRAMES`
  8 → 12 (yoğunluk değil sınır artışı — test videosu 8 saniye olduğu için
  bu videoda kare sayısını değiştirmedi, daha uzun videoların kesilmesini
  önlemek için). "Sahne bazlı" kare seçimi `expo-video-thumbnails`'in
  zaman-bazlı API'siyle mümkün olmadığı için uygulanmadı.
- `tests/vision-eval/run-eval.ts`: karakter/piksel bazlı tahmin yerine
  sağlayıcıların gerçek `usage` verisini kullanan model-bazlı fiyatlandırma
  (`claude-sonnet-5`, `claude-haiku-4-5`, Gemini hâlâ doğrulanmadı); Claude
  için aşama bazında token/maliyet dökümü raporlanıyor.

### Ölçülen sonuçlar (2026-07-05, aynı video fixture, 11 ürünlük ground truth — gerçek rakamlar)

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Gerçek maliyet |
|---|---|---|---|---|
| MVP-2 — Claude Sonnet 4.6 (tek aşama) | %91 (10/11) | 4 | 8.1s | ~$0.05 (tahmini) |
| MVP-3 — Claude iki aşamalı, thinking açık (ilk ölçüm) | %100 (11/11) | 10 | 58.2s | $0.158 |
| **MVP-3 — Claude iki aşamalı, thinking kapalı (kazanan)** | **%100 (11/11)** | 8 | 42.5s | $0.144 |
| MVP-3 — Gemini 2.5 Flash (değişmedi, varyans %73–100) | %73–100 | 5–7 | 17.9–19.5s | hesaplanmadı |

Claude aşama dökümü (thinking kapalı): Aşama 1 (gözlem) $0.135 (~%94),
Aşama 2 (yapılandırma) $0.009 (~%6). Aşama 2 gerçekten ucuz — ama toplamda
MVP-2'ye göre maliyet ~3 kat, yanıt süresi ~5 kat arttı; artışın kaynağı
yüksek çözünürlük + daha pahalı gözlem modeli + iki sıralı istek, Aşama
2'nin kendisi değil. "8 yanlış pozitif"in çoğu muhtemelen gerçek ürünler —
MVP-2'nin elle çıkarılan ground truth'u bulanık/düşük çözünürlüklü
karelerden oluşturulmuştu ve muhtemelen eksikti.

### Karar
Doğruluk %91 → %100'e çıktı ama yanıt süresi 8.1s → 58.2s'ye (7 kat)
uzadı. Kullanıcıya soruldu, "gecikmeyi azalt" seçildi:
`services/vision/claude-provider.ts`'te Aşama 1'e `thinking:
{type:"disabled"}` eklendi (Sonnet 5 varsayılan olarak adaptive thinking
çalıştırıyordu, bu görevde doğruluğa gözle görülür katkısı yoktu, sadece
gecikme/maliyet ekliyordu) — süre 58.2s → 42.5s'ye, maliyet $0.158 →
$0.144'e düştü, doğruluk hâlâ %100.

### Düzeltildi — kablo bağlantısı sorunu
`app/(tabs)/index.tsx` MVP-2/3 boyunca `services/vision/`'ı DEĞİL, ondan
önce yazılmış eski bir kopya olan `lib/claude/extractInventoryFromImages.ts`
+ `lib/claude/client.ts`'i çağırıyordu — yani o ana kadarki hiçbir
optimizasyon canlı uygulamada aktif değildi. Kullanıcıya soruldu, ekranı
`services/vision`'a bağlamak onaylandı: `app/(tabs)/index.tsx` artık
`getVisionProvider().extractInventory` kullanıyor (`EXPO_PUBLIC_VISION_PROVIDER`
ile sağlayıcı seçimi dahil), eski `lib/claude/extractInventoryFromImages.ts`
kaldırıldı (`lib/claude/client.ts` tarif üretimi için hâlâ kullanıldığından
korundu).

## MVP-2 — 2026-07-04

Vision sağlayıcı (Claude/Gemini) karşılaştırması, ölçüme dayalı optimizasyon
ve sağlayıcı kararı.

### Eklendi
- `tests/vision-eval/` — Claude ve Gemini'yi gerçek fixture'lar (fotoğraf/video)
  üzerinde karşılaştıran eval script'i (`run-eval.ts`). Her fixture için
  doğruluk oranı, yanlış pozitif sayısı, yanıt süresi ve tahmini token/maliyet
  raporu üretir (`tests/vision-eval/results/*.md`).

### Değiştirildi
- **Sistem talimatı** (`services/vision/prompt.ts`): ürün isimleri artık
  Türkçe ve genel kategori adı olmak zorunda (örn. "süt", "peynir",
  "domates") — marka adı veya ambalaj üzerindeki yabancı dil metni
  yasaklandı; aynı genel üründen birden fazla adet/paket tek satırda
  toplanıyor. Kök neden: ilk testte modeller ürünleri doğru buluyor ama
  markalı/yabancı isimlerle dönüyordu ("süt" yerine "Arla Bio Halfvolle
  Melk"), bu da hem test eşleşmesini hem de gerçek tarif eşleştirmesini
  bozuyordu.
- **Video kare boyutlandırma** (`lib/media/extractVideoFrames.ts`): video
  kareleri artık fotoğraf yolundaki gibi `resizeImageToBase64` ile 1568px
  uzun kenar sınırından geçiyor. Önceden video kareleri cihaz kamerası
  çözünürlüğünde (test videosunda 1080×1920) doğrudan gönderiliyordu —
  gereksiz token/maliyet ve daha yavaş yanıt.

### Ölçülen sonuçlar (2026-07-04, 1 video fixture, 11 ürünlük ground truth)

| Sağlayıcı | Doğruluk | Yanlış pozitif | Yanıt süresi | Tahmini maliyet |
|---|---|---|---|---|
| Optimizasyon öncesi — Claude | %18 (2/11) | 14 | 15.7s | $0.074 |
| Optimizasyon öncesi — Gemini | %0 (0/11) | 17 | 21.9s | hesaplanmadı |
| **Optimizasyon sonrası — Claude (kazanan)** | **%91 (10/11)** | 4 | 8.1s | $0.051 |
| Optimizasyon sonrası — Gemini | %82 (9/11) | 2 | 17.6s | hesaplanmadı |

### Karar
`EXPO_PUBLIC_VISION_PROVIDER` varsayılanı **`claude`** olarak ayarlandı
(zaten `.env`/`.env.example`'da bu değerdeydi). Claude Sonnet 4.6, Gemini
2.5 Flash'a göre hem daha doğru hem ~2 kat daha hızlı ölçüldü. Gemini kod
tabanında A/B karşılaştırması için tutuluyor. Örneklem küçük (tek video) —
daha fazla fixture eklenip eval tekrar çalıştırıldıkça bu karar
güncellenmeli.

## MVP-1

- Envanter ve tarif akışlarının ilk sürümü (fotoğraf/video → ürün tanıma,
  envanterden tarif üretimi).
- Claude API çağrılarının Node yerleşik modüllerinden bağımsız hale
  getirilmesi (React Native uyumluluğu için doğrudan `fetch` kullanımı).
