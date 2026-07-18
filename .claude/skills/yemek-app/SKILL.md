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
>   live|mock`; **KURAL: boşsa web'de MOCK** — mağaza API'leri tarayıcıda
>   CORS'a takılır, canlı yol web'de hiç çalışmaz; native'de live). AH:
>   anonim token'lı unofficial mobil API. Jumbo: `www.jumbo.com/api/graphql`
>   (`apollographql-client-*` header'ları; SupermarktConnector'ın
>   `mobileapi.jumbo.com`'u 2026-07-18'de yanıtsızdı — bilinçli terk).
>   `createStoreFetcher`: timeout 8s + 2 retry (yalnız network/5xx/429) +
>   mağaza başına seri kuyruk ~300ms. Kanarya: `npx tsx
>   tests/store-smoke/run-smoke.ts` (fiyatlar boşalırsa İLK bu koşulur).
>   Fiyatsız ürünler (AH sanal bundle'ları) listenin sonuna atılır.
> - **Eşleştirme motoru** (`services/matching/`): 0-cache → 1-sözlük (200
>   TR→NL) → 2-fuzzy (`fuzzy.ts`; NL bileşik kelime kuralı: sorgu token'ı
>   ürün token'ının SONUNDAYSA iyi eşleşme "rundergehakt", BAŞINDAYSA
>   türev cezası "uiensoep"; birim/miktar uyumu `parseUnitSize`) → 3-LLM
>   (claude-haiku-4-5, koşu başına EN FAZLA 2 TOPLU çağrı, tool_choice
>   zorlamalı). Cache/provider'lar motora ENJEKTE edilir (`MatchCache`) —
>   eval Node'da dosya cache'iyle, app zustand adaptörüyle. Canlı eval
>   (`npx tsx tests/match-eval/run-eval.ts`): %95 doğruluk, sıcak koşu
>   0.033 LLM/malzeme. **KURAL: "eşleşme yok" sonucu BİLEREK cache'lenmez**
>   — sortiman düzelince kendini onarır.
> - **Store'lar:** `matchCacheStore` (kalıcı; **kullanıcı düzeltmesi
>   source:'user'/güven 100 — otomatik eşleşme EZMEZ**, ürün sortimandan
>   düşmedikçe), `storePriceStore` (24h TTL), `marketMatchStore` (persist
>   YOK; fingerprint bazlı otomatik koşu + 5dk health-check).
>   `callClaudeForToolInputWithUsage` gerçek token/maliyet loglar
>   (`[match-llm]`/`[match-run]`).
> - **UI (kullanıcı kararları):** eşleştirme Market açılınca OTOMATİK;
>   fiyatlar SATIR İÇİNDE ("AH €1,29 · Jumbo €1,15", ucuz vurgulu);
>   toplamlar SADECE İŞARETSİZ satırlar. `StoreComparisonCard` ("En uygun"
>   + "Bu mağazadan al"), `ProductMatchSheet` (alternatifler
>   `StoreMatch.candidates`'tan API'siz + NL manuel arama; seçim = kalıcı
>   düzeltme + toast), düşük güven (<70) amber işaret, eşleşmeyen taraf
>   "—". Mağaza çökmesi: amber banner + o sütun "—", diğeri çalışır
>   (`EXPO_PUBLIC_STORE_MOCK_FAIL=ah|jumbo|both` ile simüle edilir).
> - **Deeplink** (`lib/market/storeLinks.ts`): app şeması (appie/jumbo,
>   `LSApplicationQueriesSchemes` app.json'da) → web fallback; Expo Go'da
>   şema sorgusu hep false → hep web (beklenen). Karşı uygulamanın
>   sepetini doldurmak BİLİNÇLİ kapsam dışı (ToS/güvenlik). Şemalar gerçek
>   cihazda doğrulanmadı — `// DOĞRULA` notları kodda.
> - `design/Tarif_ekle/` fotoğrafları bu özellikle İLGİSİZ (yanlışlıkla
>   eklendi; yok sayıldı).

