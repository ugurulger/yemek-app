---
name: yemek-app
description: Yemek uygulaması (4 sayfalı, AI destekli envanter + tarif uygulaması) üzerinde yapılan TÜM geliştirme işlerinde bu skill'i kullan. Kullanıcı bu projede yeni sayfa, bileşen, ekran, API çağrısı, veritabanı tablosu veya tasarım değişikliği istediğinde — "yemek uygulaması", "envanter", "tarif sayfası", "şef AI", "sepet" gibi ifadeler geçtiğinde — mutlaka bu skill'e uy. Tasarım sistemi, mimari kararlar ve AI prompt formatları burada tanımlıdır.
---

# Yemek App — Proje Skill'i

Bu skill, AI destekli yemek uygulamasının geliştirme kurallarını içerir.
Bu projede kod yazmadan önce bu dosyayı oku ve buradaki kararlara uy.
Buradaki bir kuralı değiştirmen gerekiyorsa önce kullanıcıya sor.

> ## RAG-EN (2026-07-18) — RAG HATTI HEP İNGİLİZCE + KİLER PROMPT DİLİ +
> ## FINE DINING EXACT-SCAN
>
> Canlı ölçüm gerekçeli üç karar (ölçümler: `analysis/rag-analysis.md` §7 —
> RAG kurulumu aynı gün tamamlandı: migration + 10k embedding + 524
> fine-dining etiketi + edge function deploy; `EXPO_PUBLIC_USE_RAG` hâlâ
> KAPALI, açma kararı ayrı verilecek):
>
> - **RAG hattı uygulama dilinden BAĞIMSIZ, HER ZAMAN İngilizce çalışır**
>   (kullanıcı kararı; `lib/rag/generateRecipesRag.ts`): envanter `nameEn`
>   adlarıyla (`simplifyInventory(inventory,'en')`), kiler statik EN
>   çeviriyle, `language: "English"` ile gönderilir; tarifler `language:'en'`
>   damgalanır. Gerekçe: korpus %100 EN (retrieval isabeti EN sorguda
>   belirgin yüksek: 0.755 vs 0.722), EN üretim ~%25 hızlı/ucuz (~29s vs
>   ~38s), Haiku'nun TR çıktısı pürüzlü. TR gösterim üretim SONRASI mevcut
>   çeviri katmanıyla: `recipes.tsx` setRecipes ardından
>   `ensureRecipeTranslations(getAppLanguage())` tetikler (RAG'e sınırlı);
>   çeviri gelene dek EN gösterilir, gelince `useLocalizedRecipes` takas eder.
> - **Prompt'a giden kiler adları çıktı DİLİNDE** (`pantryPromptNames`,
>   `src/i18n/inventoryI18n.ts` — varsayılan 20 malzeme statik i18n
>   etiketiyle çevrilir, LLM YOK; anahtarı olmayan kullanıcı malzemesi
>   adıyla geçer). Kök neden: TR kiler adları EN üretimde modele
>   bağlanamıyor → 8 tarifte 12 sahte eksik + edge function hibrit
>   kısayolunun blokajı (ölçüldü; EN kilerle 12→2 ve kısayol 0.7s'de
>   tetiklendi). İki aşamalı yol `promptPantryNames()` ile aktif dili,
>   RAG kendi içinde hep EN'i kullanır. UI eşleştirmesi zaten iki dilliydi
>   (`expandPantryForMatching`) — DEĞİŞMEDİ.
> - **`match_recipes` fine dining yolu exact-scan'e alındı** (migration
>   `20260718300000`, plpgsql): HNSW post-filter tuzağı — index top-40
>   adayı getirip filtre SONRA uygulanıyordu, etiketliler havuzun ~%5'i
>   olduğundan sorgu bölgesine göre 0-5 referans kalıyordu (makarna
>   sorgularında 0 → fine dining tarifi hiç üretilemedi). filter_tag
>   doluyken materialized CTE ile 524 satırlık alt kümede tam tarama;
>   filter_tag null iken eski HNSW yolu birebir korunur.
>
> Aynı gün, cihaz testindeki kullanıcı geri bildirimiyle eklenen kararlar:
>
> - **Kiler artık ÇİFT DİLLİ** (`PantryItem.nameTr/nameEn`, envanter
>   kalıbıyla aynı): varsayılan 20 malzeme i18n anahtarıyla çevrilmeye devam
>   eder (alanları DOLDURULMAZ); asistanla eklenen ÖZEL malzemeler kaynak
>   dil alanıyla yazılır, karşı dil `backfillPantryTranslations` ile arka
>   planda tamamlanır (tetikler: açılış `_layout`, dil değişimi
>   `languageSync`, asistan ekleme sonrası). Gösterim `pantryDisplayName`
>   (src/i18n/inventoryI18n.ts) — anahtarı olmayan ada `t()` ÇAĞRILMAZ
>   (terminaldeki "EKSİK ÇEVİRİ ANAHTARI: Ekmek/Peynir/Ceviz" uyarılarının
>   kaynağı buydu). `pantryStore.addItems` mükerrer kontrolünü iki dilli
>   varyantlarla yapar ("Ekmek" varken "Bread" ikinci kayıt açmaz).
> - **`parseIngredients` şema düzeltmesi:** tool şemasındaki `name`
>   description'ı sabit "Jenerik Türkçe malzeme adı" idi — sistem promptu
>   çıktı dilini parametrik istese de model şemaya uyup EN modda Türkçe ad
>   üretiyordu (kullanıcı gözlemi: EN girişte onay chip'leri Türkçe).
>   Description dil-nötr yapıldı; dil kuralı yalnız sistem promptunda.
> - **RAG edge function 2/4/2 katman dağılımı (kullanıcı kararı):** tam 2
>   tarif SADECE envanter+kiler (0 eksik), 4 tarif 1-4 eksikli; fine dining
>   İKİLİSİ zıt kurgulu — biri 0 eksik ("hemen pişir" seviyesinde rafine),
>   diğeri tam 2-3 eksikli. Eski "Prefer recipes the user can cook NOW"
>   satırı kaldırıldı (her şeyi 0 eksiğe itiyordu).
> - **Edge function eksik hesabı client'la HİZALANDI:** `namesMatch`
>   (lib/recipes/ingredient-match.ts) edge function'a bilinçli KOPYALANDI
>   (edge bundle app koduna bağımlı olamaz — iki taraf birlikte
>   güncellenmeli) ve üretim sonrası `reconcileRecipes` deterministik
>   düzeltmesi eklendi. Kök neden: model "eksik" diye mevcut malzemenin
>   VARYANTINI seçiyordu (kilerde Vinegar varken "Balsamic Vinegar") —
>   sunucu ham alt-dize eşleştirmesiyle eksik sayarken client namesMatch'le
>   evde-var sayıyor, tarif "alışverişle"den "hemen"e kayıp 2/4 dağılımını
>   bozuyordu (kullanıcı gözlemi: 4 ready). Prompt'a "eksikler GERÇEKTEN
>   yeni malzeme olsun, mevcutun varyantını eksik yazma" kuralı da eklendi.
>   Hibrit kısayolun countMissing'i de aynı eşleştirmeye geçti ("un ⊂
>   sabun" sınıfı yanlış pozitifler sunucudan da temizlendi). Dağılım
>   kotası (2/4) prompt-yönlendirmeli kalır, KOD ZORLAMAZ — MVP-16'nın
>   "kesin katman koddan gelir, dağılım garanti değil" ilkesiyle tutarlı.
> - **Kiler retrieval sorgusuna dahil + kiler-yıldız kuralı:** queryText'e
>   "Pantry staples: ..." satırı eklendi ve prompt'a "makarna/pirinç/bulgur
>   gibi doyurucu kiler malzemeleri gerçek malzemedir, uygunsa en az bir
>   tarifte taşıyıcı yap" kuralı kondu. Önceki "envantere öncelik ver,
>   kilere yaslanma" ifadesi TERS TEPMİŞTİ (kullanıcı gözlemi: kilerde
>   makarna/pirinç varken hiç makarnalı/pirinçli tarif çıkmıyordu —
>   retrieval sorgusunda kiler hiç yoktu, prompt da kileri bastırıyordu).

