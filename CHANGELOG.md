# Changelog

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
