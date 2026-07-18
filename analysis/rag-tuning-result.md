# RAG İnce Ayar — Sonuç Raporu (2026-07-18)

> Faz 3 çıktısı. Baseline: `analysis/rag-tuning-baseline.md`; harness:
> `tests/rag-tuning/run-compare.ts` (aynı envanterler: tr12 + en8; final RAG
> ölçümü 2'şer koşu). İki aşamalı yol referans değerleri Faz 1'den (davranış
> değişmedi — bu session iki aşamalı yola dokunmadı).

## Uygulanan ayarlar (commit sırasıyla)

1. **Madde 5 — gözlemlenebilirlik:** edge'de `[rag-gen]` stop_reason + usage
   + reconcile-sonrası dağılım logu; yanıtta `generation` metası.
2. **Madde 2 — katman:** pozisyonel 2/2/2 dağılım promptu (0 / 1-2 / 3-4
   eksik; ready'de garnitür yasağı) + `reconcileRecipes` İKİ YÖNLÜ yapıldı
   (in_inventory, envanter+kiler namesMatch'ine göre sıfırdan; alçaltma
   dahil) → sunucu katmanı = ekrandaki canlı `computeMissing`.
3. **Madde 3 — çeşitlilik (dört adım):** (a) yıldız-malzeme tavanı promptu,
   (b) retrieval çeşitlendirme (24 aday → başlık-token tavanıyla 8 referans;
   `matches[0]` global en-benzer kalır, kısayol eşiği etkilenmez),
   (c) baskın referans token'ı tespiti + SOMUT adlı tavan cümlesi,
   (d) **yapısal çözüm: normal 6 tarif 2×3 paralel gruba bölündü** (plan
   çağrısı YOK) — A grubu 2 ready + 1 eksikli ve baskın malzeme ≤2; B grubu
   1×(1-2) + 2×(3-4) eksikli, baskın malzeme YASAK ve baskın-aile dışı aday
   yoksa referans bloğu BOŞ (referans içeriği açık BAN'ı bile eziyordu —
   ölçümle kanıtlı: a-c adımları en8'de 4/6 somonda takıldı, d ile 2-3/6).
   `max_tokens` 8192→12288 (tek çağrıda 7.6K'ya dayanmıştı).
4. **Madde 4 — kısayol:** `source:"database"` tarifinde `image_prompt_en`
   başlık + ilk 5 malzeme.
5. **Madde 1 (EN sorgu) zaten koddaydı** — iş çıkmadı (baseline B5).

## Önce/sonra tablosu

Katman dağılımı = normal 6 tarifin canlı (`computeMissing`) eksiğine göre
0 / 1-2 / 3+ sayıları; koşu koşu.

| Metrik | İki aşamalı (referans) | RAG baseline | RAG ayarlı |
|---|---|---|---|
| Katman tr12 | 2/4/0 · 3/2/1 | **6/0/0** · 4/2/0 | 2/4/0 · 3/3/0 |
| Katman en8 | 2/2/2 · 2/2/2 | 5/1/0 · 4/2/0 | 2/4/0 · 2/3/1 |
| "Hemen Yapabilirsin" = 2 hedefi | 3/4 koşu (biri 3) | 0/4 koşu (4-6 ready) | 3/4 koşu (biri 3) |
| "Küçük Bir Alışverişle" doluluğu | hep 3-4 tarif | 0-2 tarif | hep 3-4 tarif |
| en8 somon yoğunluğu (normal 6) | 2-3 | **4-6** (+FD 2/2 somon) | **2-3** (FD ikilisi farklı yıldız) |
| Sunucu eksik = ekran eksiği | (tek hesap, doğal uyumlu) | uyumsuz (B3: 0↔1, 3↔5) | **birebir** (tüm koşularda rec=live) |
| Süre (ort.) | TR ~48s · EN ~34s | ~32.7s | **~20.2s** (19.6-21.3) |
| Maliyet/koşu | ~$0.24 (ölçüldü) | ~$0.06 (tahmin) | **~$0.06 (ölçüldü:** normal in ~6.6-10K + FD, out ~9-10K, Haiku) |
| stop_reason | 2/41 çağrı max_tokens (1 tarif kayboldu) | görünmüyordu | hep `tool_use`, kalıcı loglu |
| Fine dining kontrastı (0 / 2-3 eksik) | (ayrı mimari) | kısmen | 7/8 koşuda tutuyor (bir FD1 1 eksik) |

Tutarlılık: ayarlı RAG 4 final koşuda da 8/8 tarif döndürdü, dağılım bandı
stabil (ready 2-3, alışveriş 3-4 dolu); çeşitlilik koşu İÇİNDE hedefte.

## Kalan açıklar

1. **3+ eksikli katman tutarsız:** B grubunun "3-4 alışveriş" hedefi,
   iki yönlü mutabakat + modelin mütevazı malzeme seçimiyle çoğunlukla
   1-2'ye iniyor (4 final koşuda 1 kez 3+). İki aşamalı yol da TR'de aynı
   zaafı gösteriyor (2/4/0), EN'de 2/2/2 tutturuyor. Ekran etkisi: bölüm
   sıralaması artan eksik olduğundan kullanıcıya yansıyan fark küçük.
2. **Koşular ARASI fine dining monotonluğu:** deterministik retrieval +
   sabit prompt, benzer FD-1'i tekrar üretiyor ("Pan-Seared ... Creamed
   Spinach" varyantları). Koşu içinde ikili zıt ve farklı yıldızlı; parmak
   izi değişmeden yeniden üretim zaten cache'ten geldiği için etkisi sınırlı.
3. **Nadir yakın-ad tekrarı:** tr12#2'de iki scrambled-eggs varyantı (isim
   birebir olmadığından tekilleştirme yakalamıyor). Kozmetik; sıklık 1/8 koşu.
4. **Canlı slot gösterimi yok** — bilinen sınır (kullanıcı kararı, kapsam
   dışı); RAG ~20s'e indiği için bekleme hissi kısaldı.
5. TR kullanıcı deneyimi çeviri katmanına bağımlı (RAG hep EN üretir,
   RAG-EN kararı) — çeviri gelene dek EN gösterilir.

## Ek (aynı gün): ready tariflerde zenginlik düzeltmesi

Kullanıcı geri bildirimi: "Hemen Yapabilirsin" tarifleri fazla basit
kalıyordu (2-3 envanter malzemeli omlet/makarna). Her İKİ yola da
"ready = dolu tarif" kuralı eklendi (RAG A-grubu promptu + iki aşamalı
`LAYER_VARIANTS.ready` ve plan promptu; "en basit formatlara in" SON
ÇARE'ye sınırlandı). Ölçüm (kullanılan FARKLI envanter ürünü, `env N`):

| | Önce | Sonra |
|---|---|---|
| RAG ready (tr12, 12 ürün) | 3 / 4 / 5 | **7 / 4 / 5** |
| RAG ready (en8, 8 ürün) | 4 / 3 | **4 / 5** |
| İki aşamalı ready (tr12) | (ölçülmemişti; 8-12 toplam malzeme) | **8 / 8 / 4** (16-17 toplam malzemeli fırın/oturtma) |

Ayrıca RAG tool şemasında `minItems = count` yapıldı — bir grubun 3 yerine
2 tarif üretip listeyi 7'ye düşürdüğü gözlenmişti; artık tam sayı zorlanır.
Birim testler 70/70.

## Tavsiye: flag açılmaya hazır mı — **ŞARTLI EVET**

Ölçülen her eksende ayarlı RAG, iki aşamalı yolun bandını yakalıyor veya
geçiyor: katmanlama doğruluğu referansla aynı bantta, çeşitlilik hedefte,
%40-58 daha hızlı, ~4× ucuz, sunucu/ekran eksikleri birebir hizalı. Şartlar:

- **Göz testi:** gerçek cihazda, gerçek envanterle çıktı kalitesinin
  (tarif isimleri, adım kalitesi, TR çeviri akışı) elle onayı — sayısal
  ölçüm dil pürüzünü yakalamaz (Haiku vs Sonnet üslup farkı).
- **UX kabulü:** canlı slot yerine ~20s genel iskelet beklemesi kabul
  ediliyorsa. (İstenirse plan+detay mimarisine geçiş AYRI ve büyük iştir;
  bu session bilinçli girmedi.)
- Açma kararı ve `EXPO_PUBLIC_USE_RAG=true` kullanıcıya ait (varsayılan
  KAPALI bırakıldı).