> ## IG-EĞİTİM GÖRSELLERİ (2026-07-18) — CAROUSEL'E STATİK AI GÖRSELLERİ
>
> IG içe aktarma eğitim carousel'inin (components/import/InstagramEduSheet)
> 3 adımı için görseller RUNTIME'da DEĞİL, tek seferlik script'le üretilir:
> `npx tsx scripts/generate-import-tutorial-images.ts` (anahtar: .env
> `EXPO_PUBLIC_GOOGLE_API_KEY`; model `gemini-3.1-flash-lite-image` — tarif
> görselleriyle aynı aile; argümanla tek adım yeniden üretilebilir: `… 2`).
> Prompt'lar script içinde `STEP_PROMPTS` sabiti — beğenilmezse düzenlenip
> yeniden koşulur; stilize/jenerik arayüz, gerçek IG logosu YOK (telif),
> palet forest/krem/amber, görselde yazı YOK. Çıktı
> `assets/import-tutorial/step-{1,2,3}.png` + manifest
> `components/import/tutorialImages.ts` require'larla YENİDEN YAZILIR.
> Manifest başlangıçta `null` commit'lidir — Metro require'ı bundle anında
> çözdüğü için var olmayan dosyaya require yazılamaz; null iken carousel
> eski placeholder çizimleriyle çalışır (graceful fallback). Görseller
> onaylanınca assets + manifest birlikte commit'lenir.

> ## IG-RESUME (2026-07-18) — INSTAGRAM'I KALDIĞI YERDEN AÇMA
>
> İçe aktarma akışı IG'yi `instagram://app` ile açıyordu — bu, IG'yi ana
> feed'e NAVİGE ettirip son durumu sıfırlıyordu (şikayet: "IG hep baştan
> başlıyor"). Karar: ÇIPLAK şema `instagram://` (components/import/
> ImportFlow.tsx) — path'siz şema iOS'ta uygulamayı yalnızca ön plana
> getirir (resume), kullanıcı bir gönderide kaldıysa oradan devam eder.
> Varyantlar (`instagram://app`, `instagram://feed`) ve Android hostsuz
> şema notu kodda yorumla belgeli; IG yüklü değilse mevcut catch zinciri
> web fallback'ine düşer. Expo Go'da şema davranışı gözlemlenemez
> (storeLinks.ts kalıbıyla aynı sınır) — gerçek cihaz/dev build doğrulaması
> bekliyor, `// DOĞRULA` notu ImportFlow.tsx'te.

