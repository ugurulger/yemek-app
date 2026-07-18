# RAG İnce Ayar — Baseline Ölçümü (2026-07-18)

> RAG ince ayar session'ı, Faz 1. Harness: `tests/rag-tuning/run-compare.ts`
> (koşum komutu dosya başında). Her iki yol GERÇEK API ile; RAG yolu client
> davranışının birebir kopyası (envanter `nameEn`, kiler statik EN, yanıt
> `applyInventoryReconciliation`'dan geçirilir), iki aşamalı yol doğrudan
> `generateRecipesTwoPhase`. "live eksik" = uygulamanın CANLI rozet hesabı
> (`computeMissing`, iki dilli genişletilmiş envanter + kiler) — katman
> dağılımları bu değere göredir (UI bölümlemesi bunu kullanır).

## Kurulum

- **Envanterler:** `tr12` = 12 ürünlük TR buzdolabı (domates, yumurta, beyaz
  peynir, tavuk göğsü, patates, yoğurt, süt, kıyma, kabak, havuç, limon,
  mantar; nameEn dolu) · `en8` = 8 ürünlük EN set (salmon fillet, spinach,
  heavy cream, parmesan, cherry tomatoes, eggs, potatoes, red bell pepper).
- **Kiler:** 20 varsayılan staple (RAG'e EN, iki aşamalı yola aktif dilde).
- **Tercih yok** (varyans azaltmak için); count=6 (+2 fine dining).
- Tekrar: her yol × envanter için 2 koşu (+1 en8 RAG smoke koşusu).
- Faz 0 doğrulaması: Supabase toplam=10000, embedding_bos=0, fine_dining=524;
  edge function deploy'lu ve davranışı repo koduyla tutarlı (reconcile,
  2/4 prompt, fine dining exact-scan 5 başlık dönüyor → migration canlı).

## Sonuç matrisi

Katman dağılımı = normal 6 tarifin live eksiğe göre 0 / 1-2 / 3+ dağılımı.
Hedef bant (iki aşamalı yolun davranışı, SKILL "Envanter → tarif"):
**2 ready / 4 eksikli (1-2 ve 3-4 karışık), ready ≥ 2**.

| Koşu | Süre | Tarif (FD) | 0 eksik | 1-2 | 3+ | Not |
|---|---|---|---|---|---|---|
| rag/tr12 #1 | 33.7s | 8 (2) | **6** | 0 | 0 | tüm liste "Hemen Yapabilirsin"e yığıldı |
| rag/tr12 #2 | 31.9s | 8 (2) | **4** | 2 | 0 | |
| rag/en8 #1 | 30.5s | 8 (2) | **5** | 1 | 0 | |
| rag/en8 #2 | 30.9s | 8 (2) | **4** | 2 | 0 | |
| rag/en8 smoke | 36.4s | 8 (2) | 3 | 3 | 0 | en dengeli RAG koşusu; yine 3+ yok |
| two/tr12 #1 | 47.5s | 8 (2) | 2 | 4 | 0 | hedef bandın kendisi |
| two/tr12 #2 | 48.5s | **7 (1)** | 3 | 2 | 1 | 1 FD detayı max_tokens'a takıldı, tarif düştü |
| two/en8 #1 | 35.6s | 8 (2) | 2 | 2 | 2 | |
| two/en8 #2 | 32.2s | 8 (2) | 2 | 2 | 2 | |

## Bulgular

### B1 — Katman dağılımı RAG'in ana zayıflığı (Faz 2 madde 2)

RAG'de normal 6 tarifin 3-6'sı 0 eksik; **hiçbir koşuda 3+ eksikli tarif
yok**. Prompt "exactly 2 cookable now, others 1-4 shopping" dese de model
neredeyse her şeyi envantere sığdırıyor. "Küçük Bir Alışverişle" bölümü
zayıf/boş kalıyor, yaratıcı-alışverişli katman hiç oluşmuyor. İki aşamalı
yol aynı envanterlerde 2/4/0 – 2/2/2 bandında (katman başına ayrı çağrı +
kod içinde katman kısıtı sayesinde).

### B2 — Çeşitlilik: retrieval tekdüzeliği üretimi domine ediyor (madde 3)

- Retrieval deterministik: aynı envanter → aynı 8 referans (iki koşuda da
  birebir aynı başlıklar; topSim ≈ 0.761 her iki envanterde).
- `tr12` referansları isabetli VE çeşitli (Feta Eggs, Cilbir, Greek Chicken
  Pasta, Orzo...) → üretim de çeşitli (kavurma/fırın/çorba/frittata/makarna
  dağılmış). Retrieval isabeti EN sorguda sorunsuz.
- `en8` referansları **8/8 somon** (fine dining 5/5 somon) → üretim 6
  normal tarifin 4-6'sı + FD 2/2 somon bazlı. Prompt'taki "no two recipes
  may share the same main ingredient combination" kuralı referans
  yığılmasına yenik düşüyor. (İki aşamalı yol aynı envanterde somonu 2-3
  tarifte kullanıp yumurta/patates/biber/çorba çeşitliliği kuruyor.)
- Koşular ARASI tutarlılık yüksek ama monotonluğa kayıyor: fine dining
  tarifleri iki koşuda neredeyse birebir aynı ("Pan-Seared ... Beurre
  Blanc" ikişer kez) — deterministik retrieval + tek prompt kalıbının
  yan etkisi.

### B3 — Sunucu/istemci eksik sayısı uyumsuzluğu: edge yalnız YÜKSELTİYOR

Edge `reconcileRecipes` modeli sadece eksik→var yönünde düzeltir;
modelin iyimser `in_inventory: true` işaretini (envanterde OLMAYAN malzeme)
**düşürmez**. Örnek (rag/en8#2 FD): "Lemon Juice" sunucuda 0 eksik sayıldı,
uygulama rozeti 1 eksik gösterir; ikinci FD sunucuda 3, ekranda 5 eksik.
Sunucunun katman hedeflemesi kendi saydığı rakamla yapılıyor → dağılım
ekranda kayıyor. (Faz 2 madde 2'nin "deterministik doğrulama" ayağı: iki
yönlü mutabakat gerekli. Not: edge'deki eşleştirme zaten namesMatch
kopyası — rag-analysis'teki "naif alt-dize" bilgisi bayat, RAG-EN'de
değişmişti.)

### B4 — Süre ve maliyet

- **Süre:** RAG 30-34s (5 koşu ort. ~32.7s) · iki aşamalı TR ~48s,
  EN ~34s. RAG, TR moduna karşı ~%33 hızlı; EN modda fark küçük.
- **Maliyet (iki aşamalı, ÖLÇÜLDÜ):** koşu başına 10-11 Sonnet çağrısı;
  ort. in ≈ 8.9K + cacheW ≈ 13K (ilk koşu) / cacheR ≈ 14K, out ≈ 12.6K
  → **≈ $0.20-0.28/koşu** (Sonnet 4.6 fiyatlarıyla).
- **Maliyet (RAG, TAHMİN):** 2 Haiku çağrısı + 1 embedding; usage henüz
  loglanmıyor (Faz 2 madde 5) → kaba tahmin **≈ $0.04-0.05/koşu (~5-6×
  ucuz)**. Kesin rakam logging sonrası.
- **stop_reason:** iki aşamalıda 41 çağrının 2'sinde `max_tokens` (TR
  detay, 2048 bütçe) — biri fine dining tarifini DÜŞÜRDÜ (two/tr12#2
  7 tarif döndü). RAG'de stop_reason görünmüyor (madde 5 ekleyecek);
  gözlemlenen 5 koşuda 8/8 tarif tam döndü, kesilme izi yok.

### B5 — Faz 2 madde 1 (EN sorgu) ZATEN KODDA

`generateRecipesRag.ts` envanteri `simplifyInventory(matchInventory, 'en')`
ile (nameEn; eksikse toplu çeviriyle tamamlayıp) gönderiyor, kiler
`pantryPromptNames(..., 'en')` — RAG-EN kararının parçasıydı. Madde 1 için
yapılacak iş YOK; baseline'daki retrieval isabeti bunu doğruluyor (tr12
envanteri EN sorguyla Cilbir/Feta Eggs getirdi).

## Faz 2'ye taşınan öncelikler (ölçüme göre)

1. **Madde 5 (önce, ucuz):** edge'e `[rag-gen]` stop_reason + usage
   logu — maliyet/kesilme ölçümü sonraki adımların ön koşulu.
2. **Madde 2 (ana iş):** dağılım promptunu katman bazında sertleştir
   (2×0 / 2×(1-2) / 2×(3-4)) + `reconcileRecipes`'e AŞAĞI yönlü düzeltme
   (in_inventory: true ama envanter+kilerde namesMatch karşılığı yok →
   false) → sunucu katmanı = ekran katmanı.
3. **Madde 3 (çeşitlilik):** önce prompt ("aynı ana malzeme en fazla 2
   tarifte" + referans yığılmasına karşı uyarı); yetmezse 2×3 bölünmüş
   üretim (plan çağrısı OLMADAN — plan+detay mimarisi bu session'da yok).
4. **Madde 4:** kısayol (`source:"database"`) tarifinde `image_prompt_en`
   başlık+ilk malzemelerle zenginleştirilir (bugün yalnız başlık).

Ham koşu çıktıları: scratchpad `rag-runs/baseline-*.json` (session-yerel);
özet log bu rapora işlendi.
