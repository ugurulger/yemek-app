# RAG çeşitlilik ayarı — ölçüm ve sonuçlar (2026-08-02)

Kullanıcı şikayeti: "Tarif üretimi çok benzer sonuçlar veriyor." Bu oturum,
koşular ARASI monotonluğu ölçüp (tuning raporunun "Kalan açıklar" #2/#3'ünün
genelleşmiş hali) yapısal çeşitlilik katmanları ekledi.

Ölçüm araçları:
- `npx tsx tests/rag-tuning/run-compare.ts --paths rag --runs 3 --inventories tr12,en8 --label <etiket>`
  (2026-08-02'den itibaren: koşular arası rolling `avoid` listesi gönderir —
  client `recipeStore.recentNames` davranışının kopyası; `stepsText` metriği)
- `npx tsx tests/rag-tuning/diversity-metrics.ts <sonuç.json>` (yeni):
  benzersiz yemek oranı, yakın-ad çifti, yıldız yoğunluğu, teknik çeşitliliği,
  **arketip tekrarı** (yıldız+teknik kombinasyonu — ad değişse de "aynı yemek
  yine" hissinin metriği) ve retrieval örtüşmesi.

## 1) Baseline (deploy önceki edge, 3 koşu × 2 envanter)

Ham veri: `tests/rag-tuning/results/div-baseline-2026-08-02T00-02-19-137Z.json`

| Metrik | rag/tr12 | rag/en8 |
|---|---|---|
| retrieval örtüşmesi (koşular arası) | **%100** | **%100** |
| arketip tekrar oranı (2.+ koşular) | **%75** | **%75** |
| benzersiz arketip oranı | %46 | %38 |
| yıldız yoğunluğu | chicken %33 | **salmon %50** |
| benzersiz yemek oranı (ad bazlı) | %96 | %92 |
| koşular arası ad tekrarı | %6 | %13 |

Kök neden zinciri: **retrieval tümüyle deterministik** (aynı envanter → her
koşuda aynı 8 referans) + sabit prompt → model her koşuda aynı arketiplere
kilitleniyor. Ad bazlı benzersizlik yüksek GÖRÜNÜYOR (%92-96) ama yanıltıcı:
model adları değiştiriyor, yemeği değiştirmiyor — fine dining ilk tarifi
3/3 koşuda "Pan-Seared Salmon with Creamed Spinach ..." / "Pan-Seared
Chicken Breast ..." varyantıydı. Kullanıcının gördüğü gerçek metrik arketip
tekrarı: **%75**.

## 2) Uygulanan katmanlar

Üç katmanlı mevcut çeşitlilik savunmasının (koşu İÇİ) üzerine, koşular
ARASI dört katman (salt-prompt tavanının yetmediği ölçülmüştü — yapısal
bileşenler önde):

1. **Retrieval jitter** (`jitterCandidates`, edge): benzerlik skoruna
   uniform gürültü (`RAG_RETRIEVAL_JITTER`, varsayılan 0.03; 0 = eski
   davranış) → komşu adaylar yer değiştirir, ardışık üretimler farklı
   referans altkümeleri görür. `matches[0]` MUAF (hibrit kısayol eşiği +
   dominantToken zemini deterministik kalır). MMR yerine bu + mevcut
   başlık-token tavanı (diversifyMatches zaten greedy MMR eşdeğeri;
   embedding'ler RPC'den dönmediği için gerçek MMR ayrı migration isterdi).
2. **Son-N tekrar yasağı** (client→edge): `recipeStore.recentNames`
   (yuvarlanan 24 ad, persist) → `avoid` alanı → prompt'ta "RECENTLY
   GENERATED — DO NOT REPEAT (aynı yıldız+teknik = tekrar)" bloğu; FD
   prompt'una ek "bariz tabaktan kaçın / tekniği değiştir" kuralı.
3. **Çeşitlilik kotası** (prompt, sayılabilir): "tek ana malzeme en fazla
   2 tarifte yıldız + sette en az 3 teknik ailesi" (mevcut jenerik DIVERSE
   kuralının somutlaştırılması).