> ## ENVANTER-2DİL (2026-07-18) — TEK KAYNAK ÇİFT DİLLİ İSİM; TARİF+SEPET
> ## TUTARLILIĞI (İş 3)
>
> Gözlenen hata: tarif "Mexican Pickle Peppers / Red Pepper Flakes" gibi eş
> anlamlı/karşı dilde adlar üretip envanterdeki "Pickled Jalapenos / Chili
> Flakes"i EKSİK sayıyordu; sepette ürün uygulama dili EN iken "taze kişniş"
> görünüyordu. Üç parça çözüm:
>
> - **3a — çift dilli envanter adı:** `InventoryItem.nameTr/nameEn` (i18n
>   oturumunda eklendi) + persist migration v1 (`store/inventoryStore.ts`:
>   iki alan da boş eski kayıtlara `nameTr = name` yazılır) + AÇILIŞ
>   backfill'i (`app/_layout.tsx`, hidrasyon SONRASI — eksik karşılıklar
>   dil başına TEK toplu çağrıyla arka planda tamamlanır, hata sessiz,
>   sonraki açılışta yeniden dener). Envanter adı çevirisi ucuz modele
>   indirildi: `translateTexts` artık `claude-haiku-4-5` (tam tarif
>   çevirisi `translateRecipeTexts` sonnet'te kaldı). Vision prompt/şemaları
>   DEĞİŞMEDİ — çeviri parse SONRASI adım.
> - **3b — üretim + eksik hesabı envanter adlarını kullanır:** prompt'lara
>   giden envanter listesi AKTİF dilin adlarıyla gider (`simplifyInventory
>   (inventory, language)`) ve ortak detay talimatına "envanterdeki
>   malzemenin adını listedeki yazımıyla AYNEN kullan, eş anlamlı üretme"
>   kuralı eklendi. Modele güvenilmez — deterministik emniyet katmanı:
>   `lib/recipes/ingredient-match.ts` (SAF; küçük harf + aksan temizliği +
>   tekil/çoğul toleransı + token alt-küme kuralı; name VE nameTr VE nameEn
>   kontrol edilir; fuzzy.ts'in token mantığından uyarlandı, mağaza-özel
>   kod taşınmadı). Her detay çağrısı SONRASI (ready-retry kararından ÖNCE)
>   `applyInventoryReconciliation`: eşleşen malzeme in_inventory: true +
>   adı envanterin aktif dildeki adıyla DEĞİŞTİRİLİR; missing_count/
>   match_pct yeniden hesaplanır. RAG akışı (lib/rag/generateRecipesRag)
>   aynı katmandan geçer. `computeMissing` de aynı `namesMatch`'i kullanır
>   (eski ham substring `includes` kalktı — "un" ⊂ "sabun" yanlış pozitifi
>   testle sabitlendi). KISMİ token örtüşmesi ("Red Pepper Flakes" ↔
>   "Chili Flakes") BİLİNÇLİ eşleşmez — eş anlamlıyı önlemek prompt'un işi,
>   lexical katman sadece yazım/dil/çoğul farklarını kapatır.
>   `GENERATION_VERSION` v4 → v5 (eski cache atılır). Testler:
>   tests/unit/ingredient-match.test.ts + recipe-math.test.ts senaryo
>   testleri (70/70 geçiyor, `npx tsx --test`).
> - **3c — sepet dile kilitlenmez:** `CartEntry/CartItemView/
>   CartMissingInput` opsiyonel `nameTr/nameEn` taşır; kanonik `name`
>   tarifin ÜRETİLDİĞİ dildedir (birleştirme/işaretleme anahtarı değişmedi).
>   Karşı dil adı MEVCUT tarif çevirisinden index hizalı alınır
>   (`buildCartMissingInput`'un `counterpart` parametresi — ekstra çeviri
>   çağrısı KURULMADI, kullanıcı kararıyla kapsam sınırı: envanterde
>   olmayan gerçek eksikler çevirisi yoksa üretim dilinde kalır). Render
>   (`CartCategorySection`, `ProductMatchSheet`) aktif dile göre seçer —
>   dil değişince sepettekiler birlikte değişir. TUTARLILIK kuralı: eksik
>   hesabının kanonik kaynağı ORİJİNAL tariftir — detay ekranı, RecipeCard
>   (artık yerelleştirilmiş prop yerine recipeStore'daki orijinali bulur)
>   ve PlanDayPickerSheet, computeMissing + sepete yazmada AYNI orijinal
>   kayıt + iki dilli genişletilmiş envanter/kiler girdisini kullanır
>   (rozet "3 eksik" derken sepete 1 ürün yazma tutarsızlığının kök nedeni
>   buydu: rozet çevrilmiş kopyadan, sepet orijinalden hesaplanıyordu).

> ## MVP-24 (2026-07-18) — MARKET SEPETİ: AH & JUMBO FİYAT KARŞILAŞTIRMA
>
> Sepetteki her malzeme Albert Heijn ve Jumbo'daki en yakın ürünle
> eşleştirilir; satır + toplam bazında fiyatlar yan yana gösterilir.
> Detaylı bakım rehberi: `services/stores/README.md`.
>
> - **Veri katmanı** (`services/stores/`, VisionProvider kalıbı):
>   `StoreProvider` arayüzü + registry (`EXPO_PUBLIC_STORE_PROVIDER=
>   live|mock`; boşsa web'de MOCK — mağaza API'leri tarayıcıda CORS'a
>   takılır, canlı yol web'de HİÇ çalışmaz — native'de live). AH: anonim
>   token'lı unofficial mobil API. Jumbo: `www.jumbo.com/api/graphql`
>   (yalnızca `apollographql-client-name/-version` header'ları; NOT:
>   SupermarktConnector'ın `mobileapi.jumbo.com`'u 2026-07-18'de tamamen
>   yanıtsızdı, bilinçli terk edildi). `createStoreFetcher` (http.ts):
>   timeout 8s + 2 retry (yalnız network/5xx/429) + mağaza başına seri
>   kuyruk ~300ms. Kanarya: `npx tsx tests/store-smoke/run-smoke.ts`
>   (fiyatlar boş görünmeye başlarsa İLK bu koşulur). Fiyatsız ürünler
>   (AH sanal bundle'ları) sonuç listesinin sonuna atılır.
> - **Eşleştirme motoru** (`services/matching/`): katmanlar 0-cache →
>   1-sözlük (`dictionary.ts`, 200 TR→NL kayıt) → 2-fuzzy (`fuzzy.ts`;
>   NL bileşik kelime kuralı: sorgu token'ı ürün token'ının SONUNDAYSA
>   iyi eşleşme "rundergehakt", BAŞINDAYSA türev cezası "uiensoep";
>   birim/miktar uyumu `parseUnitSize`) → 3-LLM (`llm.ts`,
>   claude-haiku-4-5, koşu başına EN FAZLA 2 TOPLU çağrı: çeviri+seçim,
>   tool_choice zorlamalı). Cache/provider'lar motora ENJEKTE edilir
>   (`MatchCache` arayüzü) — eval scripti Node'da dosya cache'iyle, app
>   zustand adaptörüyle çalışır; ileride Supabase drop-in. Canlı eval
>   (`npx tsx tests/match-eval/run-eval.ts`): %95 doğruluk (hedef ≥%85),
>   sıcak koşu 0.033 LLM/malzeme (hedef <0.2). "Eşleşme yok" sonucu
>   BİLEREK cache'lenmez (sortiman düzelince kendini onarır; koşu başına
>   birkaç yüz token'lık tekrar maliyeti kabul edildi).
> - **Store'lar:** `matchCacheStore` (`yemek-app-match-cache`, kalıcı;
>   kullanıcı düzeltmesi source:'user'/güven 100 — otomatik eşleşme
>   EZMEZ, ürün sortimandan düşmedikçe), `storePriceStore`
>   (`yemek-app-store-prices`, 24h TTL), `marketMatchStore` (persist
>   YOK; fingerprint bazlı otomatik koşu + 5dk cache'li health-check).
>   `lib/claude/client.ts`'e `callClaudeForToolInputWithUsage` eklendi
>   (gerçek token/maliyet raporu — `[match-llm]`/`[match-run]` logları).
> - **UI (kullanıcı kararları):** eşleştirme Market açılınca OTOMATİK;
>   fiyatlar SATIR İÇİNDE ("AH €1,29 · Jumbo €1,15", ucuz forest
>   semibold); toplamlar SADECE İŞARETSİZ satırlar. `StoreComparisonCard`
>   ("En uygun" pili + "Bu mağazadan al"), `ProductMatchSheet`
>   (CookbookPickerSheet kalıbı; alternatifler `StoreMatch.candidates`'tan
>   API'siz + Hollandaca manuel arama; seçim = kalıcı düzeltme + toast),
>   düşük güven (<70) amber işaret, eşleşmeyen/fiyatsız taraf "—".
>   Mağaza çökmesi: amber banner + o sütun "—", diğeri çalışır
>   (`EXPO_PUBLIC_STORE_MOCK_FAIL=ah|jumbo|both` ile mock'ta simüle
>   edilir; web önizlemede doğrulandı).
> - **Deeplink** (`lib/market/storeLinks.ts`): app şeması (appie/jumbo,
>   `LSApplicationQueriesSchemes` app.json'a eklendi) → web fallback.
>   Expo Go'da şema sorgusu HEP false → hep web (beklenen davranış).
>   Karşı uygulamanın sepetini doldurmak BİLİNÇLİ kapsam dışı
>   (ToS/güvenlik). Deeplink şemaları gerçek cihazda app yüklüyken
>   doğrulanmadı — `// DOĞRULA` notları storeLinks.ts'te.
> - `design/Tarif_ekle/` fotoğrafları BU özellikle İLGİSİZ (kullanıcı:
>   yanlışlıkla eklendi, başka iş için; yok sayıldı).

> ## ⚠️ MVP-23 (2026-07-12) — REFERANS ZIP TAM İMPLEMENTASYONU:
> ## 5 SEKME + DEFTERLER + PLAN + İÇE AKTARMA AKIŞI
>
> Kullanıcı talimatıyla (`CLAUDE_CODE_PROMPT_v2.md` + `design/reference/
> "Mobil yemek uygulaması UI tasarımı.zip"` içindeki `Mutfagim.dc.html` —
> davranışın TEK kaynağı) fark analizi yapılıp yalnızca eksik/farklı
> kısımlar eklendi. MVP-22'nin "3 sekme" ve "Kayıtlı kapsam dışı"
> kararları GEÇERSİZ:
>
> - **Navigasyon 5 sekme:** Mutfağım `/` · Tarifler `/recipes` · Kayıtlı
>   `/saved` · Plan `/plan` · Market `/market`.
> - **Kayıtlı = Defterlerim** (`app/(tabs)/saved.tsx`, `components/
>   cookbooks/`): kolaj kapaklı defter kartları, gerçek arama + sıralama,
>   defter detayı 4'lü grid (canlı `computeMissing` rozetli), yeşil FAB →
>   içe aktarma. `store/cookbookStore.ts` (kalıcı): cookbooks +
>   savedRecipeIds + **importedRecipes** — deftere eklenen üretilmiş tarif
>   buraya KOPYALANIR ki envanter değişip liste yeniden üretilince
>   kaybolmasın; `lib/recipes/find-recipe.ts` (`useRecipeById`/
>   `useResolveRecipes`) iki kaynağı birleştirir, detay ekranı artık bunu
>   kullanır.
> - **Plan** (`app/(tabs)/plan.tsx`, `store/planStore.ts`): Pzt–Paz
>   ajanda; `PlanEntry` ad/kcal/emoji DENORMALİZE taşır (tarif objesi
>   çözülemese de kart çizilir).
> - **Tarif detayı:** bilgi pilleri → minimal tek satır (`520 kcal · 45 dk
>   · Orta`); 4 yuvarlak ikon buton (Defterler=CookbookPickerSheet ·
>   Plan=PlanDayPickerSheet · Market=eksikleri sepete+toast · Paylaş=toast);
>   Şefe Sor'da geçmiş boşken 3 örnek soru chip'i (gerçek askChef çağrısı).
> - **"+" içe aktarma** (`components/import/`): Tarif Ekle sheet (3
>   seçenek) → Sosyal (IG/TikTok/FB → aynı eğitim) → 3 adımlı IG eğitim
>   carousel'i → "Instagram açılıyor…" (1.9s) → IG feed taklidi → import;
>   Web tarayıcı taklidi → import; Fotoğraftan → `/capture/camera?mode=
>   recipe` (kayıt sonrası "yakında" toast'u, envanter köprüsünü TETİKLEMEZ).
>   Örnek tarifler `lib/recipes/sample-imports.ts` (somon-bowl/menemen,
>   mock DEĞİL — akışın gerçek içeriği); import → Kategorisiz + kayıtlı +
>   detay açılır.
> - **Ortak altyapı:** `components/ui/BottomSheet.tsx` (referans sheet
>   iskeleti), global toast (`store/toastStore.ts` + `components/ui/
>   Toast.tsx`, host `app/_layout.tsx`'te; Animated.View NativeWind
>   className ALMAZ — stiller StyleSheet ile, canlı testte öğrenildi).
> - **Sekme reset:** Kayıtlı ekranı `useFocusEffect` cleanup'ında açık
>   defteri/akışı/aramayı sıfırlar (genel state kuralı).
> - Doğrulama: `npx tsc --noEmit` temiz, 12 birim test geçti, tüm akışlar
>   Expo web önizlemesinde gerçek etkileşimle uçtan uca doğrulandı.

> ## ⚠️ MVP-22 (2026-07-11) — TASARIM ENTEGRASYONU: BU DOSYANIN BAZI
> ## BÖLÜMLERİNİ GEÇERSİZ KILAN BÜYÜK SÜRÜM
>
> Kullanıcı onayıyla `design/CLAUDE_CODE_PROMPT.md` (bağlayıcı görsel spec)
> + `design/01…11-*.png` mockup'ları projeye entegre edildi (orkestrasyon:
> `design/YEMEK_APP_ORKESTRASYON_PROMPT.md`; Faz 1 kontratlar → Faz 2 altı
> paralel sub-agent → Faz 3 entegrasyon → Faz 4 doğrulama). Çelişkide görünüm
> konularında SPEC, mimari konularda orkestrasyon dosyası kazanır. Değişenler:
>
> - **Tasarım sistemi DEĞİŞTİ:** tipografi Fraunces/Outfit → **Newsreader
>   (serif, başlıklar) + Hanken Grotesk (gövde)**; palet stone/emerald →
>   **orman yeşili `#1F4A3D`, krem zemin `#F7F5F0`, amber `#E38A2A`** (tüm
>   tokenlar: `tailwind.config.js` + `lib/theme.ts`; ortak bileşenler:
>   `components/ui/` — Chip, Card, MissingBadge, SectionLabel, PrimaryButton,
>   PhotoPlaceholder). Aşağıdaki "Tasarım sistemi" bölümündeki eski
>   renk/tipografi maddeleri ve MVP-8/10/17-21 kart-tasarım geçmişi ARTIK
>   TARİHİ KAYITTIR — güncel görünümün tek kaynağı spec + `components/ui/`.
>   Eski Fraunces/Outfit fontları hâlâ yüklenir (yalnızca "emin olunamayan
>   ürünler" modalının eski `InventoryRow`'u kullanıyor) — modal
>   birleştirilince kaldırılabilir.
> - **MVP kapsamı GENİŞLEDİ (kullanıcı onayı):** sepet, tarife özel chat
>   (Şefe Sor), tarif tercihleri, Temel Malzemeler (kiler) ve asistanla/
>   kamerayla ekleme artık KAPSAM İÇİ. "Kayıtlı" sayfası hâlâ kapsam dışı.
> - **Navigasyon 3 sekme:** Mutfağım `/` · Tarifler `/recipes` · Market
>   `/market` (spec §7; eski "4 sekme" planı geçersiz). Tam ekran rotalar:
>   `/capture/camera` (expo-camera, basılı-tut video → `store/captureStore`
>   köprüsüyle Mutfağım'daki mevcut analiz akışına), `/capture/assistant`
>   (`?mode=pantry` kilere ekler; `lib/claude/parseIngredients.ts`,
>   claude-haiku-4-5, zorunlu tool-use).
> - **Recipe şeması v3:** `RecipeIngredient` artık `{name, qty, unit, kcal,
>   category, in_inventory}` (qty/kcal varsayılan porsiyon içindir);
>   `Recipe.nutrition_tag` eklendi (kart meta şeridi). Tarif cache
>   `GENERATION_VERSION v3` + zustand persist migrate (eski cache atılır).
>   Parmak izi artık envanter + TERCİHLER + AKTİF KİLER içerir.
> - **Tercihler:** `types/preferences.ts` (4 kategori chip seçimi), Tarifler
>   sekmesi cache geçersizse önce tercih ekranı gösterir; yenile butonu
>   tercihlere döner. Tercih metni üretim promptlarına eklenir (ortak detay
>   bloğunun İÇİNDE — 6 çağrıda aynı olduğu için prefix cache BOZULMAZ).
> - **Kiler:** `store/pantryStore.ts` — `PANTRY_STAPLES` ile aynı 20 varsayılan,
>   kullanıcı chip'le aç/kapar; üretime SADECE aktifler gider
>   (`activePantryNames`), `generateRecipesTwoPhase(inventory, {preferences,
>   activePantryNames, ...})` yeni imza.
> - **Sepet:** `store/cartStore.ts` — ham kayıt tarif+malzeme bazında
>   (`CartEntry`), görünüm `mergeCartEntries` ile malzeme bazında birleşik
>   (kaynak tarif etiketleri). Sepete ekleme aksiyonu TARİF KARTINDAKİ eksik
>   rozetinde (kullanıcı kararı; toggle — tekrar basınca çıkarır). Detayda
>   kişi sayısı değişince tarif sepetteyse miktarlar YENİDEN ölçeklenip
>   senkronlanır (`lib/recipes/cart-helpers.ts`).
> - **Eksik hesabı CANLI:** rozetler, bölümleme ve sıralama üretim anındaki
>   `missing_count`/`in_inventory`'ye değil `computeMissing(recipe, inventory,
>   pantry)`'ye dayanır (`lib/recipes/recipe-math.ts`, saf + birim testli:
>   `npx tsx --test tests/unit/recipe-math.test.ts`). `scaleServings` de orada.
> - **Şefe Sor:** `lib/claude/askChef.ts` (claude-sonnet-4-6, tarif system
>   bloğunda cache'li, geçmiş `store/chefChatStore.ts`'te recipeId bazlı,
>   markdown YASAK — düz metin talimatı).
> - **Metro düzeltmesi:** zustand v5 ESM'i web bundle'ını `import.meta` ile
>   kırıyordu; `metro.config.js`'te `unstable_conditionNames`'ten "import"
>   çıkarıldı (native davranış değişmedi).
> - **Mikrofon (sesli giriş) MVP DIŞI** (buton var, "yakında" uyarısı verir);
>   kamera ilerleme halkası saf View'la (yeni paket YOK, react-native-svg yok).
> - Supabase HÂLÂ KURULU DEĞİL — kalıcılık zustand persist/AsyncStorage;
>   anahtarlar `.env` `EXPO_PUBLIC_*` (mevcut düzen korundu). "Mimari"
>   bölümündeki Supabase/TanStack satırları hedef mimaridir, mevcut durum değil.

> ## ⚠️ i18n (2026-07-18) — ÇOK DİLLİ UYGULAMA (BLOK B)
>
> Uygulama artık **i18next + react-i18next + expo-localization** ile çok
> dilli (EN/TR). Kurulum: `src/i18n/` (dil algılama = cihaz dili, fallback
> **İngilizce**, kullanıcının manuel seçimi AsyncStorage'da; dil seçici
> Mutfağım başlığının sağındaki EN/TR pill'i). Çeviriler:
> `src/i18n/locales/tr.json` + `en.json`.
>
> - **KURAL: Yeni UI metinleri ASLA hardcode edilmez; her yeni metin
>   tr.json + en.json'a anlamlı bir anahtar olarak eklenir ve t() ile
>   kullanılır.** (Alert/placeholder/accessibilityLabel/toast dahil.)
> - Veri-enum DEĞERLERİ (difficulty "Kolay/Orta/Zor", kategori adları,
>   nutrition_tag, kiler adları, PLAN_DAYS...) veri/şema olarak Türkçe
>   KALIR — yalnızca GÖSTERİM `src/i18n/labels.ts` eşlemeleriyle çevrilir.
> - `lib/` ve `services/` modülleri i18n IMPORT ETMEZ (Node eval/test
>   script'leri kırılır) — domain hata mesajları ekran sınırında genel
>   çevrilmiş mesaja çevrilir (orijinal console'a loglanır).
> - **LLM çıktı dili parametrik (B3):** tarif üretimi
>   (`RecipePromptContext.outputLanguage`), Şefe Sor (`askChef` 4. parametre),
>   asistanla ekleme (`parseIngredients` options) ve RAG edge function
>   (`language` alanı) çıktı dilini `llmOutputLanguage()`'dan (src/i18n)
>   alır — aktif uygulama dili LLM çıktısına yansır; enum/şema alanları
>   sabit Türkçe kalır.

## Mimari

- **Framework:** React Native + Expo (managed workflow, TypeScript)
- **Navigasyon:** expo-router, alt tab bar ile 3 sekme (Mutfağım · Tarifler ·
  Market, MVP-22) + tam ekran `/capture/*` ve `/recipe/[id]` rotaları
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

> ⚠️ MVP-22 ile GENİŞLEDİ (bkz. üstteki MVP-22 bloğu): sepet, Şefe Sor
> chat'i, tarif tercihleri, kiler ve kamera/asistan ekleme artık kapsam İÇİ.
> Sadece "Kayıtlı" sayfası kapsam dışı kaldı.

Çekirdek iki özellik (öncelik hâlâ bunlarda):
1. Fotoğraf/video ile ürün tanıma → envantere ekleme (Mutfağım sayfası)
2. Envanterden kaliteli tarif üretimi (Tarifler sayfası)

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
3. **Market (`/market`)** — seçilen tariflerin eksik malzemeleri, malzeme
   KATEGORİSİNE göre gruplu 2 sütun; kaynak tarif etiketleri, işaretleme,
   "Tümünü tamamla"/"Listeyi temizle" (MVP-22; eski `/cart` planının yerini
   aldı).
4. ~~Kayıtlı (`/saved`)~~ — HÂLÂ kapsam dışı, ileride.

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
- **⚠️ İki farklı kart render yolu var (MVP-10 mimari notu):** ana
  kategorili liste artık `components/inventory/InventoryRow.tsx`'i
  KULLANMIYOR — `app/(tabs)/index.tsx` içinde yerel tanımlı `ProductCard`
  (ikon yok, rozet yok, MVP-21'den beri şerit de yok) kullanıyor. "Emin
  olunamayan ürünler" modalı ise HÂLÂ eski `InventoryList`/`InventoryRow`'u
  (ikon + confidence rozetiyle) kullanıyor — bilinçli bir ayrım (MVP-10 görevinin
  kapsamı SADECE `app/(tabs)/index.tsx`'in render katmanıyla
  sınırlandırılmıştı, `InventoryRow.tsx`'e dokunulmadı). Yani modal
  kartları ile ana liste kartları görsel olarak FARKLI — bu kasıtlı,
  birleştirme istenirse `InventoryRow.tsx`'in de kapsama alınması gerekir.
- **"Emin olunamayan ürünler" bildirimi (MVP-10):** artık soluk tek
  satırlık bir link değil, amber vurgu renginde ayrı bir uyarı kartı
  (`bg-amber-50`, `ring-amber-200`, `text-amber-900`, "⚠️ N ürün kontrol
  bekliyor" + `chevron-forward` ikonu) — "Buzdolabım" dış kartının
  DIŞINDA, listenin en üstünde.
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
- **İçecekler envantere alınmaz (MVP-17):** kullanıcı kararı — içecekler
  (su, meyve suyu, gazlı içecek, bira...) envanterde İSTENMİYOR; soslar/
  baharatlar kalır. Kapsam SADECE video akışı (bkz. "Video → envanter" —
  içecek filtresi maddesi); iki aşamalı fotoğraf/fiş akışının prompt'larına
  BİLİNÇLİ dokunulmadı (o akış `category` üretmiyor, davranışı değişmesin
  istendi — fişten içecek gelirse elle silinir). Görüntüleme grubu
  "İçecek & Sos" → **"Sos & Baharat"** (`🧂`) olarak yeniden adlandırıldı;
  şerit rengi (amber-300) aynı. `CATEGORY_GROUPS`'ta `İçecek` anahtarı tip
  gereği duruyor ve "Diğer"e eşlenir (store'da kalmış eski içecek
  kayıtları için geri-dönüş; bir sonraki tam tarama zaten temizler).
  `INVENTORY_CATEGORIES`'teki `'İçecek'` enum değeri SİLİNMEDİ — şemadan
  çıkarılsaydı model içecekleri başka kategoriye zorlardı ve parse filtresi
  yakalayamazdı.
- **Kategori düzeltmeleri: yumurta, turşu/konserve (MVP-18, 2026-07-11):**
  kullanıcı gerçek veriyle test edip yumurtanın "Diğer" yerine "Et &
  Şarküteri" grubunda, turşu/konserve gibi kavanoz/teneke ürünlerin de
  "Sos & Baharat" grubunda görünmesini istedi. Sadece `VIDEO_INVENTORY_PROMPT`
  "Kurallar" listesine iki somut örnek eklendi ("Yumurta → 'Şarküteri'
  kategorisi", "Turşu, konserve gibi kavanoz/teneke ürünler → 'Sos &
  Baharat' kategorisi") — şema (`INVENTORY_CATEGORIES`) ve `CATEGORY_GROUPS`
  eşlemesi DEĞİŞMEDİ (MVP-10/17 ile aynı ilke: sadece modele yönlendirme,
  görüntüleme gruplaması zaten doğru eşliyor). Bu bir garanti DEĞİL, model
  yönlendirmesi — otomatik testi yok, gerçek API çağrısıyla doğrulanmalı.
  İki aşamalı fotoğraf/fiş akışı zaten `category` üretmediği için
  etkilenmedi (o akışa dokunulmadı, önceki oturumdaki kararla tutarlı).
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
  (çıktı tokeni tasarrufu da cabası). **MVP-17 içecek kuralı:** prompt'a
  "içecekleri (su, gazlı içecek, meyve suyu, ayran, bira...) envantere
  ALMA; soslar/baharatlar listelenir; süt içecek DEĞİL" maddesi eklendi
  ve `parseVideoInventoryItems` sonunda `category === 'İçecek'` öğeler
  düşürülür (emniyet kemeri; sıfır-öğe/parse-hatası kontrolünden SONRA
  uygulanır ki sadece içecek içeren yanıt "tekrar dene" hatasına
  dönüşmesin) — bkz. "Tasarım sistemi" MVP-17 maddesi (kapsam kararları).
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
**TAM 6 tarif, 3 katman — katmanlar EKSİK MALZEME SAYISI bazlı** (MVP-16
katman tanımı; MVP-11'in "9 tarif, match_pct yüzdesi bazlı" tanımı ve
MVP-15'in ~3'er dağılımı DEĞİŞTİ — bkz. altta "MVP-16"): 2 tarif `ready`
(`missing_count = 0`, SADECE envanter + kiler malzemeleri), 2 tarif
`closeMatch` (1-2 eksik malzeme), 2 tarif `fewMissing` (3-4 eksik malzeme,
yüksek temperature ile daha yaratıcı). **Kiler listesi MVP-16'da geniş
tutuldu** (kullanıcı kararı: "temel baharatlar/kiler evde var kabul edilir",
`PANTRY_STAPLES` sabiti, `lib/claude/generateRecipes.ts` — tek kaynak,
promptlara interpolate edilir): tuz, karabiber, pul biber, kimyon, kekik,
nane, toz kırmızı biber, sıvı yağ, zeytinyağı, tereyağı, un, şeker, su,
sirke, salça, soğan, sarımsak, makarna, pirinç, bulgur. Bu listedekiler
DAİMA `in_inventory: true` sayılır, eksik olarak gösterilmez. Birleşik
`Recipe` şeması (`types/recipe.ts`):
```
{ name, emoji, kcal, servings, time_min,
  difficulty: "Kolay" | "Orta" | "Zor",
  macros: {protein, karb, yag}, match_pct,
  ingredients: [{ name, in_inventory: boolean }],
  missing_count, steps: string[], chef_tip, image_prompt_en? }
```
`match_pct` alanı tipte ve hesaplamada DURUYOR (eski cache + detay ekranı
uyumu) ama MVP-16'dan beri hiçbir karar mekanizmasında (katmanlama,
sıralama, tekilleştirme, kart rozeti) KULLANILMIYOR — hepsi `missing_count`
ile yapılır. `difficulty` gerçekçi olmalı (çoğu ev yemeği Kolay/Orta, Zor
nadiren). `chef_tip` = tarife özel kısa bir şef önerisi.

**`ingredients` şeması (MVP-11'de `string[]`'ten değişti):** her malzeme
`{ name, in_inventory }` objesidir — `in_inventory` işaretlemesini MODEL
yapar (sistem talimatı: "envanter listesine göre işaretle; kiler
malzemelerini [MVP-16'dan beri geniş `PANTRY_STAPLES` listesi, bkz. yukarı]
in_inventory: true say"). **MVP-15'ten itibaren `match_pct` ve
`missing_count` MODELDEN İSTENMEZ** — ikisi de `ingredients[].
in_inventory`'den KODDA deterministik hesaplanır (bkz. altta "MVP-15",
`toRecipeDetail`): `match_pct = round((in_inventory=true sayısı / toplam
malzeme sayısı) × 100)`, `missing_count` = `in_inventory: false` sayısı.
`image_prompt_en` görsel üretimi içindir (bkz. "Tarif görselleri"): tool
şemasında zorunlu (Claude tarif üretirken doldurur, ekstra LLM çağrısı
YOK) ama TS tipinde opsiyonel (eski cache'lerle uyum).

**UI (app/(tabs)/recipes.tsx, MVP-11; kademeli gösterim MVP-14, tek-tek/
canlı gösterim MVP-15; eksik-bazlı bölümleme MVP-16):** cache'lenmiş/statik
görünümde liste iki bölüm halinde — "Hemen Yapabilirsin"
(`missing_count = 0`, üstte, emerald-900 chip başlık) ve "Küçük Bir
Alışverişle" (kalan tarifler `missing_count`'a göre ARTAN sıralı —
2-eksikliler 4-eksiklilerin üstünde; stone-100 chip başlık; MVP-10 grup
başlığı chip stiliyle tutarlı). Eksikli kartlarda amber-500 "N eksik"
rozeti (`missing_count`) gösterilir; **"%N uyum" rozeti MVP-16'da
KALDIRILDI** (eksik-bazlı kategorileme sonrası bilgi tekrarıydı —
kullanıcı kararı; tarif DETAY ekranındaki %uyum göstergesi duruyor). Tarif detayında
`in_inventory: false` malzemelerin yanında amber "eksik" mikro-rozeti +
sepet ikonu vardır; `in_inventory: true` olanlar sade kalır (tik ikonu
YOK — gürültü olur, bilinçli karar). Üretim SIRASINDA gösterilen kademeli/
canlı görünüm için bkz. altta "MVP-15".

**Tarif önbelleği (MVP-11; sürümleme MVP-16):** `store/recipeStore.ts`
zustand `persist` ile AsyncStorage'a yazılır (`yemek-app-recipes`) ve
tariflerin hangi envanter için üretildiği `inventoryFingerprint`
(sadeleştirilmiş + sıralanmış `{name, qty, unit}` listesinin JSON'u)
olarak saklanır. Envanter DEĞİŞMEDİYSE (parmak izi aynıysa) tarifler
yeniden ÜRETİLMEZ — ekrandaki üret/yenile aksiyonları API'ye gitmeden
mevcut listeyi kullanır. Bu kural MVP-14/15/16'nın mimari
değişikliklerinde de aynen korundu — cache edilen şey her zaman üretim
adımlarından BAĞIMSIZ, final BİRLEŞMİŞ liste (bkz. altta
`mergeRecipeLayers`); üretim sırasındaki ara state (katman/slot durumları)
sadece UI'da tutulur, kalıcı değildir. **MVP-16'dan itibaren parmak izi
`GENERATION_VERSION` önekli** (`"v2|" + JSON`): üretim mantığı
değiştiğinde sürüm artırılır ki envanteri değişmeyen kullanıcının eski
mantıkla üretilmiş cache'i eşleşmeye devam edip yeni akışı sonsuza dek
engellemesin (v2 = MVP-16).

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

**MVP-15 (2026-07-09) — iki aşamalı üretim (isim planı → 9 paralel detay):**
> ⚠️ Bu bölümdeki tarif SAYISI (9), katman eşikleri (match_pct bazlı) ve
> `generateRecipeDetail` imzası MVP-16'da DEĞİŞTİ (bkz. altta "MVP-16") —
> iki aşamalı mimarinin kendisi ve çeşitlilik/canlı-gösterim kararları
> geçerliliğini koruyor.

Karar: Yöntem B — önce TEK Claude çağrısında 9 tarifin İSMİ+kaba planı
üretilir (9'u BİRLİKTE planlandığı için çeşitlilik garantili — model aynı
istek içinde önceki 8 ismi "görür" ve tekrardan kaçınabilir), sonra bu 9
isim 9 BAĞIMSIZ paralel çağrıyla detaylandırılır. Bu hem MVP-14'ün hız
kazanımını korur hem çeşitliliği MVP-11'in tek-çağrı seviyesine geri
getirir hem de doğal bir tek-tek/canlı gösterim sağlar (her detay
kendi hızında dönüp kendi kartını doldurur). `lib/claude/generateRecipes.ts`:

- `generateRecipeNames(inventory)` — Aşama 1: TEK çağrı, `submit_recipe_names`
  aracı, çıktı KISA (sadece isim + `estimated_layer` enum + `estimated_missing`
  string[], TAM tarif detayı İSTENMEZ — hızlı olması için). Sistem talimatı
  (`PLAN_SYSTEM_PROMPT`) 9 tarifi BİRLİKTE, ÇEŞİTLİ planlamasını ister (aynı
  ana malzeme/pişirme tekniğini tekrarlama, farklı öğün tiplerine yay:
  kahvaltı/ana yemek/salata/çorba/atıştırmalık), Türk mutfağı önceliğini ve
  isimlendirme doğruluğu kuralını (MVP-11'den beri değişmeyen "Menemen
  yalnızca domates+biber varsa" kuralı) korur. `estimated_layer`in ~3'er 3'er
  dağılımı HEDEFLENİR ama KATI DEĞİLDİR — çeşitlilik dağılımdan önceliklidir.
- `generateRecipeDetail(name, inventory)` — Aşama 2: TEK tarifin TAM detayını
  üreten çağrı (`submit_recipe_detail` aracı: emoji, kcal, servings, time_min,
  difficulty, macros, ingredients, steps, chef_tip, image_prompt_en). Şema
  BİLEREK `name`, `match_pct`, `missing_count` İSTEMEZ: isim zaten Aşama 1'den
  parametre olarak gelir (kart başlığı planlama anından itibaren tutarlı
  kalsın diye modelin çıktısından ALINMAZ), match_pct/missing_count ise
  `toRecipeDetail` içinde `ingredients[].in_inventory`'den KODDA hesaplanır
  (bkz. yukarıdaki "ingredients şeması" notu). Ortak sistem talimatı
  (`COMMON_DETAIL_SYSTEM_PROMPT`) dokuz çağrıda da BİREBİR AYNI metin —
  `cache_control: ephemeral` ile önbelleklenir (maliyet kuralı).
- `assignRecipeLayer(matchPct)` — **kesin katman ataması KODDA yapılır,
  modelin `estimated_layer` tahminine GÜVENİLMEZ**: match_pct=100 → `ready`,
  75-99 → `closeMatch`, 50-74 → `fewMissing`, <50 → `null` (nadir; hiçbir
  bölümde gösterilmez — modelin planı yanlış çıktıysa yapay doldurma
  yapılmaz). `estimated_layer` SADECE Aşama 2 çağrılarının bölüm bazlı ön
  yerleşimi (kart hangi bölümde iskelet olarak belirsin) için kullanılır;
  detay dönünce kod otomatik doğru bölüme taşır (kendi kendini düzeltme).
- `generateRecipesTwoPhase(inventory, {onPlanReady?, onDetailSettled?})` —
  orkestratör: Aşama 1'i bekler, `onPlanReady` ile 9 planı bildirir, sonra
  9 `generateRecipeDetail` çağrısını `Promise.allSettled` ile EŞZAMANLI
  başlatır (bir tarif başarısız olursa diğerleri ETKİLENMEZ), her biri
  TAMAMLANDIĞI ANDA `onDetailSettled` çağrılır. Sonunda `layer !== null`
  olan `done` tarifleri `mergeRecipeLayers` ile isim bazında tekilleştirip
  (nadir durumda plan aynı ismi iki kez üretirse) döner.

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

**MVP-16 (2026-07-11) — 6 tarif, eksik-malzeme bazlı katmanlama, garantili
"ready" tarifler:** Kullanıcı, tarif süresinin iyi olduğunu ama "Hemen
Yapabilirsin" bölümüne HİÇ tarif düşmediğini bildirdi. Kök neden (iki
parça): (1) Aşama 1 üç tarifi `ready` TAHMİN ediyordu ama Aşama 2'nin detay
promptunda "sadece envanterdeki malzemeleri kullan" diye bir ZORLAMA yoktu
— model gerçekçi tarif kurarken envanter dışı malzeme ekliyor, kod
match_pct'i deterministik hesaplayınca 100 çıkmıyor ve tarif alışveriş
bölümüne kayıyordu; (2) kiler listesi çok dardı (tuz/karabiber/su/sıvı yağ)
— kimyon kullanan her tarif otomatik "eksikli" sayılıyordu. Çözüm
(`lib/claude/generateRecipes.ts`):

- **6 tarif, dağılım ZORUNLU:** `RECIPE_COUNT` 9 → 6; `PLAN_SYSTEM_PROMPT`
  artık TAM 2 `ready` + 2 `closeMatch` (1-2 eksik) + 2 `fewMissing` (3-4
  eksik) ister (MVP-15'in "yaklaşık 3'er, çeşitlilik öncelikli" esnekliği
  kalktı; "ready bulamazsan en basit formatlara in — omlet/makarna/pilav"
  yönlendirmesi eklendi). Çeşitlilik/isimlendirme kuralları aynen duruyor.
  Kod dağılımı doğrulamaz/zorlamaz — model 2/2/2 tutturamazsa akış yine
  çalışır, kesin katman zaten koddan gelir.
- **Katman bazlı detay varyantları (`LAYER_VARIANTS`):**
  `generateRecipeDetail(name, inventory, layerTarget)` artık plandan gelen
  hedef katmanı alır; `system` İKİ blok olur — ilk blok
  (`COMMON_DETAIL_SYSTEM_PROMPT`, 6 çağrıda birebir aynı,
  `cache_control: ephemeral`) + katman kısıtı (cache'siz ikinci blok,
  prefix cache BOZULMAZ). `ready`: "SADECE envanter+kiler, HER malzeme
  in_inventory: true" + `temperature: 0.3`; `closeMatch`: "en fazla 1-2
  dışarıdan" + `0.7`; `fewMissing`: "3-4 dışarıdan, yaratıcı ol" + `1.0`
  (Claude API'de temperature 0-1, varsayılan 1 — "yüksek" = 1.0;
  `temperature` alanı `lib/claude/client.ts`'e eklendi).
- **Ready retry (kullanıcı kararı):** `ready` hedefli tarif buna rağmen
  eksikle dönerse 1 kez düzeltme çağrısı yapılır (user mesajına "şu
  malzemeler envanterde yok: X — tarifi onlarsız yeniden kur" eklenir);
  o da eksikli dönerse olduğu gibi kabul edilir (eksik sayısına göre
  alışveriş bölümüne düşer — MVP-15'in kendi-kendini-düzeltmesi korunur).
- **`assignRecipeLayer(missingCount)`** — match_pct DEĞİL eksik SAYISI:
  0 → `ready`, 1-2 → `closeMatch`, 3+ → `fewMissing`. `null`/gizleme
  KALDIRILDI (UI zaten closeMatch+fewMissing'i tek "Küçük Bir Alışverişle"
  bölümünde birleştiriyor; plan dışı sonuç gizlenmek yerine rozetiyle
  gösterilir). `mergeRecipeLayers` tekilleştirme/sıralaması da
  `missing_count` ARTAN düzene geçti.
- **Geniş kiler** (`PANTRY_STAPLES`, kullanıcı kararı) ve **cache
  sürümleme** (`GENERATION_VERSION`) — bkz. yukarıdaki ilgili bölümler.
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

**Tek-tek/canlı gösterim (`app/(tabs)/recipes.tsx`, `components/recipes/
RecipeLayerSections.tsx`, `components/recipes/RecipeSkeletonCard.tsx`;
MVP-15'te 9, MVP-16'dan beri 6 slot):**
ekran artık `slots: RecipeSlotState[]` (6 eleman, plan sırasına göre sabit
index) tutar — her slot `{name, estimatedLayer, status: loading|done|error,
recipe, actualLayer}`. Üç aşama:
1. **Aşama 1 dönmeden önce** (`slots.length === 0`): isimsiz, bölümsüz 6
   genel iskelet kart (`RecipeSkeletonCard`, `name` prop'u YOK) düz bir
   liste olarak gösterilir — henüz hangi tarifin hangi bölüme gideceği
   bilinmiyor.
2. **Aşama 1 döner dönmez**: 6 slot isim + `estimatedLayer` ile oluşturulur,
   `RecipeLayerSections` bunları `estimatedLayer`e göre bölümlere yerleştirir;
   her kart artık ADI GÖRÜNEN ama gövdesi hâlâ iskelet olan bir karttır
   (`RecipeSkeletonCard`'a `name` verilince başlık gri bar yerine gerçek
   metin olur — "isim biliniyor, detay yükleniyor" hissi).
3. **Her Aşama 2 çağrısı TAMAMLANDIKÇA** o slot TEK BAŞINA `done`/`error`
   olur — kart iskeletten dolu `RecipeCard`'a döner (diğer 5 kart
   ETKİLENMEZ, MVP-14'teki "6 tarif aynı anda göründü" sorunu çözüldü) ve
   bölüm ataması `actualLayer`e (MVP-16'dan beri gerçek `missing_count`)
   göre YENİDEN hesaplanır — tahmin yanlışsa kart doğru bölüme "taşınır";
   alışveriş bölümü içinde dolan kartlar eksik sayısına göre artan sıraya
   girer (`shoppingSortKey`). `error` olan slot için
   o kartın yerinde küçük bir "'{isim}' yüklenemedi / Tekrar dene" satırı
   gösterilir (`retrySlot`, SADECE o tarifi yeniden dener, diğerlerini
   etkilemez). Bölüm başlıkları ("Hemen Yapabilirsin"/"Küçük Bir
   Alışverişle") o bölümde EN AZ bir slot varsa görünür, yoksa gizlenir.
Üretim bitip `setRecipes` (birleşmiş final liste) çağrılınca ekran statik/
cache'lenmiş `RecipeList` render yoluna döner (iki render yolu kasıtlı ayrı
tutuldu — MVP-10'daki `InventoryRow`/`ProductCard` ayrımıyla aynı desen).

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
  tüm tariflerin görselleri birden İSTENMEZ. Kartlar mount oldukça `enqueueRecipeImage`
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
zorunlu tool-use'dur. MVP-15'ten itibaren `lib/claude/generateRecipes.ts`
İKİ ayrı tool tanımlar (bkz. yukarıda "MVP-15"): Aşama 1 için
`submit_recipe_names` (`input_schema`: `RECIPE_COUNT` [MVP-16'dan beri 6]
elemanlı, her biri sadece
`name`+`estimated_layer`+`estimated_missing` — TAM tarif alanları YOK, kısa/
hızlı olsun diye) ve Aşama 2 için `submit_recipe_detail` (`input_schema`:
TEK bir tarifin tüm alanları — `name`/`match_pct`/`missing_count` HARİÇ,
bkz. yukarıda "ingredients şeması"). İkisi de `tool_choice: {type: "tool",
name: "..."}` ile modeli o aracı çağırmaya zorlar (bkz. `lib/claude/
client.ts` — `callClaudeForToolInput`). Yanıt `tool_use` bloğunun `input`
alanından doğrudan bir JS objesi olarak gelir — markdown-fence temizleme
veya JSON.parse yeniden deneme mantığı YOK, sadece minimal bir alan/tip
kontrolü (`toRecipePlan`, `toRecipeDetail`) var. Karar nedeni: tutarlılık
(şema zorunlu tool ile garanti edilir) ve markdown-parse riskinin ortadan
kalkması — Gemini'nin native JSON şema kısıtlı üretimiyle aynı prensip,
Claude'un API yüzeyine uyarlanmış hali.

Aşama 2'nin sistem talimatı İKİ bloktur (MVP-16): ilk blok
(`COMMON_DETAIL_SYSTEM_PROMPT`) `cache_control: {"type": "ephemeral"}` ile
önbelleklenir — altı paralel detay çağrısının HEPSİNDE BİREBİR aynı olduğu
için prefix önbelleği tutar (maliyet kuralı; `system` bir blok dizisi
olarak gönderilir, bkz. `ClaudeSystemBlock`); ikinci blok katman bazlı
varyant kısıtıdır (`LAYER_VARIANTS[layer].constraint`, cache'siz — cache
breakpoint'i İLK bloğun sonunda olduğu için sonrasındaki farklılık prefix
cache'i BOZMAZ). Aşama 1 (`PLAN_SYSTEM_PROMPT`) TEK bir çağrı olduğu
için cache_control KULLANMAZ — tekrar kullanılmayan bir önbellek yazma
maliyeti kendini amorti etmez.

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

- **i18n:** Yeni UI metinleri asla hardcode edilmez; her yeni metin
  `src/i18n/locales/tr.json` + `en.json`'a anahtar olarak eklenir ve `t()`
  ile kullanılır (bkz. üstteki "i18n (2026-07-18)" bloğu).

- Her sayfa ayrı görev olarak geliştirilir; sayfa bitince `npx expo start`
  ile test edilebilir durumda bırak.
- Commit mesajları Türkçe ve conventional format: `feat: envanter sayfası`,
  `fix: sepet rozet sayacı`.
- Yeni paket eklemeden önce mevcut bağımlılıklarla çözülebiliyor mu kontrol et.
- Mock veri yalnızca `__mocks__/` altında yaşar; production kodunda mock
  kalmışsa temizle.