> ## ⚠️ MVP-23 (2026-07-12) — 5 SEKME + DEFTERLER + PLAN + İÇE AKTARMA
>
> Davranışın TEK kaynağı: `CLAUDE_CODE_PROMPT_v2.md` + `design/reference/`
> zip'indeki `Mutfagim.dc.html`. MVP-22'nin "3 sekme" ve "Kayıtlı kapsam
> dışı" kararları GEÇERSİZ:
>
> - **Navigasyon 5 sekme:** Mutfağım `/` · Tarifler `/recipes` · Kayıtlı
>   `/saved` · Plan `/plan` · Market `/market`.
> - **Kayıtlı = Defterlerim** (`app/(tabs)/saved.tsx`,
>   `components/cookbooks/`): kolaj kapaklı defter kartları, arama +
>   sıralama, defter detayı 4'lü grid (canlı `computeMissing` rozetli),
>   FAB → içe aktarma. `store/cookbookStore.ts` (kalıcı): cookbooks +
>   savedRecipeIds + **importedRecipes** — **KURAL: deftere eklenen
>   üretilmiş tarif KOPYALANIR** (envanter değişip liste yeniden üretilince
>   kaybolmasın); `lib/recipes/find-recipe.ts` iki kaynağı birleştirir,
>   detay ekranı bunu kullanır.
> - **Plan** (`app/(tabs)/plan.tsx`, `store/planStore.ts`): Pzt–Paz
>   ajanda; `PlanEntry` ad/kcal/emoji DENORMALİZE taşır (tarif objesi
>   çözülemese de kart çizilir).
> - **Tarif detayı:** bilgi pilleri minimal tek satır; 4 ikon buton
>   (Defterler=CookbookPickerSheet · Plan=PlanDayPickerSheet ·
>   Market=eksikleri sepete+toast · Paylaş=toast); Şefe Sor'da geçmiş
>   boşken 3 örnek soru chip'i (gerçek askChef çağrısı).
> - **"+" içe aktarma** (`components/import/`): Tarif Ekle sheet →
>   Sosyal (IG/TikTok/FB) → IG eğitim carousel'i → IG feed taklidi →
>   import; Web tarayıcı taklidi → import; Fotoğraftan →
>   `/capture/camera?mode=recipe` ("yakında" toast'u; envanter köprüsünü
>   TETİKLEMEZ). Örnek tarifler `lib/recipes/sample-imports.ts` (mock
>   DEĞİL — akışın gerçek içeriği); import → Kategorisiz + kayıtlı +
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
- **Ürün adı / marka ayrımı (MVP-8):** satırda ürün adı esas metin; marka
  varsa altında küçük/gri ikincil etiket (`ProductRow`,
  `app/(tabs)/index.tsx`). Marka adı ASLA ürün adıyla birleştirilip tek
  uzun başlık yapılmaz.
