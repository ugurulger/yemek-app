---
name: yemek-app
description: Yemek uygulaması (4 sayfalı, AI destekli envanter + tarif uygulaması) üzerinde yapılan TÜM geliştirme işlerinde bu skill'i kullan. Kullanıcı bu projede yeni sayfa, bileşen, ekran, API çağrısı, veritabanı tablosu veya tasarım değişikliği istediğinde — "yemek uygulaması", "envanter", "tarif sayfası", "şef AI", "sepet" gibi ifadeler geçtiğinde — mutlaka bu skill'e uy. Tasarım sistemi, mimari kararlar ve AI prompt formatları burada tanımlıdır.
---

# Yemek App — Proje Skill'i

Bu skill, AI destekli yemek uygulamasının geliştirme kurallarını içerir.
Bu projede kod yazmadan önce bu dosyayı oku ve buradaki kararlara uy.
Buradaki bir kuralı değiştirmen gerekiyorsa önce kullanıcıya sor.

> ## RAG-EN (2026-07-18) — RAG HATTI KARARLARI
>
> RAG kurulumu tamam (migration + 10k embedding + 524 fine-dining etiketi +
> edge function deploy); `EXPO_PUBLIC_USE_RAG` hâlâ KAPALI, açma kararı
> ayrı verilecek. Ölçüm gerekçeleri: `analysis/rag-analysis.md` §7.
>
> - **KURAL: RAG hattı uygulama dilinden BAĞIMSIZ, HEP İngilizce çalışır**
>   (kullanıcı kararı; `lib/rag/generateRecipesRag.ts`): envanter `nameEn`,
>   kiler statik EN çeviri, `language: "English"`; tarifler `language:'en'`
>   damgalanır. Gerekçe: korpus %100 EN (retrieval isabeti EN sorguda
>   belirgin yüksek), EN üretim ~%25 hızlı/ucuz, Haiku'nun TR çıktısı
>   pürüzlü. TR gösterim üretim SONRASI çeviri katmanıyla
>   (`ensureRecipeTranslations`; çeviri gelene dek EN gösterilir).
> - **KURAL: prompt'a giden kiler adları çıktı DİLİNDE** (`pantryPromptNames`,
>   `src/i18n/inventoryI18n.ts` — statik i18n, LLM YOK; anahtarı olmayan
>   kullanıcı malzemesi adıyla geçer). TR kiler adları EN üretimde modele
>   bağlanamıyordu (sahte eksikler + hibrit kısayol blokajı, ölçüldü).
>   İki aşamalı yol aktif dili, RAG hep EN'i kullanır; UI eşleştirmesi
>   zaten iki dilli (`expandPantryForMatching`).
> - **`match_recipes` fine dining yolu exact-scan** (migration
>   `20260718300000`): HNSW post-filter tuzağı — top-40 aday içinde
>   etiketliler (~%5) sorgu bölgesine göre 0'a düşebiliyordu. `filter_tag`
>   doluyken 524 satırlık alt kümede tam tarama; null iken eski HNSW yolu
>   birebir korunur.
> - **Kiler ÇİFT DİLLİ** (`PantryItem.nameTr/nameEn`): varsayılan 20
>   malzeme i18n anahtarıyla çevrilmeye devam eder (alanlar DOLDURULMAZ);
>   asistanla eklenen ÖZEL malzemeler kaynak dille yazılır, karşı dil
>   `backfillPantryTranslations` ile arka planda (açılış, dil değişimi,
>   asistan ekleme). Gösterim `pantryDisplayName` — **KURAL: anahtarı
>   olmayan ada `t()` ÇAĞRILMAZ** ("EKSİK ÇEVİRİ ANAHTARI" uyarılarının
>   kaynağıydı). `pantryStore.addItems` mükerrer kontrolü iki dilli
>   varyantlarla ("Ekmek" varken "Bread" ikinci kayıt açmaz).
> - **KURAL: tool şema description'ları dil-NÖTR olmalı** —
>   `parseIngredients`'taki sabit "Jenerik Türkçe malzeme adı" description'ı
>   parametrik dil talimatını eziyordu (EN modda TR chip'ler); dil kuralı
>   yalnız sistem promptunda durur.
> - **Edge function 2/4/2 dağılımı (kullanıcı kararı):** 2 tarif 0 eksik
>   (SADECE envanter+kiler), 4 tarif 1-4 eksikli; fine dining İKİLİSİ zıt
>   kurgulu (biri 0, diğeri 2-3 eksik). "Prefer recipes the user can cook
>   NOW" satırı kaldırıldı (her şeyi 0 eksiğe itiyordu). Dağılım
>   prompt-yönlendirmeli, KOD ZORLAMAZ (MVP-16 ilkesi).
> - **KURAL: edge function'daki `namesMatch` kopyası client'la BİRLİKTE
>   güncellenir** (edge bundle app koduna bağımlı olamaz — bilinçli kopya)
>   + üretim sonrası `reconcileRecipes` deterministik düzeltme (model
>   mevcut malzemenin VARYANTINI eksik yazıyordu — prompt'a "mevcudun
>   varyantını eksik yazma" kuralı da eklendi); hibrit kısayolun
>   countMissing'i aynı eşleştirmeyi kullanır.
> - **Kiler retrieval sorgusunda + kiler-yıldız kuralı:** queryText'e
>   "Pantry staples: ..." satırı; prompt'ta "makarna/pirinç/bulgur gerçek
>   malzemedir, uygunsa taşıyıcı yap". Önceki "kilere yaslanma" ifadesi
>   TERS TEPMİŞTİ (kilerde makarna varken hiç makarnalı tarif çıkmıyordu).

> ## IG-EĞİTİM GÖRSELLERİ (2026-07-18)
>
> - **KURAL: IG eğitim carousel'inin (`components/import/InstagramEduSheet`)
>   görselleri RUNTIME'da üretilmez** — tek seferlik script: `npx tsx
>   scripts/generate-import-tutorial-images.ts [adım]` (.env
>   `EXPO_PUBLIC_GOOGLE_API_KEY`, model `gemini-3.1-flash-lite-image`;
>   prompt'lar script içindeki `STEP_PROMPTS`, beğenilmezse düzenlenip
>   yeniden koşulur). İçerik: stilize/jenerik arayüz, gerçek IG logosu YOK
>   (telif), palet forest/krem/amber, görselde yazı YOK.
> - **KURAL: manifest (`components/import/tutorialImages.ts`) başlangıçta
>   `null` commit'lidir; var olmayan dosyaya require YAZILMAZ** — Metro
>   require'ı bundle anında çözer, dosya yokken bundle kırılır. `null` iken
>   carousel placeholder çizimleriyle çalışır (graceful fallback). Script,
>   PNG'leri (`assets/import-tutorial/step-{1,2,3}.png`) + manifest'i
>   birlikte yazar; onaylanınca birlikte commit'lenir.

> ## IG-RESUME (2026-07-18)
>
> **KURAL: Instagram ÇIPLAK şemayla açılır — `instagram://`, path YOK
> (`components/import/ImportFlow.tsx`).** `instagram://app`/`instagram://feed`
> IG'yi ana feed'e navige edip son durumu sıfırlar (kullanıcı şikayetiydi);
> path'siz şema iOS'ta uygulamayı yalnızca ön plana getirir (resume). IG
> yüklü değilse catch zinciri web fallback'ine düşer. Expo Go'da şema
> davranışı gözlemlenemez — gerçek cihaz doğrulaması bekliyor (`// DOĞRULA`
> ve varyant notları kodda yorumla).

> ## ENVANTER-2DİL (2026-07-18) — TEK KAYNAK ÇİFT DİLLİ İSİM
>
> Kök sorun: tarif eş anlamlı/karşı dilde ad üretince envanterdeki ürün
> yanlışlıkla "eksik" sayılıyordu; sepette adlar uygulama diline uymuyordu.
> Kararlar (üretim/eşleştirme kuralları "Envanter → tarif" bölümüne
> gömülüdür — "İki dillilik + deterministik mutabakat" maddesi; cache
> sürümü "Tarif önbelleği"nde, v5):
>
> - **KURAL: `InventoryItem`/`PantryItem` adları çift dilli** (`nameTr`/
>   `nameEn`; persist migration eski kayda `nameTr = name` yazar). Eksik
>   karşılıklar arka planda backfill edilir (`app/_layout.tsx` hidrasyon
>   sonrası + dil değişimi + asistan ekleme; dil başına TEK toplu çağrı,
>   hata sessiz, sonraki açılışta yeniden dener). Envanter adı çevirisi
>   `translateTexts` = `claude-haiku-4-5` (ucuz); TAM tarif çevirisi
>   `translateRecipeTexts` sonnet'te. Vision prompt/şemaları DEĞİŞMEDİ —
>   çeviri parse SONRASI adımdır.
> - **KURAL: sepet dile kilitlenmez ama kanonik `name` tarifin ÜRETİLDİĞİ
>   dildedir** (birleştirme/işaretleme anahtarı) — `CartEntry`/görünümler
>   opsiyonel `nameTr/nameEn` taşır, render aktif dile göre seçer. Karşı
>   dil adı MEVCUT tarif çevirisinden index hizalı alınır
>   (`buildCartMissingInput` `counterpart` — ekstra çeviri çağrısı
>   KURULMADI, bilinçli kapsam sınırı: çevirisi olmayan eksik üretim
>   dilinde kalır).
> - **KURAL: eksik hesabının kanonik kaynağı ORİJİNAL tariftir** — detay
>   ekranı, RecipeCard (yerelleştirilmiş prop yerine recipeStore'daki
>   orijinali bulur) ve PlanDayPickerSheet, `computeMissing` + sepete
>   yazmada AYNI orijinal kayıt + iki dilli genişletilmiş envanter/kiler
>   girdisini kullanır. (Rozet çevrilmiş kopyadan, sepet orijinalden
>   hesaplanınca "rozet 3 eksik / sepete 1 ürün" tutarsızlığı doğmuştu.)
> - Testler: `tests/unit/ingredient-match.test.ts` + `recipe-math.test.ts`
>   (`npx tsx --test`, 70/70).

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
>   sıcak koşu 0.033 LLM/malzeme (hedef <0.2). **KURAL: "eşleşme yok"
>   sonucu BİLEREK cache'lenmez** — sortiman düzelince kendini onarır;
>   koşu başına birkaç yüz token'lık tekrar maliyeti kabul edildi.
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

> ## ⚠️ MVP-23 (2026-07-12) — 5 SEKME + DEFTERLER + PLAN + İÇE AKTARMA
>
> Davranışın TEK kaynağı: `CLAUDE_CODE_PROMPT_v2.md` + `design/reference/`
> zip'indeki `Mutfagim.dc.html`. MVP-22'nin "3 sekme" ve "Kayıtlı kapsam
> dışı" kararları GEÇERSİZ:
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
>   iskeleti; sonradan eklenenler: backdrop opaklığı sheet hareketiyle
>   SENKRON kademeli animasyon, zincirleme sheet geçişlerinde native Modal
>   çakışmasını önleyen modül-seviyesi KAPANIŞ KİLİDİ, ve isim yazarken
>   klavyenin sheet'i örtmemesi için `KeyboardAvoidingView` — cookbook
>   isimlendirme şikayetiyle geldi), global toast (`store/toastStore.ts` +
>   `components/ui/Toast.tsx`, host `app/_layout.tsx`'te; Animated.View
>   NativeWind className ALMAZ — stiller StyleSheet ile, canlı testte
>   öğrenildi).
> - **Sekme reset:** Kayıtlı ekranı `useFocusEffect` cleanup'ında açık
>   defteri/akışı/aramayı sıfırlar (genel state kuralı).

> ## ⚠️ MVP-22 (2026-07-11) — TASARIM ENTEGRASYONU (karar özeti)
>
> `design/CLAUDE_CODE_PROMPT.md` (bağlayıcı görsel spec) + mockup'lar
> entegre edildi. **KURAL: çelişkide görünüm konularında SPEC, mimari
> konularda orkestrasyon dosyası (`design/YEMEK_APP_ORKESTRASYON_PROMPT.md`)
> kazanır.** (Faz'lı entegrasyon süreci: references/HISTORY.md.)
>
> - **Tasarım sistemi:** tipografi **Newsreader (serif, başlıklar) +
>   Hanken Grotesk (gövde)**; palet **orman yeşili `#1F4A3D`, krem
>   `#F7F5F0`, amber `#E38A2A`** (tokenlar: `tailwind.config.js` +
>   `lib/theme.ts`; ortak bileşenler: `components/ui/` — Chip, Card,
>   MissingBadge, SectionLabel, PrimaryButton, PhotoPlaceholder). Güncel
>   görünümün TEK kaynağı spec + `components/ui/`. Eski Fraunces/Outfit
>   fontları hâlâ yüklenir (yalnız "emin olunamayan ürünler" modalının eski
>   `InventoryRow`'u için) — modal birleştirilince kaldırılabilir.
> - Kapsam genişledi (sepet, Şefe Sor, tercihler, kiler, kamera/asistan) —
>   bkz. "MVP kapsamı". Sekme sayısı o gün 3'tü; MVP-23'te 5 oldu.
> - **Tam ekran rotalar:** `/capture/camera` (expo-camera, basılı-tut
>   video → `store/captureStore` köprüsüyle Mutfağım'daki analiz akışına),
>   `/capture/assistant` (`?mode=pantry` kilere ekler;
>   `lib/claude/parseIngredients.ts`, claude-haiku-4-5, zorunlu tool-use).
> - **Recipe şeması v3:** `RecipeIngredient` = `{name, qty, unit, kcal,
>   category, in_inventory}` (qty/kcal varsayılan porsiyon içindir);
>   `Recipe.nutrition_tag` (kart meta şeridi). Cache sürümü/parmak izinin
>   GÜNCEL hali: "Tarif önbelleği" (v5; kiler v4'te parmak izinden çıktı).
> - **Tercihler:** `types/preferences.ts` (4 kategori chip seçimi); Tarifler
>   sekmesi cache geçersizse önce tercih ekranı, yenile butonu tercihlere
>   döner. **KURAL: tercih metni ORTAK detay bloğunun İÇİNDE** (tüm detay
>   çağrılarında aynı olduğu için prefix cache BOZULMAZ).
> - **Kiler:** `store/pantryStore.ts` — `PANTRY_STAPLES` ile aynı 20
>   varsayılan, chip'le aç/kapa; üretime SADECE aktifler gider
>   (`activePantryNames`).
> - **Sepet:** `store/cartStore.ts` — ham kayıt tarif+malzeme bazında
>   (`CartEntry`), görünüm `mergeCartEntries` ile malzeme bazında birleşik
>   (kaynak tarif etiketleri). Sepete ekleme TARİF KARTINDAKİ eksik
>   rozetinde (toggle). Detayda kişi sayısı değişince sepetteki miktarlar
>   yeniden ölçeklenir (`lib/recipes/cart-helpers.ts`). İki dilli sepet
>   alanları: ENVANTER-2DİL bloğu.
> - **KURAL: eksik hesabı CANLI** — rozet/bölümleme/sıralama üretim
>   anındaki değerlere değil `computeMissing(recipe, inventory, pantry)`'ye
>   dayanır (`lib/recipes/recipe-math.ts`, saf + birim testli;
>   `scaleServings` de orada).
> - Şefe Sor: bkz. "Tarif chat'i" bölümü.
> - **KURAL: `metro.config.js` `unstable_conditionNames`'ten "import"
>   ÇIKARILDI — geri EKLEME:** zustand v5 ESM'i web bundle'ını
>   `import.meta` ile kırar (native davranış değişmedi).
> - Mikrofon MVP DIŞI (buton "yakında" der); kamera ilerleme halkası saf
>   View (react-native-svg YOK).
> - Supabase durumu (2026-07-18'de güncellendi): KISMEN kurulu — yalnız
>   RAG tarif korpusu (`supabase/migrations/` 3 migration: pgvector +
>   `match_recipes` + tag filtresi/exact-scan) ve `supabase/functions/
>   generate-recipe` edge function'ı canlı (proje + kurulum: `README-rag.md`).
>   Auth/kullanıcı verisi tarafı HÂLÂ YOK — uygulama kalıcılığı zustand
>   persist/AsyncStorage; anahtarlar `.env` `EXPO_PUBLIC_*`. "Mimari"
>   bölümündeki Supabase auth/TanStack satırları hedef mimaridir.

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
- **Navigasyon:** expo-router, alt tab bar ile 5 sekme (Mutfağım `/` ·
  Tarifler `/recipes` · Kayıtlı `/saved` · Plan `/plan` · Market `/market`,
  MVP-23) + tam ekran `/capture/*` ve `/recipe/[id]` rotaları
- **Backend:** Supabase — ŞU AN yalnız RAG tarif korpusu + `generate-recipe`
  edge function canlı (bkz. `README-rag.md`); auth/Postgres kullanıcı
  verisi/storage HEDEF mimaridir, kurulmadı (kalıcılık zustand persist)
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

> ⚠️ MVP-22 ile GENİŞLEDİ: sepet, Şefe Sor chat'i, tarif tercihleri, kiler
> ve kamera/asistan ekleme kapsam İÇİ. MVP-23 ile "Kayıtlı" (Defterlerim)
> ve "Plan" da kapsama GİRDİ — artık kapsam dışı sayfa yok.

Çekirdek iki özellik (öncelik hâlâ bunlarda):
1. Fotoğraf/video ile ürün tanıma → envantere ekleme (Mutfağım sayfası)
2. Envanterden kaliteli tarif üretimi (Tarifler sayfası)

## Sayfalar ve sorumlulukları

1. **Mutfağım (`/`)** — Fiş fotoğrafı veya buzdolabı fotoğrafı/videosu
   yükleme; vision sağlayıcısıyla (varsayılan Gemini, bkz. "Mimari") ürün
   çıkarımı; düzenlenebilir envanter listesi; kiler (Temel Malzemeler)
   chip'leri; blok başlıklarında son güncelleme tarihi
   (`inventoryStore.lastUpdatedAt` — analiz/ekleme günceller, çeviri
   backfill'i GÜNCELLEMEZ). Video Claude'a doğrudan gönderilmez: cihazda
   karelere ayrılır (bkz. "Fotoğraf/Video → envanter"); Gemini'de native
   video tek çağrıdır.
2. **Tarifler (`/recipes`)** — Envantere göre AI tarif önerileri (6 standart
   + 2 fine dining, bkz. "Envanter → tarif"). Her kart: kalori, kişi sayısı,
   süre, makrolar, eksik rozeti. Detayda adım adım hazırlanış + **Şefe Sor**
   (tarife özel chat; geçmiş `store/chefChatStore.ts`'te recipeId bazlı,
   zustand persist — Supabase tablosu YOK).
3. **Kayıtlı = Defterlerim (`/saved`, MVP-23)** — kolaj kapaklı defter
   kartları, arama + sıralama, defter detayı 4'lü grid (canlı
   `computeMissing` rozetli), FAB → içe aktarma akışı
   (`components/import/`); `store/cookbookStore.ts` (importedRecipes
   kopyalama kuralı — bkz. MVP-23 bloğu).
4. **Plan (`/plan`, MVP-23)** — Pzt–Paz ajanda; `store/planStore.ts`,
   `PlanEntry` ad/kcal/emoji DENORMALİZE taşır.
5. **Market (`/market`)** — seçilen tariflerin eksik malzemeleri, malzeme
   KATEGORİSİNE göre gruplu; kaynak tarif etiketleri, işaretleme; AH &
   Jumbo fiyat karşılaştırması (MVP-24, bkz. o blok).

## Tasarım sistemi

> ⚠️ **Güncel görsel dilin TEK kaynağı MVP-22 spec'i + `components/ui/`**
> (Newsreader + Hanken Grotesk; orman yeşili `#1F4A3D`, krem `#F7F5F0`,
> amber `#E38A2A` — bkz. üstteki MVP-22 bloğu). MVP-22 ÖNCESİ
> stone/emerald + Fraunces/Outfit paleti tarihidir
> (references/HISTORY.md#eski-tasarım-sistemi-mvp-22-öncesi); eski sınıf
> adları yalnız henüz taşınmamış eski bileşenlerde görülür. Aşağıdaki
> maddeler hâlâ AKTİF davranış/yerleşim kurallarıdır.

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
- **Confidence rozeti ana listede GÖSTERİLMEZ** — eşik üstü ürünler zaten
  "kesin" sayıldığından rozet bilgi taşımıyordu; SADECE "emin olunamayan
  ürünler" modalında durur. (MVP-10 renkli şerit denemesi MVP-21'de
  kaldırıldı — tarihçe: references/HISTORY.md#mvp-1721-tasarım-sagası.)
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
- Kategori bölümlerinin 2'li grid yerleşiminin MVP-17'deki ilk denemesi ve
  ara halleri için tarihçe: references/HISTORY.md#mvp-1721-tasarım-sagası — NİHAİ yerleşim
  MVP-20 maddesinde (altta).
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
- **+/- butonları kalktı (MVP-18), kaydırma sistemi MVP-20'de TAMAMEN
  silindi** — tarihçe/gerekçeler: references/HISTORY.md#mvp-1721-tasarım-sagası. Genel RN
  dersi (koddan bağımsız geçerli): `PanResponder.create` her render'da
  yeniden oluşturulmazsa (`useRef`e sarılırsa) release handler'ları İLK
  mount'taki bayat state'i okur (stale closure) — swipe/gesture kodunda
  buna dikkat.
- **Kategori arka plan renkleri (MVP-19 — AKTİF):** her `CategoryColumn`
  kendi soluk pastel tonuyla ayrı "raf" gibi görünür (`GROUP_BACKGROUND_COLORS`,
  `rounded-2xl px-3 py-3`; bölümler arası çizgi ayraç YOK, renk geçişi
  ayırır): Süt & Peynir açık krem `#FAF3E7` (kullanıcının özel isteği),
  Et & Şarküteri soluk terracotta `#F6E8E2`, Meyve & Sebze soluk adaçayı
  `#EAF3EA`, Sos & Baharat soluk hardal `#F5EFD6`, Diğer soluk taş grisi
  `#F3F1EE`. Bölüm başlığı chip'i `bg-white/60` (her pastel tonda "yüzer"),
  satır içi ayraç `border-stone-900/5`. Bu paletin türetilme öyküsü ve o
  dönemki chevron/kaydırma görünürlük işleri: references/HISTORY.md#mvp-1721-tasarım-sagası.
- **Nihai kart/yerleşim durumu (MVP-20 — AKTİF):** `ProductCard` tamamen
  STATİK — `[ad, flex-1] [silme kutusu]` + (varsa) marka satırı; hook/
  animasyon/kaydırma YOK. Miktar (`qty`) veri modelinde/store'da AYNEN
  DURUR ama ana listede RENDER EDİLMEZ (kullanıcı kararı: "bilgi arkada
  tutulabilir"). `incrementQty`/`decrementQty` store'dan SİLİNMEDİ — "emin
  olunamayan ürünler" modalı hâlâ kullanır. Kategori bölümleri `chunkPairs`
  ile 2'li grid'de yan yana (tek sayıda bölümde boş `flex-1` hücre); uzun
  adlar `numberOfLines={1}` ile kısalır — bilinen ve kullanıcı tarafından
  kabul edilmiş trade-off. Bu duruma gelen deneme/geri-alma zinciri
  (MVP-17 grid → MVP-18 swipe → MVP-19 alt alta → MVP-20 statik):
  references/HISTORY.md#mvp-1721-tasarım-sagası.

## Veritabanı (Supabase) — gerçek durum

- Gerçek migration'lar SADECE RAG tarif korpusu içindir
  (`supabase/migrations/`: pgvector'lu `recipes` korpus tablosu +
  `match_recipes` RPC + tag filtresi/fine-dining exact-scan; kurulum ve
  edge function: `README-rag.md`). Kullanıcı verisi tabloları
  (envanter/sepet/chat vb.) YOK — kalıcılık zustand persist.
- Hedef kullanıcı-verisi şeması, auth işi gündeme geldiğinde o işin
  kapsamında tasarlanacak; burada önceden tutulan taslak şema kaldırıldı
  (koda karşılık gelmiyordu).

## AI çağrı formatları

### Fotoğraf/Video → envanter

> Ekran `services/vision`'ı `getVisionProvider()` üzerinden çağırır; eski
> kopya `lib/claude/extractInventoryFromImages.ts` MVP-3'te KALDIRILDI
> (`lib/claude/client.ts` tarif üretimi için duruyor) — tarihçe:
> references/HISTORY.md#mvp-3-2026-07-05.

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

> MVP-10 görev kapsamı anlatısı (neden iki render yolu bilinçli ayrıldı):
> references/HISTORY.md#mvp-10-2026-07-05 — güncel kural, "Tasarım sistemi"ndeki "İki farklı
> kart render yolu" maddesi.

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
- **Eski markdown tablo akışı:** `services/vision/markdown-table.ts`
  `@deprecated` olarak duruyor (canlı akışta kullanılmıyor, sonraki
  temizlikte kaldırılacak); dönem detayı: references/HISTORY.md#mvp-1721-tasarım-sagası
  öncesi vision notları ve o dosyanın kendisi.

#### Store modları: tam tarama vs ekleme (MVP-12)

`store/inventoryStore.ts` iki mod sunar; seçimi `app/(tabs)/index.tsx`
analiz akışında yapılır:

- **KURAL: video analizi = TAM TARAMA (`replaceItems`)** — envanter yeni
  listeyle DEĞİŞTİRİLİR, miktar toplama yok. Video dolabın o anki TAM
  halini gösterir; birikimli `addItems` aynı videonun ikinci analizinde
  miktarları katlıyordu (2 süt → 4 süt). Elle eklenen kayıtlar da
  yenilenir — BİLİNÇLİ basit tutuldu, birleştirme mantığı kurulmadı.
- **KURAL: değiştirme onayı (`Alert`) API çağrısından ÖNCE sorulur** —
  40+ saniyelik analiz boşa gitmesin; envanter zaten boşsa sorulmaz.
- **Fiş/fotoğraf akışı = EKLEME (`addItems`):** aynı ad+birim varsa
  miktarlar toplanır, yoksa yeni kayıt.

> **Varyans gerçeği (MVP-12 ölçümünün dersi):** temperature 0.2 ile bile
> koşudan koşuya ürün listesi doğal olarak oynar (isimlendirme + düşük
> confidence kenar ürünler); YAPISAL kayıp (parser'ın satır düşürmesi)
> yok ve `CONFIDENCE_THRESHOLD=90` oynak ürünleri "kontrol bekliyor"
> modalına süzer — varyansı hata sanıp parser/prompt kurcalamadan önce bu
> ölçümü oku: references/HISTORY.md#mvp-12-2026-07-07.

> **Confidence kalibrasyonu (MVP-13 — AKTİF kural):** şemadaki `reasoning`
> alanı SADECE modelin kendi kalibrasyonu içindir (UI'da gösterilmez,
> `InventoryItem`'a yazılmaz) ve `propertyOrdering` ile `confidence`'tan
> HEMEN ÖNCE üretilir. Prompt'taki kalibrasyon rehberi: 95-100 = etiket/
> ambalaj net VEYA şekil tartışmasız; 80-94 = tür belli, detay/marka
> değil; 50-79 = form tahmin edilebilir; <50 = sadece tahmin.
> `CONFIDENCE_THRESHOLD` 90'da KALDI (kullanıcı kararı — belirsiz ürünün
> modalde onay istemesi doğru davranış). Ölçüm dökümleri:
> references/HISTORY.md#mvp-13-2026-07-07.

> **MVP-2→6'nın tek kalıcı dersi (vision prompt'larına dokunmadan önce
> oku):** sıkı/tek aşamalı JSON şeması modelin GÖZLEM detayını kısıtlar —
> kazanan mimari "şemasız serbest gözlem + ayrı yapılandırma" oldu (Claude
> %18→%100, Gemini %0→%100 doğruluk). Aktif kurallar bundan türedi: jenerik
> Türkçe `name` + ayrı `brand`; 0-100 `match_confidence`; Gemini'de Aşama 2
> aynı konuşmanın devamı ve az kısıtlayıcı (`TABULATION_TURN_PROMPT`) —
> Gemini'nin kendi tablolaştırma sezgisine güvenilir, önden aşırı kısıt
> konmaz. Adım adım evrim + gerekçeler: references/HISTORY.md#mvp-2-2026-07-04 →
> references/HISTORY.md#mvp-6-gemini-aşama-2yi-doğal-sezgiye-bırakma.

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

> MVP-8 (kategori + marka ayrımı + eşik 50→90) görev anlatısı:
> references/HISTORY.md#mvp-8-kategori--marka--eşik — kararların güncel hali yukarıdaki
> bölümlerde.

### Envanter → tarif önerisi

**Bu akış SADECE Claude API kullanır** (`claude-sonnet-4-6`, `lib/claude/`) —
vision tarafının Claude/Gemini karşılaştırma mimarisiyle (bkz. yukarıda
"Mimari" ve "Sağlayıcı karşılaştırma notları") HİÇ ilgisi yok, ortak bir
sağlayıcı seçim mekanizması (`VISION_PROVIDER` benzeri) YOK — iki özellik
birbirinden bağımsız, sabit birer sağlayıcıya bağlı (tarif üretimi hep
Claude, envanter çıkarımı hep Gemini/Claude karşılaştırması).

> **RAG durumu:** `EXPO_PUBLIC_USE_RAG=true` arkasında alternatif bir üretim
> yolu var (`lib/rag/generateRecipesRag.ts` → Supabase `generate-recipe`
> edge function'ı, canlı) — şu an varsayılan KAPALI, açma kararı ayrı
> verilecek. RAG hattı hep İngilizce çalışır ve TEK çağrıda final listeyi
> döndürür — canlı slot gösterimi YOK (ekran genel iskeletlerde bekler).
> 2/4/2 katman dağılımı, `namesMatch` kopyası + `reconcileRecipes` ve
> hibrit kısayol düzeltmesi edge function'a işlendi (bkz. üstteki RAG-EN
> bloğu); analiz ve ölçümler `analysis/rag-analysis.md`. Bu bölümdeki iki
> aşamalı yolun katmanlama/canlı gösterim davranışı, RAG ayarının REFERANS
> hedefidir.

Girdi: envanter listesi (`{name, qty, unit}`'e sadeleştirilmiş). Çıktı:
**6 standart + 2 fine dining = TOPLAM 8 tarif** (`RECIPE_COUNT = 6`,
`FINE_DINING_COUNT = 2`, `lib/claude/generateRecipes.ts`). Standart 6'nın
katmanları EKSİK MALZEME SAYISI bazlı (MVP-16 katman tanımı; MVP-11'in
"9 tarif, match_pct yüzdesi bazlı" tanımı ve MVP-15'in ~3'er dağılımı
DEĞİŞTİ — bkz. altta "MVP-16"): 2 tarif `ready` (`missing_count = 0`,
SADECE envanter + kiler malzemeleri), 2 tarif `closeMatch` (1-2 eksik
malzeme), 2 tarif `fewMissing` (3-4 eksik malzeme, yüksek temperature ile
daha yaratıcı). **Fine dining ikilisi** ayrı bir plan çağrısı
(`SUBMIT_FINE_DINING_NAMES` aracı) + `FINE_DINING_VARIANT`'lı detay
çağrılarıyla PARALEL üretilir; tarifler `category: 'fine-dining'` damgalanır,
eksik-bazlı katmanlamaya KARIŞMAZ — listede ayrı "Fine Dining" bölümü +
kartta ✦ rozeti (`RecipeList.tsx`, `RecipeCard.tsx`). **Kiler listesi MVP-16'da geniş
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

**İki dillilik + deterministik mutabakat (ENVANTER-2DİL kuralları):**
- Prompt'lara giden envanter listesi AKTİF dilin adlarıyla gider
  (`simplifyInventory(inventory, language)`); ortak detay talimatında
  "envanterdeki malzemenin adını listedeki yazımıyla AYNEN kullan, eş
  anlamlı üretme" kuralı vardır.
- **KURAL: modelin `in_inventory` işaretlemesine tek başına güvenilmez** —
  her detay çağrısı SONRASI (ready-retry kararından ÖNCE)
  `applyInventoryReconciliation` koşar: `lib/recipes/ingredient-match.ts`
  `namesMatch` (SAF modül; küçük harf + aksan temizliği + tekil/çoğul
  toleransı + token alt-küme kuralı; `name` VE `nameTr` VE `nameEn`
  kontrol edilir) eşleşen malzemeyi `in_inventory: true` yapar + adını
  envanterin aktif dildeki adıyla değiştirir; `missing_count`/`match_pct`
  yeniden hesaplanır. RAG akışı da aynı katmandan geçer.
- **KURAL: `computeMissing` aynı `namesMatch`'i kullanır** — ham substring
  `includes` YASAK ("un" ⊂ "sabun" yanlış pozitifi testle sabitlendi).
- **KURAL: KISMİ token örtüşmesi ("Red Pepper Flakes" ↔ "Chili Flakes")
  BİLİNÇLİ eşleşmez** — eş anlamlıyı önlemek PROMPT'un işidir; lexical
  katman yalnız yazım/dil/çoğul farklarını kapatır.

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
sadece UI'da tutulur, kalıcı değildir. **Parmak izi `GENERATION_VERSION`
önekli ve GÜNCEL SÜRÜM v5** (`store/recipeStore.ts`): parmak izi =
`sürüm | tercihler | sadeleştirilmiş envanter` — KİLER DAHİL DEĞİL.
Üretim mantığı değiştiğinde sürüm artırılır ki envanteri değişmeyen
kullanıcının eski mantıkla üretilmiş cache'i eşleşmeye devam edip yeni
akışı sonsuza dek engellemesin. Sürüm tarihi: v2 = MVP-16 (sürümleme
başladı) → v3 = MVP-22 (şema v3 + tercihler/kiler parmak izine girdi) →
**v4 = kiler parmak izinden ÇIKARILDI** (kiler değişimi üretimi baştan
başlatmaz; eksik rozetleri zaten canlı `computeMissing` ile güncellenir) →
**v5 = iki dilli envanter/tarif adları** (ENVANTER-2DİL — eski tek dilli
cache atılır).

**MVP-14 dersi (1 satır):** katmanlar birbirinden HABERSİZ paralel
planlanırsa çeşitlilik düşer — tarifler önce TEK çağrıda birlikte
planlanmalı (MVP-15'in kök gerekçesi). MVP-14'ün 3-paralel-çağrı mimarisi
ve fonksiyonları kodda YOK; anlatı: references/HISTORY.md#mvp-14-2026-07-08.

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

Ölçüm (32.8s; 9/9 benzersiz tarif, çeşitlilik listesi, kendi kendini
düzeltme örnekleri): references/HISTORY.md#mvp-15-2026-07-09-ölçüm.

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
- Ölçüm (36.8s; 3 ready, ready-retry hiç tetiklenmedi, 2/2/2'nin katı UI
  garantisi olmadığının örneği): references/HISTORY.md#mvp-16-2026-07-11-ölçüm.

**Tek-tek/canlı gösterim (`app/(tabs)/recipes.tsx`, `components/recipes/
RecipeLayerSections.tsx`, `components/recipes/RecipeSkeletonCard.tsx`;
MVP-15'te 9, MVP-16'da 6, fine dining ile 6+2 = 8 slot):**
ekran artık `slots: RecipeSlotState[]` (8 eleman, plan sırasına göre sabit
index) tutar — her slot `{name, estimatedLayer, fineDining, status:
loading|done|error, recipe, actualLayer}`. `fineDining: true` slotlar ayrı
"Fine Dining" bölümünde gösterilir ve retry'ları `generateFineDiningDetail`
çağırır. Üç aşama:
1. **Aşama 1 dönmeden önce** (`slots.length === 0`): isimsiz, bölümsüz
   genel iskelet kartlar (`RecipeSkeletonCard`, `name` prop'u YOK) düz bir
   liste olarak gösterilir — henüz hangi tarifin hangi bölüme gideceği
   bilinmiyor.
2. **Aşama 1 döner dönmez**: slotlar isim + `estimatedLayer` ile oluşturulur,
   `RecipeLayerSections` bunları `estimatedLayer`e göre bölümlere yerleştirir;
   her kart artık ADI GÖRÜNEN ama gövdesi hâlâ iskelet olan bir karttır
   (`RecipeSkeletonCard`'a `name` verilince başlık gri bar yerine gerçek
   metin olur — "isim biliniyor, detay yükleniyor" hissi).
3. **Her Aşama 2 çağrısı TAMAMLANDIKÇA** o slot TEK BAŞINA `done`/`error`
   olur — kart iskeletten dolu `RecipeCard`'a döner (diğer kartlar
   ETKİLENMEZ, MVP-14'teki "tüm tarifler aynı anda göründü" sorunu çözüldü) ve
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
- **KURAL: dosya yazımında `write(base64, {encoding:'base64'})` KULLANMA** —
  native desteği expo-file-system 19.0.16'da geldi; Expo Go'nun gömülü
  native modülü node_modules'taki JS sürümünden ESKİ olabilir (görsellerin
  cihazda hiç görünmemesinin kök nedeniydi; hata sessiz catch'te gizliydi —
  MVP-9'un "masaüstünde çalıştı, cihazda çöktü" dersinin üçüncü örneği).
  Base64 JS'te çözülüp `Uint8Array` overload'ıyla yazılır (API'nin ilk
  gününden beri var, sürüm farkından etkilenmez).
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

### Tarif chat'i (Şefe Sor)
`lib/claude/askChef.ts` (`claude-sonnet-4-6`). Her istek: `CHEF_INSTRUCTIONS`
+ çıktı dili (parametrik, `llmOutputLanguage()` — 4. parametre) + tarifin
tamamı system bloğunda (`formatRecipeContext`, aynı tarif boyunca birebir
aynı metin → `cache_control: ephemeral` prefix cache'i tutar) + o tarife
ait geçmiş mesajlar (`store/chefChatStore.ts`, recipeId bazlı zustand
persist — Supabase tablosu YOK). `CHEF_INSTRUCTIONS` özü: yalnızca bu
tarif bağlamında yanıt ver; ikame önerirken etkilenen miktarları güncelle;
kısa/pratik; markdown YASAK (sohbet balonu düz metin — madde gerekirse
"• " kullan).

## Sağlayıcı karşılaştırma notları

> **Native-video (MVP-7) akışının token/maliyeti HİÇ ÖLÇÜLMEDİ** —
> `tests/vision-eval/run-eval.ts` yalnız iki aşamalı `extractInventory`'yi
> çağırır, `extractInventoryFromVideo`'yu değil. Karşılaştırma istenirse
> ÖNCE script'e native-video kolu eklenmeli; rakam uydurma. Ayrıntı/yön
> tahmini: references/HISTORY.md#native-video-maliyeti-ölçülmedi.

**Kalıcı kararlar (ölçüm tabloları references/HISTORY.md'de):**

- **Varsayılan sağlayıcı `gemini`** (`EXPO_PUBLIC_VISION_PROVIDER`,
  kullanıcı tercihi, MVP-4) — Claude kod tabanında A/B için tutulur.
  Karar dayanağı: iki aşamalı mimariyle İKİSİ de %100 doğruluğa ulaştı;
  fark token asimetrisinde — aynı görsellerin gözlemi Gemini'de ~3.3K,
  Claude'da ~57.8K girdi tokeni (~17 kat) — görsel tokenizasyon maliyeti
  Gemini lehine büyük.
- **Claude gözlem aşamasında `thinking: {type:"disabled"}`** (MVP-3):
  Sonnet 5'te varsayılan adaptive thinking bu görevde doğruluk katmadan
  süreyi 58.2s→42.5s'e uzatıyordu.
- Tüm ölçüm tabloları (MVP-2/3/4 doğruluk-süre-maliyet, ground-truth
  temkin notları, Gemini varyans gözlemi): references/HISTORY.md#mvp-4-2026-07-05-ölçüm-ve-karar
  ve komşu bölümleri.

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

**MVP-9 (2026-07-05) kalıcı kurallar** (ölçüm tabloları/süreç:
references/HISTORY.md#mvp-9-2026-07-05-performans-profili):

- **KURAL: gecikme optimizasyonunu client'ta arama.** Native-video
  gecikmesinin ~%70-95'i ağ/model tarafında (Files API + model çıkarımı);
  client kodu (encode/parse/state) toplamın %1'inden az — asıl kaldıraç
  video boyutu/süresi ve model seçimi.
- **KURAL: `@google/genai` streaming (`generateContentStream`) KULLANMA.**
  RN'in yerleşik `fetch`'i `response.body`'yi ReadableStream olarak sunmaz
  → cihazda "Response body is empty" ile çöker; Node/masaüstü testinde
  YAKALANMAZ. Non-streaming `generateContent` kullan; gerçek streaming
  istenirse `expo/fetch` ayrı bir bağımlılık kararıdır.
- **KURAL: `expo-file-system`'in `File`'ını `ai.files.upload`'a doğrudan
  verme.** Chunked upload `File.slice()` → `new Blob([ArrayBuffer])`
  çağırır; RN'in Blob polyfill'i bunu desteklemez (cihazda çöker, Node'da
  çalışır). Files API yüklemeleri base64 →
  `fetch('data:...;base64,...').blob()` ile RN'in NATIVE Blob'undan geçer
  (`extractInventoryFromVideoNative`).
- **KURAL (genel): RN'e özgü network/polyfill farkları masaüstü Node
  script'iyle YAKALANAMAZ** — cihaz davranışını etkileyebilecek her
  değişiklikte gerçek cihaz/simülatör testi zorunlu (MVP-9'da iki kez,
  tarif görsellerinde üçüncü kez kanıtlandı).
- **Model/sıkıştırma bulguları:** `gemini-2.5-flash` %36 hızlı ama doğruluk
  %82→%64 düştü → varsayılan `gemini-2.5-pro` KALDI (kullanıcı kriteri).
  720p'ye sıkıştırma Files API eşiğini atlatıp ~10-20s kazandırır ama
  token/maliyet AZALMAZ (Gemini video tokenizasyonu kare/süre bazlı) ve
  cihazda transcode için yeni native paket gerekir → uygulanmadı; n>1
  doğruluk teyidi + paket onayıyla güçlü aday. Files API poll aralığı
  1000ms'e indirildi (uygulandı, etki küçük).

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

## DENENDİ / REDDEDİLDİ — tekrar ÖNERME

Kullanıcının denediği ve bilinçli reddettiği şeyler (en pahalı hata:
bunları yeniden önermek). Gerekçeler ilgili bölümde/HISTORY'de:

- **İki eşikli swipe** (kısmi=azalt, tam=sil) — dar sütunda ayırt
  edilemiyordu (MVP-18).
- **Miktar kaydırma/swipe sistemi** komple — qty artık render edilmiyor
  (MVP-20); +/- butonları da daha önce elendi.
- **Ana listede confidence rozeti** — bilgi değeri yok; yalnız "emin
  olunamayan" modalında (MVP-10/21).
- **Kart solunda renkli şerit / tabak-çatal ikonu** — kaldırıldı (MVP-21).
- **Tarif detayında envanterde-var malzemeye tik ikonu** — gürültü.
- **Kartta "%N uyum" rozeti** — eksik-bazlı bölümleme sonrası tekrar
  (MVP-16; detay ekranındaki %uyum duruyor).
- **İçecekler envanterde** — istenmiyor (MVP-17); ama `İçecek` enum'u
  şemadan SİLİNMEZ (bkz. KRİTİK DETAYLAR).
- **Katman-bağımsız / tek-çağrı üretim** — çeşitlilik ve hız dersleri
  (MVP-14/15); isimler önce BİRLİKTE planlanır.
- **Marka adını ürün adına birleştirmek** (MVP-8) — marka ayrı `brand`
  alanı/ikincil etiket.
- **`instagram://app` / `instagram://feed` şeması** — feed'e navige edip
  durumu sıfırlar; çıplak `instagram://` kullanılır (IG-RESUME).
- **İki dilli isim için vision şemasını değiştirmek** — çeviri parse
  SONRASI adımdır (ENVANTER-2DİL).
- **Karşı market uygulamasının sepetini doldurmak** — ToS/güvenlik,
  bilinçli kapsam dışı (MVP-24).
- **`@google/genai` streaming** ve **`File`'ı doğrudan upload'a vermek** —
  cihazda çöker (MVP-9 kuralları).
- **`gemini-2.5-flash`'a geçiş** — doğruluk belirgin düşüyor; pro'da
  kalındı (MVP-9).
- **Video analizinde karmaşık envanter birleştirme** — `replaceItems`
  bilinçli basit (MVP-12).
- **RAG promptunda "Prefer recipes the user can cook NOW"** — her şeyi 0
  eksiğe itiyordu (RAG-EN).
- **RAG promptunda "envantere öncelik ver, kilere yaslanma"** — ters
  tepti; kiler-yıldız kuralıyla değiştirildi (RAG-EN).

## KRİTİK DETAYLAR — kısaltma/temizlikte SİLME

Her biri gerçek bir hatanın önündeki tek settir; küçültme/refactor
sırasında bilinçli korunur:

- `propertyOrdering`: `reasoning`, `confidence`'tan HEMEN ÖNCE üretilir
  (`gemini-provider.ts`) — sıra değişirse kalibrasyon etkisi kaybolur.
- `INVENTORY_CATEGORIES`'teki `'İçecek'` enum değeri şemadan silinmez —
  silinirse model içecekleri başka kategoriye zorlar, parse filtresi
  yakalayamaz.
- Claude detay çağrılarında cache breakpoint İLK system bloğunun
  SONUNDADIR; katman/fine-dining kısıtı sonraki cache'siz bloktadır —
  yer değişirse prefix cache bozulur.
- Tercih metni ORTAK detay bloğunun İÇİNDE kalır (aynı gerekçe).
- `lib/` ve `services/` i18n IMPORT ETMEZ — Node eval/test script'leri
  kırılır.
- "KISMİ token örtüşmesi bilinçli eşleşmez" (`ingredient-match`) — lexical
  katmanı eş-anlamlı eşleştirmeye genişletme.
- "Eşleşme yok cache'lenmez" (`services/matching`) — sortiman düzelince
  kendini onarma mekanizması.
- Manifest-null/Metro-require kısıtı (`tutorialImages.ts`) — var olmayan
  dosyaya require yazılamaz.
- Edge function'daki `namesMatch` KOPYASI client'la birlikte güncellenir.
- Parmak izinde KİLER YOK (v4 kararı) — geri eklenirse kiler chip'i her
  değişimde üretimi baştan başlatır.
- `match_pct` tipte/hesapta durur ama hiçbir karar mekanizmasında
  kullanılmaz — "ölü alan" sanıp silme (eski cache + detay ekranı uyumu).
- Sepette kanonik `name` tarifin ÜRETİLDİĞİ dildedir — birleştirme/
  işaretleme anahtarı; aktif dile çevirme.

## BAKIM KURALI

**Yeni iş = ilgili bölümü GÜNCELLE; en üste yeni blok EKLEME.** Geçersiz
kılınan anlatı `references/HISTORY.md`'ye taşınır; SKILL.md'de yalnız
güncel kural kalır (kural = KURAL + 1-2 satır gerekçe + gerekirse HISTORY
pointer'ı). Hedef boyut ~15-17K token; 20K aşılırsa temizlik işi açılır.