4. **Yakın-ad dedupe** (edge, kod): final normal sette başlık-token Jaccard
   ≥ 0.6 → aynı yemek; eksik sayısı düşük olan kalır ("iki scrambled-eggs"
   sınıfı). Avoid ihlalleri DÜŞÜRÜLMEZ (liste 6'nın altına inmesin) —
   loglanır + `generation.diversity` alanında sayılır.

Cache: `GENERATION_VERSION` v5 → **v6** (eski monotonlukla üretilmiş
cache'ler bir kez yenilensin).

## 3) Doğrulama durumu

### 3a. Lokal mantık doğrulaması (yapıldı, 2026-08-02)

Edge function Deno-shim'le Node'da sahte fetch'lerle koşuldu (scratchpad
`test-edge-logic.mjs`; gerçek ağ yok, saf mantık):

- Retrieval jitter: 3 çağrıda referans kümeleri FARKLILAŞIYOR, `matches[0]`
  sabit (kısayol zemini korunuyor). ✓
- Yakın-ad dedupe: "Feta Egg Scramble" / "Scrambled Eggs with Feta" çifti
  tekilleşti (`droppedNearDup: 1`). İlk sürümde `titleTokens` (≥4 harf
  filtresi "egg"i düşürüyor, "scramble/scrambled" eki eşleşmiyor) dedupe'u
  SESSİZCE etkisiz bırakıyordu — `tokenize`+`tokenMatches`'e geçildi. ✓
- Prompt blokları: normal avoid + kota, FD avoid + "SURPRISE" kuralı. ✓
- `generation.diversity` gözlemlenebilirlik alanı dönüyor. ✓

### 3b. Üretim ölçümü (deploy sonrası, 2026-08-02)

Deploy: kullanıcı keychain onayı verdi, `supabase functions deploy` başarılı.
Ham veri: `tests/rag-tuning/results/div-after-2026-08-02T00-31-55-385Z.json`
(harness koşular arası rolling `avoid` gönderdi — client davranışının kopyası).

| Metrik | tr12 önce → sonra | en8 önce → sonra |
|---|---|---|
| retrieval örtüşmesi | %100 → **%28** | %100 → **%45** |
| arketip tekrar oranı | %75 → **%44** | %75 → **%56** |
| benzersiz arketip oranı | %46 → **%63** | %38 → **%48** |
| yıldız yoğunluğu | chicken %33 → tomato %29 | **salmon %50 → %30** |
| teknik çeşitliliği | 9 → 10 | 6 → 7 |
| süre | ~21s → ~21s (değişmedi) | ~20s → ~21s |

Fine dining monotonluğu (baseline'da 3/3 koşuda aynı "pan-seared + creamed"
arketipi) kırıldı: tr12 FD setleri terrine / en papillote / en croûte /
tartare çeşitliliğinde; en8'de ilk koşu (avoid listesi henüz boş —
beklenen) yine pan-seared salmon açtı ama #2/#3 tamamen farklı kurgular
üretti. Gözlemlenebilirlik alanı çalışıyor: `avoidCount` 0→8→16 birikti,
1 yakın-ad düşümü (en8#1), 1 avoid ihlali (en8#3 — düşürülmedi, loglandı;
48 tarifte 1 = prompt yasağı büyük oranda tutuyor).

Notlar / kalan açıklar:
- en8 arketip tekrarının bir kısmı yapısal: 8 ürünlük dar envanterde somon
  tek "yıldızlanabilir" protein — %30 yoğunluk makul taban.
- Yakın-ad dedupe tetiklenince liste 1 eksilebiliyor (en8#1: 7 tarif) —
  bilinçli trade-off (minItems'ı korumak için yeniden üretim çağrısı
  KURULMADI; sıklık düşük).
- FD "sürpriz" kuralı ikinci (alışveriş-katmanlı) FD tarifinde envanter
  dışı yıldıza kayabiliyor (en8: scallops/halibut) — tasarım içi (2-3
  alışveriş hakkı) ama göze batarsa kural yumuşatılabilir.
