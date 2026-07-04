# fixtures/

Test görselleri/videoları buraya, ground truth dosyalarıyla eşleşen isimlerle koy.

## Dosya adlandırma

Her fixture için **iki dosya** gerekir — aynı temel isimle:

```
fridge-01.jpg
fridge-01.ground-truth.json
fridge-02.mp4
fridge-02.ground-truth.json
receipt-01.jpg
receipt-01.ground-truth.json
```

- Fotoğraf: `.jpg`, `.jpeg` veya `.png`
- Video: `.mp4` veya `.mov` (cihazda karelere ayrılır — bkz. `run-eval.ts`, ffmpeg gerektirir)
- Ground truth: `<isim>.ground-truth.json` — bkz. `ground-truth.example.json` şablonu

## Ground truth doldurma

`ground-truth.example.json` dosyasını kopyala, dosya adını fixture ile eşleştir
(`fridge-01.ground-truth.json`), ve görseldeki/videodaki ürünleri elle gir:

```json
[
  { "name": "yumurta", "qty": 6, "unit": "adet" },
  { "name": "süt", "qty": 1, "unit": "l" }
]
```

`run-eval.ts` bu listeyi Claude/Gemini'nin çıkardığı ürünlerle isim bazlı
karşılaştırır (küçük harfe çevirip boşlukları temizleyerek eşleştirir).