- **Kategori grupları — 4 GÖRÜNTÜLEME grubu (MVP-22 spec):** ham 7
  kategori görüntülemede 4 üst gruba birleştirilir (`CATEGORY_GROUPS`,
  `app/(tabs)/index.tsx`): **Süt & Peynir, Et & Şarküteri, Meyve & Sebze,
  Diğer** — MVP-10/17'nin 5'li grubundaki "Sos & Baharat", spec'in 4
  kartlı düzenine uymak için "Diğer"e KATLANDI (spec kazandı); ham
  `item.category` aynen saklanır. Her grup ayrı beyaz `Card` (radius 22),
  başlıkta pastel TINT'li emoji rozeti (`GROUP_META`, `colors.tint*` —
  `lib/theme.ts`), satırlar `colors.divider` ince çizgiyle ayrılır.
  MVP-10'un tek "🧊 Buzdolabım" dış kartı ve MVP-19'un pastel ARKA PLANLI
  `CategoryColumn` stili bu düzenle DEĞİŞTİ (tarihi:
  references/HISTORY.md#mvp-1721-tasarım-sagası).
- **Confidence rozeti ana listede GÖSTERİLMEZ** — eşik üstü ürünler zaten
  "kesin" sayıldığından rozet bilgi taşımıyordu; SADECE "emin olunamayan
  ürünler" modalında durur. (MVP-10 renkli şerit denemesi MVP-21'de
  kaldırıldı — tarihçe: references/HISTORY.md#mvp-1721-tasarım-sagası.)
- **⚠️ İki farklı satır render yolu var (MVP-10'dan beri bilinçli):** ana
  kategorili liste `components/inventory/InventoryRow.tsx`'i KULLANMIYOR —
  `app/(tabs)/index.tsx` içinde yerel `ProductRow` (ikon/rozet yok)
  kullanır. "Emin olunamayan ürünler" modalı ise HÂLÂ eski
  `InventoryList`/`InventoryRow`'u (ikon + confidence rozetiyle) kullanır.
  Modal ile ana liste görsel olarak FARKLI — kasıtlı; birleştirme
  istenirse `InventoryRow.tsx` de kapsama alınmalı (eski Fraunces/Outfit
  fontları da o zaman kalkabilir, bkz. MVP-22 bloğu).
- **"Emin olunamayan ürünler" bildirimi:** soluk link değil, amber uyarı
  kartı ("N ürün kontrol bekliyor" + `chevron-forward`; `bg-amber-soft`) —
  kategori kartlarının DIŞINDA, listenin üstünde.
- Kategori bölümlerinin 2'li grid yerleşiminin MVP-17'deki ilk denemesi ve
  ara halleri için tarihçe: references/HISTORY.md#mvp-1721-tasarım-sagası — NİHAİ yerleşim
  MVP-20 maddesinde (altta).
- **İçecekler envantere alınmaz (MVP-17):** kullanıcı kararı — içecekler
  (su, meyve suyu, gazlı içecek, bira...) envanterde İSTENMİYOR; soslar/
  baharatlar kalır. Kapsam SADECE video akışı (bkz. "Video → envanter" —
  içecek filtresi maddesi); iki aşamalı fotoğraf/fiş akışının prompt'larına
  BİLİNÇLİ dokunulmadı (o akış `category` üretmiyor — fişten içecek
  gelirse elle silinir). `CATEGORY_GROUPS`'ta `İçecek` anahtarı tip gereği
  durur ve "Diğer"e eşlenir (eski kayıtlar için geri-dönüş).
  **KURAL: `INVENTORY_CATEGORIES`'teki `'İçecek'` enum değeri SİLİNMEZ** —
  şemadan çıkarılsa model içecekleri başka kategoriye zorlar ve parse
  filtresi yakalayamaz.
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
- **MVP-19 pastel arka planları TARİHİ:** `GROUP_BACKGROUND_COLORS` ve
  `bg-white/60` chip stili MVP-22 spec'inde beyaz kart + pastel TINT'li
  emoji rozetiyle (`GROUP_META`) DEĞİŞTİRİLDİ — kodda yok. Paletin öyküsü:
  references/HISTORY.md#mvp-1721-tasarım-sagası.
- **Nihai satır/yerleşim davranışı (MVP-20 kararları — AKTİF, görünüm
  MVP-22 spec):** envanter satırı (`ProductRow`) tamamen STATİK —
  `[ad, flex-1] [silme ikonu]` + (varsa) marka satırı; hook/animasyon/
  kaydırma YOK. Miktar (`qty`) veri modelinde/store'da AYNEN DURUR ama ana
  listede RENDER EDİLMEZ (kullanıcı kararı: "bilgi arkada tutulabilir").
  `incrementQty`/`decrementQty` store'dan SİLİNMEDİ — "emin olunamayan
  ürünler" modalı hâlâ kullanır. Kategori kartları `chunkPairs` ile İKİ
  SÜTUN yan yana (tek sayıda kartta ikinci hücre boş `flex-1`); uzun adlar
  `numberOfLines={1}` ile kısalır — bilinen, kabul edilmiş trade-off.
  Deneme/geri-alma zinciri (MVP-17 grid → MVP-18 swipe → MVP-19 alt alta →
  MVP-20 statik): references/HISTORY.md#mvp-1721-tasarım-sagası.

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

- **Fotoğraf:** `resizeImageToBase64` ile uzun kenar en fazla 2576px'e
  küçültülüp base64 image bloğu olarak gönderilir; altta anlatılan iki
  aşamalı JSON mimarisinden geçer.
- **Video, sağlayıcıya göre AYRIŞIR** (bkz. "Video → envanter"):
  - **Gemini** (varsayılan): kare çıkarma YOK — video native tek çağrıda
    gönderilir, iki aşamalı JSON mimarisi KULLANILMAZ.
  - **Claude:** video API'si kabul etmez — cihazda `expo-video-thumbnails`
    ile kare çıkarılır (saniyede 1, en fazla 12 kare;
    `lib/media/extractVideoFrames.ts`), kareler 2576px sınırından geçip
    iki aşamalı JSON mimarisini kullanır. "Sahne bazlı" kare seçimi
    `expo-video-thumbnails`'in zaman-bazlı API'siyle YAPILAMAZ — sabit
    aralıklı örnekleme kullanılır. Bu kare-tabanlı akış, sağlayıcı
    `extractInventoryFromVideo` tanımlamadığında genel geriye-dönük
    uyumluluk yoludur (`app/(tabs)/index.tsx`).

### Fotoğraf (ve Claude video) → envanter: iki aşamalı JSON mimarisi

**İki aşamalı mimari** (`services/vision/`, bkz. `VisionProvider` arayüzü;
paylaşılan Aşama 1 promptu `services/vision/prompt.ts`'te). Kök neden:
tek-aşamalı sıkı JSON şeması gözlem detayını kısıtlıyordu (bkz. üstteki
"MVP-2→6 dersi").

1. **Aşama 1 — gözlem** (vision, yüksek çözünürlük, İKİ SAĞLAYICIDA DA
   AYNI): görselleri/kareleri ŞEMA DAYATMADAN, serbest metinle "gördüğün
   TÜM ürünleri madde madde anlat; marka, raf/çekmece konumu, miktar, emin
   olamadığın noktaları belirt" diye ister (`OBSERVATION_SYSTEM_PROMPT`).
   Düz metin döner, JSON değil. Claude: `claude-sonnet-5` (2576px'e kadar
   yüksek çözünürlük destekler, `thinking: {type:"disabled"}` ile — bkz.
   altta). Gemini: `gemini-2.5-flash` (`EXPO_PUBLIC_GEMINI_MODEL` ile
   değiştirilebilir).
2. **Aşama 2 — yapılandırma, SAĞLAYICIYA GÖRE FARKLI:**
   - **Claude:** ayrı/bağımsız çağrı, katı JSON şeması
     (`STRUCTURING_SYSTEM_PROMPT`, `claude-haiku-4-5`) — "hiçbir ürünü
     atlama" talimatıyla Aşama 1 metnini
     `[{ name, qty, unit, brand, location, match_confidence }]` şemasına
     çevirir.
   - **Gemini:** ayrı çağrı DEĞİL — Aşama 1'in AYNI konuşmasının devamı
     (`runInventoryConversation`, `gemini-provider.ts`; ikinci tur
     `TABULATION_TURN_PROMPT`, kısa ve az kısıtlayıcı — Gemini'nin kendi
     tablolaştırma sezgisine güvenilir, "her ürünü ayrı satır yap" gibi
     zorlamalar bilinçli YOK). Aynı `gemini-2.5-flash`; ikinci tur ucuz
     (yalnız metin).
   İkisinde de **KURAL:** `"name"` jenerik Türkçe, marka ayrı `"brand"`
   alanına (`InventoryItem.brand`, opsiyonel); `"match_confidence"` 0-100
   tam sayı. Prompt'lardaki `"location"` alanı `InventoryItem`'dan
   KALDIRILDI (MVP-12) — prompt'lar isteyebilir ama `parseInventoryItems`
   yok sayar (akış davranışını değiştirmemek için prompt'lara dokunulmadı).

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
  eşlendiği GÖRÜNTÜLEME grubuna (`CATEGORY_GROUPS`, 4 üst grup — bkz.
  "Tasarım sistemi") göre ilgili kategori kartında `ProductRow` ile
  gösterilir. `category` alanı yoksa (iki aşamalı JSON akışı) "Diğer"
  grubuna düşer.
- **`confidence < 90`:** ürün kategorili listede HİÇBİR YER KAPLAMAZ.
  Bunun yerine listenin en üstünde belirgin bir amber uyarı kartı
  gösterilir ("N ürün kontrol bekliyor"). Tıklanınca
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

**KURAL: video akışı Gemini'nin native structured output'unu
(`responseSchema`) kullanır, serbest markdown + kendi parser'ımız DEĞİL**
(MVP-12) — eski markdown akışında ayarlanmamış temperature + kırılgan
parser satırları SESSİZCE düşürüyor, birikimli `addItems` miktarları
katlıyordu (varyans şikayetinin üç kök nedeni; ayrıntı: HISTORY). Şema
yapıyı API tarafında garanti eder, parser kırılganlığı sınıfça kalkar.

- **Prompt** (`VIDEO_INVENTORY_PROMPT`, `services/vision/prompt.ts`):
  ÇOK kısa — buzdolabı videosunu sistematik analiz et (her raf/kapı
  gözü/çekmece), TÜM ürünleri çıkar; `name` SPESİFİK Türkçe ürün adı,
  sıfat tamlaması tercih edilir ("Küflü Peynir", "Cherry Domates",
  "Kırmızı Biber"; tekli ürünler sade: "Süt", "Marul") ve marka adı
  `name`'e DEĞİL `brand`'e yazılır; kategori SADECE şemadaki sabit
  listeden; `confidence` görsel netlik/etiket okunabilirliğine göre —
  yapıyı şema garanti ettiği için prompt yalnız görevi ve isimlendirme
  kurallarını anlatır. **MVP-17 içecek kuralı:** prompt'a
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
  INVENTORY_UNITS), category: enum(7 kategori, INVENTORY_CATEGORIES),
  reasoning: string, confidence: integer 0-100 }`. `reasoning` SADECE
  modelin kendi kalibrasyonu içindir, `InventoryItem`'a YAZILMAZ.
  **KURAL: `propertyOrdering` `reasoning`i `confidence`'tan HEMEN ÖNCEye
  koyar** (`gemini-provider.ts`) — model skoru vermeden önce gerekçesini
  yazmak zorunda kalır (chain-of-thought etkisi); bu sıra DEĞİŞTİRİLMEZ.
  Model: `gemini-2.5-pro` (`EXPO_PUBLIC_GEMINI_MODEL` ile override).
  Video ~18MB'ı geçerse otomatik Gemini Files API'sine yüklenir
  (`uploadVideoToFilesApi`). `onUsage` tek `stage: "video-inventory"`
  event'i.
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

> **Debug/deneysel:** gözlem ham metni için Mutfağım'daki geçici "[DEBUG]
> Ham Metni Gör" butonu (`app/(tabs)/index.tsx`, "DEBUG — kaldırılacak"
> yorumlu). `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO=true`: kare çıkarmadan ham
> videoyu tek `inlineData` ile Gemini'ye gönderen deneme yolu (yalnız
> Gemini'de anlamlı; ~20MB üstü istek atılmadan hata verir — bu deneysel
> yolda Files API uygulanmadı).

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
katmanları EKSİK MALZEME SAYISI bazlı (MVP-16): 2 `ready`
(`missing_count = 0`, SADECE envanter + kiler), 2 `closeMatch` (1-2
eksik), 2 `fewMissing` (3-4 eksik, yüksek temperature). **Fine dining
ikilisi** ayrı plan çağrısı + `FINE_DINING_VARIANT`'lı detay çağrılarıyla
PARALEL üretilir; tarifler `category: 'fine-dining'` damgalanır,
eksik-bazlı katmanlamaya KARIŞMAZ — listede ayrı "Fine Dining" bölümü +
kartta ✦ rozeti (`RecipeList.tsx`, `RecipeCard.tsx`). **Kiler listesi
geniş** (kullanıcı kararı: "temel baharatlar/kiler evde var kabul
edilir"; `PANTRY_STAPLES`, 20 kalem — tuz'dan bulgur'a, tek kaynak koddadır,
promptlara interpolate edilir); listedekiler DAİMA `in_inventory: true`
sayılır, eksik gösterilmez. Birleşik `Recipe` şeması (`types/recipe.ts`):
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
in_inventory`'den KODDA deterministik hesaplanır (bkz. altta "İki aşamalı
üretim", `toRecipeDetail`): `match_pct = round((in_inventory=true sayısı / toplam
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
görünümde liste bölümlü — "Hemen Yapabilirsin" (`missing_count = 0`,
üstte; `recipes.sectionReady`), "Küçük Bir Alışverişle" (kalan tarifler
`missing_count`'a göre ARTAN sıralı — 2-eksikliler 4-eksiklilerin
üstünde; `recipes.sectionShopping`) ve ayrı "Fine Dining" bölümü
(`recipes.sectionFineDining`, eksik-bazlı bölümlemeye karışmaz).
Eksikli kartlarda amber "N eksik"
rozeti (`missing_count`) gösterilir; **"%N uyum" rozeti MVP-16'da
KALDIRILDI** (eksik-bazlı kategorileme sonrası bilgi tekrarıydı —
kullanıcı kararı; tarif DETAY ekranındaki %uyum göstergesi duruyor). Tarif detayında
`in_inventory: false` malzemelerin yanında amber "eksik" mikro-rozeti +
sepet ikonu vardır; `in_inventory: true` olanlar sade kalır (tik ikonu
YOK — gürültü olur, bilinçli karar). Üretim SIRASINDA gösterilen kademeli/
canlı görünüm için bkz. altta "Tek-tek/canlı gösterim".

**Tarif önbelleği:** `store/recipeStore.ts` zustand `persist`
(`yemek-app-recipes`); tarifler hangi envanter için üretildiyse
`inventoryFingerprint` ile saklanır. **KURAL: parmak izi aynıysa tarifler
yeniden ÜRETİLMEZ** — üret/yenile API'ye gitmeden mevcut listeyi kullanır.
Cache edilen her zaman üretim adımlarından BAĞIMSIZ final BİRLEŞMİŞ
listedir; ara slot/katman state'i yalnız UI'da yaşar, kalıcı değildir.
**Parmak izi `GENERATION_VERSION` önekli ve GÜNCEL SÜRÜM v5**
(`store/recipeStore.ts`): parmak izi =
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

**İki aşamalı üretim — güncel akış (`lib/claude/generateRecipes.ts`;
mimari MVP-15, parametreler MVP-16, fine dining sonradan):** önce TEK
çağrıda tüm tariflerin İSMİ + kaba planı üretilir (isimler BİRLİKTE
planlandığı için çeşitlilik korunur — MVP-14 dersi), sonra her isim
BAĞIMSIZ paralel detay çağrısıyla doldurulur (hız + doğal canlı gösterim).
MVP-15/16 karar anlatıları ve ölçümleri: references/HISTORY.md.

- **Aşama 1 — plan** (`generateRecipeNames`, `submit_recipe_names` aracı):
  çıktı KISA — sadece isim + `estimated_layer` + `estimated_missing`, tam
  detay istenmez. `PLAN_SYSTEM_PROMPT` dağılımı ZORUNLU ister: TAM 2
  `ready` + 2 `closeMatch` + 2 `fewMissing` ("ready bulamazsan en basit
  formatlara in — omlet/makarna/pilav"); çeşitlilik kuralları (aynı ana
  malzeme/pişirme tekniği tekrarlanmaz, öğün tiplerine yayılır, Türk
  mutfağı önceliği) ve isimlendirme doğruluğu ("Menemen yalnızca
  domates+biber varsa") korunur. KOD dağılımı doğrulamaz/zorlamaz — model
  2/2/2 tutturamazsa akış yine çalışır, kesin katman koddan gelir.
  (MVP-16'nın kök nedeni: detay promptunda envanter zorlaması yokken
  "ready" tahminleri alışverişe kayıyordu + kiler listesi çok dardı.)
- **Aşama 2 — detay** (`generateRecipeDetail(name, inventory, layerTarget,
  context)`, `submit_recipe_detail` aracı: emoji, kcal, servings, time_min,
  difficulty, macros, ingredients, steps, chef_tip, image_prompt_en). Şema
  BİLEREK `name`/`match_pct`/`missing_count` İSTEMEZ: isim Aşama 1'den
  parametre gelir (kart başlığı plandan itibaren tutarlı kalsın), sayılar
  `toRecipeDetail` içinde koddan hesaplanır. `system` İKİ blok: ortak
  detay talimatı (`buildCommonDetailSystemPrompt(context)`, koşunun tüm
  detay çağrılarında birebir aynı, `cache_control: ephemeral`) + katman
  kısıtı (`LAYER_VARIANTS`, cache'siz ikinci blok — prefix cache
  BOZULMAZ): `ready` "SADECE envanter+kiler, HER malzeme in_inventory:
  true" + `temperature: 0.3` · `closeMatch` "en fazla 1-2 dışarıdan" +
  `0.7` · `fewMissing` "3-4 dışarıdan, yaratıcı ol" + `1.0` (Claude API'de
  temperature 0-1).
- **Ready retry (kullanıcı kararı):** `ready` hedefli tarif eksikle
  dönerse 1 kez düzeltme çağrısı ("şu malzemeler envanterde yok: X —
  tarifi onlarsız yeniden kur"); yine eksikliyse olduğu gibi kabul edilir,
  eksik sayısına göre bölüme düşer.
- **`assignRecipeLayer(missingCount)` — kesin katman KODDAN, modelin
  tahminine GÜVENİLMEZ:** 0 → `ready`, 1-2 → `closeMatch`, 3+ →
  `fewMissing`. `estimated_layer` SADECE iskelet kartın bölüm bazlı ön
  yerleşimi içindir; detay dönünce kod kartı doğru bölüme taşır (kendi
  kendini düzeltme). `mergeRecipeLayers` isim bazında tekilleştirir,
  `missing_count` ARTAN sıralar.
- **Orkestratör** (`generateRecipesTwoPhase(inventory, {preferences,
  activePantryNames, outputLanguage, onPlanReady?, onDetailSettled?})`):
  plan sonrası tüm detay çağrılarını `Promise.allSettled` ile EŞZAMANLI
  başlatır (biri başarısız olsa diğerleri ETKİLENMEZ), her biri bitince
  `onDetailSettled`. Fine dining ikilisi kendi plan + detay çağrılarıyla
  (`FINE_DINING_VARIANT`) paralel yürür.

**Tek-tek/canlı gösterim (`app/(tabs)/recipes.tsx`,
`RecipeLayerSections.tsx`, `RecipeSkeletonCard.tsx`; 6+2 = 8 slot):**
ekran `slots: RecipeSlotState[]` tutar (plan sırasına sabit index; her
slot `{name, estimatedLayer, fineDining, status, recipe, actualLayer}`;
`fineDining: true` slotlar ayrı bölümde, retry'ları
`generateFineDiningDetail` çağırır). Akış: (1) plan dönmeden isimsiz genel
iskelet kartlar; (2) plan dönünce slotlar isim + `estimatedLayer` ile
bölümlere yerleşir (adı görünen, gövdesi iskelet kart); (3) her detay
TAMAMLANDIKÇA o slot TEK BAŞINA `done`/`error` olur — diğer kartlar
etkilenmez, bölüm ataması gerçek `missing_count`'a (`actualLayer`) göre
yeniden hesaplanıp kart gerekirse doğru bölüme taşınır; alışveriş bölümü
eksik sayısına göre artan sıralanır (`shoppingSortKey`). `error` slotta
"'{isim}' yüklenemedi / Tekrar dene" satırı (`retrySlot` yalnız o tarifi
dener). Bölüm başlığı o bölümde en az bir slot varsa görünür. Üretim
bitip `setRecipes` çağrılınca ekran statik `RecipeList` yoluna döner (iki
render yolu kasıtlı ayrı — `InventoryRow`/`ProductRow` ayrımıyla aynı
desen).

### Tarif görselleri (AI görsel üretimi, MVP-11)

`services/images/recipe-image.ts` — **`services/vision/`'dan TAMAMEN
bağımsız** modül (yalnız aynı `EXPO_PUBLIC_GOOGLE_API_KEY`'i paylaşır);
vision'a dokunmadan değiştirilebilir.

- **Model:** `gemini-3.1-flash-lite-image` (görsel üretim ayrı model
  ailesidir — metin/vision modelleri görsel üretemez; ~3s,
  ~$0.034/görsel). `EXPO_PUBLIC_GEMINI_IMAGE_MODEL` ile değiştirilebilir.
  Çağrı: `generateContent` + `imageConfig.aspectRatio: "4:3"`, yanıt
  `inlineData` (base64 JPEG).
- **Prompt şablonu** (kullanıcının beğendiği format, EN): `"Appetizing
  {dish description}. {plating}. Clean food photography, bright studio
  lighting, white background, simple, high contrast, mobile app banner,
  4:3 aspect ratio."` — dish description tarifin `image_prompt_en`'inden
  (AYRI LLM çağrısı YOK); alan yoksa ad + malzeme özetinden birleştirilir.
- **KURAL: lazy + sıralı kuyruk** — tüm görseller birden İSTENMEZ; kartlar
  mount oldukça `enqueueRecipeImage` kuyruğuna girer, kuyruk SIRAYLA (tek
  eşzamanlı API çağrısı) işler; hazır olana dek kartta emoji
  (`useRecipeImage`).
- **KURAL: cache zorunlu** — orijinal + thumbnail FileSystem cache'ine
  (`Paths.cache/recipe-images/`) TARİF ADI anahtarıyla (slug + hash)
  yazılır; aynı ad için görsel bir daha üretilmez. Cache kontrolü senkron
  (`File.exists`).
- **Thumbnail:** listede 320px kopya (`expo-image-manipulator`), detayda
  (`RecipeHeroImage`) orijinal; thumbnail üretimi NON-FATAL.
- **KURAL: dosya yazımında `write(base64, {encoding:'base64'})` KULLANMA** —
  native desteği expo-file-system 19.0.16'da geldi; Expo Go'nun gömülü
  native modülü node_modules'taki JS sürümünden ESKİ olabilir (görsellerin
  cihazda hiç görünmemesinin kök nedeniydi; hata sessiz catch'te gizliydi —
  MVP-9'un "masaüstünde çalıştı, cihazda çöktü" dersinin üçüncü örneği).
  Base64 JS'te çözülüp `Uint8Array` overload'ıyla yazılır (API'nin ilk
  gününden beri var, sürüm farkından etkilenmez).
- **Placeholder/layout:** görsel alanı ve placeholder BİREBİR aynı
  boyutta (kartta 80px kare, detayda tam genişlik 4:3) — görsel gelince
  kart zıplamaz; placeholder zemin + büyük emoji
  (`RecipeImagePlaceholder`), üretim sürerken hafif opacity pulse
  (spinner YOK).
- Üretim başarısız olursa placeholder'da kalınır; tam hata `[recipe-image]`
  etiketiyle console'a yazılır (kuyruk her aşamayı loglar, cache HIT
  dahil); kart yeniden mount olunca tekrar denenir.

**KURAL: Claude çıktıları zorunlu tool-use ile alınır — markdown/JSON.parse
YOK** (Gemini `responseSchema`'sının Claude karşılığı). Tool'lar
`tool_choice: {type: "tool", name: "..."}` ile zorlanır
(`callClaudeForToolInput`, `lib/claude/client.ts`); yanıt `tool_use`
bloğunun `input`ından doğrudan JS objesi gelir — fence temizleme/parse
retry yok, yalnız minimal alan/tip kontrolü (`toRecipePlan`,
`toRecipeDetail`). Şema ayrıntıları yukarıdaki "İki aşamalı üretim"
bölümünde.

Aşama 2'nin sistem talimatı İKİ bloktur (MVP-16): ilk blok — ortak detay
talimatı, `buildCommonDetailSystemPrompt(context)` ile kurulur ve aynı
koşudaki 8 paralel çağrıda (6 standart + 2 fine dining + ready-retry)
BİREBİR aynıdır — `cache_control: {"type": "ephemeral"}` ile önbelleklenir,
prefix önbelleği tutar (maliyet kuralı; `system` bir blok dizisi olarak
gönderilir, bkz. `ClaudeSystemBlock`); ikinci blok katman/fine-dining
varyant kısıtıdır (`LAYER_VARIANTS[layer].constraint` /
`FINE_DINING_VARIANT`, cache'siz — cache breakpoint'i İLK bloğun sonunda
olduğu için sonrasındaki farklılık prefix cache'i BOZMAZ). Aşama 1
(`PLAN_SYSTEM_PROMPT`) TEK bir çağrı olduğu için cache_control KULLANMAZ —
tekrar kullanılmayan bir önbellek yazma maliyeti kendini amorti etmez.

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
pointer'ı). Hedef boyut ~35K token; 40K aşılırsa temizlik işi açılır.
