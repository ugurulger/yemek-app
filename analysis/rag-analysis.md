# RAG Analiz Raporu — 2026-07-18

> Salt-okunur analiz session'ı çıktısı. Hiçbir kod değiştirilmedi.
> İncelenen sürüm: `claude/rag-recipe-analysis-7593f1` (HEAD `4fc7091`).

## Yönetici Özeti

**RAG çalışıyor mu: KISMEN — sunucu tarafı bu session'da sıfırdan kuruldu ve
canlı testlerle uçtan uca DOĞRULANDI (bkz. §7); uygulama ise hâlâ eski yolda
(flag kapalı, `.env`'e bilinçli eklenmedi — açma kararı test sonuçlarına
bakarak verilecek).**

*İlk analiz anındaki durum (tarihi kayıt):*

1. **Uygulama şu an %100 eski iki aşamalı Claude yolunu kullanıyor.**
   `EXPO_PUBLIC_USE_RAG` ana repo `.env`'inde hiç tanımlı değil (flag build
   anında `false`'a düşüyor); dahası `EXPO_PUBLIC_SUPABASE_URL` /
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` de `.env`'de yok — flag açılsa bile RAG
   yolu ilk satırda hata fırlatırdı. Client kodu ölü değil, bilinçli kapalı.
2. **Kullanıcının ekranda gördüğü "fine dining" tarifleri RAG'den GELMİYOR** —
   son commit'te iki aşamalı yola eklenen, RAG'siz bir fine dining akışından
   geliyor (`lib/claude/generateRecipes.ts:694`). "Fine dining görünüyor,
   demek ki RAG çalışıyor" çıkarımı yanlış olur.
3. **Commit'lenmiş korpus dosyasında `fine-dining` etiketi 0 kayıtta var.**
   Etiketleme scriptinin kural seti yeniden koşulunca 524 eşleşme üretiyor
   (doğrulandı) ama scriptin yeniden yazdığı gz dosyası commit'lenmemiş;
   Supabase satırlarının etiketli olup olmadığı bu makineden doğrulanamadı.
4. **Supabase tarafı HİÇ KURULMAMIŞ (canlı probe ile doğrulandı,
   2026-07-18):** kullanıcının verdiği proje
   (`bwifrndcigjxdqvurltw.supabase.co`) ayakta ama boş — `generate-recipe`
   function'ı deploy edilmemiş (404 NOT_FOUND), `recipes` tablosu yok
   (PGRST205: tablo şemada bulunamadı → migration'lar hiç uygulanmamış,
   dolayısıyla embedding de yüklenmemiş). Kurulum aynı gün bu session'da
   tamamlandı ve canlı testler koşuldu — güncel durum ve sonuçlar §7'de.

---

## 1. RAG gerçekten çalışıyor mu?

### 1a. Üretim yolu — koddan kanıt

Zincir şu; her halka mevcut ve bağlı:

- **Flag tanımı:** [generateRecipesRag.ts:24](lib/rag/generateRecipesRag.ts) —
  `export const RAG_ENABLED = process.env.EXPO_PUBLIC_USE_RAG === 'true';`
- **Dallanma:** [recipes.tsx:109-111](app/(tabs)/recipes.tsx) —
  `const merged = RAG_ENABLED ? await generateRecipesRag(...) : await generateRecipesTwoPhase(...)`.
  Yani client'ta edge function'ı çağıran kod **gerçekten bağlı, ölü değil** —
  ama koşulu hiç sağlanmıyor (aşağıda).
- **Edge çağrısı:** [generateRecipesRag.ts:63](lib/rag/generateRecipesRag.ts) —
  `POST {SUPABASE_URL}/functions/v1/generate-recipe`, anon key ile.

**Flag'in fiili değeri: `false`.** Kanıt:

- Ana repo `.env`'i (`/Users/ugurulger/yemek-app/.env`, 2026-07-18 01:46)
  yalnızca 4 satır içeriyor: `EXPO_PUBLIC_ANTHROPIC_API_KEY`,
  `EXPO_PUBLIC_GOOGLE_API_KEY`, `EXPO_PUBLIC_VISION_PROVIDER=gemini`,
  `EXPO_PUBLIC_GEMINI_NATIVE_VIDEO=true`. **`EXPO_PUBLIC_USE_RAG` yok,
  `EXPO_PUBLIC_SUPABASE_URL`/`ANON_KEY` yok.** (`.env.example` RAG
  satırlarını içeriyor ve `.env`'den DAHA YENİ tarihli — RAG değişkenleri
  example'a eklenmiş ama gerçek `.env`'e hiç taşınmamış.)
- `EXPO_PUBLIC_*` değişkenleri Expo'da bundle anında inline edilir —
  tanımsız değişken `undefined === 'true'` → `RAG_ENABLED = false`.
- Emniyet katmanı: flag bir şekilde açılsaydı bile
  [generateRecipesRag.ts:50-56](lib/rag/generateRecipesRag.ts) Supabase
  URL/anon key yokluğunda `RecipeGenerationError` fırlatır — yani mevcut
  `.env` ile RAG yolu ÇALIŞAMAZ.

**Sonuç:** Tarifler sekmesi bugün `generateRecipesTwoPhase`
([lib/claude/generateRecipes.ts](lib/claude/generateRecipes.ts)) ile üretim
yapıyor. Ekrandaki fine dining bölümü de bu yolun kendi RAG'siz fine dining
akışından geliyor (`FINE_DINING_COUNT = 2`,
[generateRecipes.ts:28](lib/claude/generateRecipes.ts), plan+detay:
satır 694-807) — RAG kanıtı DEĞİL.

### 1b. Edge function canlı testi — henüz mümkün değil: sunucu tarafı boş

İlk analizde repoda hiçbir Supabase referansı yoktu; kullanıcı sonradan
proje URL'i + anon key'i paylaştı ve canlı probe yapıldı (2026-07-18):

| Probe | Sonuç | Anlamı |
|---|---|---|
| `GET /auth/v1/health` | 401 (anahtarsız normal) | Proje ayakta |
| `POST /functions/v1/generate-recipe` (anahtarsız) | **404 NOT_FOUND** | Function **hiç deploy edilmemiş** (deploy edilmiş olsaydı 401 dönerdi) |
| `GET /rest/v1/recipes` (anon key ile) | **404 PGRST205** "tablo şemada yok" | `recipes` tablosu **hiç oluşturulmamış** → migration'lar uygulanmamış → embedding yüklemesi de yapılmamış |

Ek destekleyici iz: `data/.embed-checkpoint.json` yerelde yok, CLI link
kalıntısı yok. **Sonuç: RAG'in sunucu ayağı %0 kurulu** — client kod +
migration dosyaları + scriptler hazır ama hiçbiri gerçek projeye
uygulanmamış. Kurulum tamamlanınca aşağıdaki script koşulacak
(3 temsili girdi: TR karışık envanter, EN dil, kısayolu zorlayan birebir
korpus envanteri):

```sh
SUPABASE_URL=https://<REF>.supabase.co SUPABASE_ANON_KEY=<anon> npx tsx - <<'EOF'
const url = `${process.env.SUPABASE_URL}/functions/v1/generate-recipe`;
const key = process.env.SUPABASE_ANON_KEY!;
const cases = [
  { label: 'TR envanter + Turkish', body: {
      inventory: [{name:'domates',qty:4,unit:'adet'},{name:'yumurta',qty:6,unit:'adet'},
        {name:'beyaz peynir',qty:200,unit:'g'},{name:'tavuk göğsü',qty:400,unit:'g'},
        {name:'patates',qty:5,unit:'adet'},{name:'yoğurt',qty:500,unit:'g'}],
      preferences: ['Protein Odaklı','Pratik & Hızlı'],
      pantry: ['tuz','karabiber','zeytinyağı','un','soğan','sarımsak'],
      language: 'Turkish', count: 6 } },
  { label: 'EN envanter + English', body: {
      inventory: [{name:'chicken breast',qty:400,unit:'g'},{name:'rice',qty:500,unit:'g'},
        {name:'tomato',qty:4,unit:'adet'},{name:'onion',qty:2,unit:'adet'},
        {name:'butter',qty:100,unit:'g'},{name:'milk',qty:1,unit:'litre'}],
      preferences: [], pantry: ['salt','pepper','olive oil','garlic','flour'],
      language: 'English', count: 6 } },
  // Kısayol zorlaması: korpustaki "Simple Macaroni and Cheese" benzeri
  // malzemeleri İngilizce ver — source:"database" dönerse kısayol canlı demektir.
  { label: 'Kısayol denemesi (EN, tam kapsama)', body: {
      inventory: [{name:'macaroni',qty:500,unit:'g'},{name:'cheddar cheese',qty:300,unit:'g'},
        {name:'milk',qty:1,unit:'litre'},{name:'butter',qty:100,unit:'g'},{name:'flour',qty:500,unit:'g'}],
      preferences: [], pantry: ['salt','pepper','water'],
      language: 'English', count: 6 } },
];
for (const c of cases) {
  const t0 = Date.now();
  const res = await fetch(url, { method: 'POST',
    headers: { 'content-type':'application/json', apikey:key, authorization:`Bearer ${key}` },
    body: JSON.stringify(c.body) });
  const json = await res.json();
  console.log(`\n=== ${c.label} — ${res.status}, ${((Date.now()-t0)/1000).toFixed(1)}s`);
  console.log('source:', json.source,
    '| tarif:', json.recipes?.length,
    '| fine dining:', json.recipes?.filter((r:any)=>r.category==='fine-dining').length,
    '| topSimilarity:', json.retrieval?.topSimilarity);
  console.log('matchedTitles:', json.retrieval?.matchedTitles?.slice(0,5));
  console.log('fineDiningTitles:', json.retrieval?.fineDiningTitles);
  if (json.error) console.log('ERROR:', json.error);
}
EOF
```

Her çağrı için kaydedilecekler (görevin istediği alanlar script çıktısında):
`source`, `retrieval.topSimilarity`, `matchedTitles`, tarif sayısı, fine
dining sayısı, yanıt süresi.

### 1c. Hibrit kısayol — kod analizi bazlı gözlem (canlı ölçüm yapılamadı)

Kısayol koşulu ([index.ts:653](supabase/functions/generate-recipe/index.ts)):
`topSimilarity >= 0.8` **VE** en yakın tarifin **TÜM** malzemeleri
envanter+kilerde (`countMissing === 0`, alt-dize eşleştirme,
[index.ts:261-272](supabase/functions/generate-recipe/index.ts)).

Koddaki "diller karışıksa nadiren tetiklenir" MVP notu pratikte **iyimser
bile**: gerçek tetiklenme olasılığı Türkçe envanterle **fiilen sıfıra**
yakın, İngilizce envanterle bile çok düşük. Nedenleri:

1. Korpus %100 İngilizce (10.000/10.000 kayıt, aşağıda §3) — Türkçe
   "yumurta" hiçbir "egg" satırını alt-dize olarak içeremez; tek malzeme
   bile eşleşmeyince `missing = 0` koşulu imkânsız.
2. İngilizce envanterde bile korpus tarifleri ortalama 8-12 malzemeli;
   HEPSİNİN envanter+kilerde alt-dize karşılığı olması ("dijon mustard",
   "worcestershire sauce"...) nadir bir durum.
3. Tetiklenirse davranış tuhaf: yanıt **tek 1 normal tarif** + 2 fine
   dining döner ([index.ts:659](supabase/functions/generate-recipe/index.ts)
   — `recipes: [recipe, ...fineDiningRecipes]`), client 6 tarif beklerken
   liste 1-3 karta düşer. Ayrıca `toDatabaseRecipe`
   ([index.ts:275-308](supabase/functions/generate-recipe/index.ts))
   `kcal` korpustan gelmezse 0, makrolar hep 0, `difficulty` hep "Orta",
   `chef_tip` boş, adımlar İngilizce (dil parametresi kısayol yolunda
   UYGULANMAZ — Türkçe kullanıcıya İngilizce tarif döner).

Yani hibrit kısayol bugünkü haliyle **pratikte ölü bir kod yolu**; i18n
sonrası İngilizce envanterde teorik olarak tetiklenebilir ama tetiklendiğinde
UX'i düşürür. (Rapor önerisi: §6, madde 4.)

---

## 2. "Tarif üret" deyince ne oluyor — iki yolun basit anlatımı

### 2a. AKTİF YOL — iki aşamalı Claude akışı (RAG kapalıyken, yani bugün)

| # | Adım | Dosya | Süre/maliyet |
|---|---|---|---|
| 1 | Envanter + tercihler + aktif kiler toplanır; parmak izi hesaplanır. Parmak izi aynıysa API'ye hiç gidilmez, cache'teki liste gösterilir | `app/(tabs)/recipes.tsx:89-100`, `store/recipeStore.ts` | ~0ms |
| 2 | **Aşama 1 — plan:** TEK Claude çağrısı 6 tarif ismi + tahmini katman üretir (`submit_recipe_names`, sonnet) | `lib/claude/generateRecipes.ts` | 7-9s (MVP-15/16 ölçümü) |
| 3 | Ekran 6 isimli iskelet kart çizer (canlı slot gösterimi) | `components/recipes/RecipeLayerSections.tsx` | anlık |
| 4 | **Aşama 2 — detay:** 6 paralel Claude çağrısı, her biri tek tarifin tamamı; katman kısıtı + temperature varyantı; "ready" tarif eksikli dönerse 1 retry | `lib/claude/generateRecipes.ts` | ~24-30s (paralel; en yavaş çağrı belirler) |
| 5 | **Fine dining (RAG'siz, yeni):** 2 isimlik ayrı plan çağrısı + 2 detay çağrısı, `FINE_DINING_VARIANT` promptuyla — korpus/retrieval YOK, düz Claude | `lib/claude/generateRecipes.ts:694-807` | ölçülmemiş; paralel koştuğu için toplam süreye sınırlı ek — **tahmin** +0-10s |
| 6 | `missing_count`/`match_pct` KODDA deterministik hesaplanır, katman gerçek eksik sayısından atanır, isim bazlı tekilleştirme | `toRecipeDetail`, `mergeRecipeLayers` | ~0ms |
| 7 | Kartlar tek tek dolar; final liste cache'e yazılır | `recipes.tsx`, `recipeStore` | — |
| 8 | Görseller AYRI ve sonradan: kart mount olunca kuyruğa girer (bkz. §5) | `services/images/` | tarif başına ~3s, ~$0.034 |

**Toplam duvar saati: ~35-40s** (MVP-16 ölçümü 36.8s; fine dining eklenmiş
haliyle yeniden ölçülmedi — **tahmin** aynı bant). Maliyet: 1 plan + 6 detay
+ 1 fine dining plan + 2 fine dining detay = 10 Sonnet çağrısı; ortak sistem
bloğu prefix-cache'li.

### 2b. UYUYAN YOL — RAG edge function akışı (flag açılırsa)

| # | Adım | Dosya | Süre/maliyet |
|---|---|---|---|
| 1 | Client envanter/tercih/kiler/dil/count'u tek JSON'la edge function'a POST eder; canlı slot YOK, ekran genel iskelette bekler | `lib/rag/generateRecipesRag.ts:63-80` | ağ gecikmesi |
| 2 | **Sorgu kurulumu:** `"Available ingredients: <adlar>\nPreferences: <tag'ler>"` — envanter adları NE İSE o dilde (bugün Türkçe) | `index.ts:610-615` | ~0ms |
| 3 | **Embedding:** Gemini `gemini-embedding-001`, 768d, RETRIEVAL_QUERY, L2-normalize | `index.ts:175-199` | **tahmin** 0.2-0.6s, maliyet ihmal edilebilir |
| 4 | **Retrieval:** `match_recipes` RPC — HNSW cosine, normal havuzdan 8 + `fine-dining` etiketli havuzdan 5 tarif, PARALEL | `index.ts:619-630`, migration'lar | **tahmin** 50-300ms |
| 5 | **Hibrit karar:** top benzerlik ≥0.8 VE 0 eksik → LLM'siz `source:"database"` dönüş (pratikte tetiklenmez, bkz. §1c) | `index.ts:647-668` | ~0ms |
| 6 | **LLM üretimi:** TEK Claude Haiku çağrısı 6 tarifi birden üretir (8 referans tarif prompt bağlamında); fine dining için PARALEL ikinci Haiku çağrısı (2 tarif) | `index.ts:467-534` | **tahmin** 15-30s (6 tarif tek çıktıda, ~5-6K çıktı tokeni; `max_tokens: 8192` sınırına yakın — kesilme riski var) |
| 7 | **Doğrulama:** `toLlmRecipe` minimal tip kontrolü; `missing_count`/`match_pct` yine KODDA hesaplanır | `index.ts:539-588` | ~0ms |
| 8 | Client: dil damgası, fine dining'i ayırma, `mergeRecipeLayers` sıralaması, tek seferde render | `generateRecipesRag.ts:107-111` | ~0ms |

**Tahmini toplam: ~18-35s** (ölçülemedi). Maliyet iki yolun en belirgin
farkı: 10 Sonnet çağrısı yerine 2 Haiku çağrısı + 1 embedding — **tahmin**
üretim başına maliyet ~5-10 kat düşer. Karşılığında: canlı slot gösterimi
yok, çeşitlilik tek çağrının içinde çözülüyor, 6 tarif tek `max_tokens`
bütçesini paylaşıyor.

**Hangisi ne zaman devrede:** karar TEK yerden, build anındaki
`EXPO_PUBLIC_USE_RAG` değerinden verilir (`recipes.tsx:109`). Bugün her
üretim 2a'dan akıyor; 2b'nin çalıştığı tek senaryo `.env`'e üç değişkenin
(URL, anon key, flag) eklenip bundle'ın yeniden alınması.

---

## 3. Veri havuzu envanteri

Supabase'e canlı sorgu atılamadı (bkz. §1b). Aşağıdaki rakamlar, Supabase'e
yüklenen verinin kaynağı olan `data/recipes-normalized.jsonl.gz` dosyasından
(ana repo ve worktree kopyaları MD5-özdeş: `c35dd350…`) — embed script'i
`on_conflict=source_id` upsert'le bu dosyayı yüklediği için Supabase içeriği
büyük olasılıkla bunun birebir kopyası; yine de doğrulama SQL'leri altta.

| Metrik | Değer (yerel korpus) |
|---|---|
| Toplam tarif | **10.000** |
| `fine-dining` etiketli | **0** ⚠️ (bkz. not) |
| Dil | **%100 İngilizce** — 10.000 kayıtta title+malzemelerde tek bir Türkçe karakter yok; örnek başlıklar: "Simple Macaroni and Cheese", "Gourmet Mushroom Risotto", "Dessert Crepes" |
| `source` dağılımı | 10.000 × `huggingface:Shengtao/recipe` (tek kaynak) |
| `prep_time_minutes` dolu | 9.426 (medyan 45 dk, p90 200 dk) |
| `calories` dolu | 9.967 |
| `servings` dolu | 10.000 |

**⚠️ fine-dining = 0 notu:** `scripts/tag-fine-dining.ts`'in kural setini
salt-okunur simüle ettim — commit'li dosya üzerinde **tam 524 eşleşme**
üretiyor (README'deki ölçümle birebir; örnekler: "Gourmet Mushroom Risotto",
"Sesame Seared Tuna", "Cedar Planked Salmon"). Yani kurallar çalışıyor ama
scriptin yeniden yazdığı etiketli gz **commit'lenmemiş**. Supabase
satırlarının etiketlenip etiketlenmediği bilinmiyor. İki risk: (a) Supabase
etiketsizse RAG fine dining retrieval'ı hep boş döner → edge function
sessizce fine dining'siz yanıt verir (graceful degradation,
`index.ts:622-629`); (b) Supabase etiketliyse bile `embed-recipes.ts` bu
dosyadan yeniden koşulursa upsert etiketleri EZER (scriptin dosyayı
etiketli tutma amacı tam da buydu).

**Benzersiz tag dökümü — tamamı 17 adet** (korpusun tag alanı kaba
Allrecipes kategorileri; ilk 40 istenmişti, toplamda zaten 17 var):

| Tag | Kayıt | Tag | Kayıt |
|---|---|---|---|
| desserts | 1.200 | breakfast-and-brunch | 440 |
| side-dish | 1.175 | bread | 392 |
| world-cuisine | 1.151 | trusted-brands-recipes-and-tips | 361 |
| main-dish | 1.123 | uncategorized | 174 |
| salad | 957 | everyday-cooking | 123 |
| appetizers-and-snacks | 775 | drinks | 122 |
| soups-stews-and-chili | 696 | fruits-and-vegetables | 74 |
| meat-and-poultry | 643 | pasta-and-noodles | 36 |
| seafood | 558 | | |

**Supabase doğrulama SQL'leri** (SQL Editor'da çalıştır; hepsi salt-okunur):

```sql
-- Toplam + embedding'i boş kayıt + fine-dining sayısı
select
  count(*)                                        as toplam,
  count(*) filter (where embedding is null)       as embedding_bos,
  count(*) filter (where 'fine-dining' = any(tags)) as fine_dining
from public.recipes;

-- Tag frekansı (yereldeki 17'liyle karşılaştır; fine-dining satırı görünmeli)
select tag, count(*) from public.recipes, unnest(tags) as tag
group by tag order by count(*) desc limit 40;

-- source dağılımı
select source, count(*) from public.recipes group by source;

-- Dil örneklemi (göz kontrolü)
select title, ingredients->0->>'text' as ilk_malzeme
from public.recipes order by random() limit 20;
```

**Güncelleme (canlı probe, 2026-07-18):** `recipes` tablosu Supabase'de
hiç YOK (PGRST205) — yukarıdaki SQL'ler ancak migration'lar uygulanıp
embedding yüklendikten sonra anlamlı. Yerel korpus analizi bu yüzden şu an
"Supabase'e yüklenecek verinin" envanteri olarak okunmalı.

---

## 4. Tercih tag'leriyle sınıflandırma — fizibilite

**Uygulamanın tercih ekranı** ([types/preferences.ts](types/preferences.ts)),
4 kategori × 5 chip = 20 tag:

- **Hedeflenen Profil:** Protein Odaklı · Enerji Deposu · Metabolik Denge · Ketojenik Mod · Definasyon
- **Zamanlama & Amaç:** Güne Başlangıç · Performans Öncesi · Toparlanma · Gün Boyu Stabil · Gece Onarımı
- **Lezzet & Doku:** Çıtır · Yumuşak & Kremamsı · Baharatlı & Keskin · Taze & Ferah · Doyurucu
- **Pişirme Yöntemi:** Pratik & Hızlı · Sağlıklı Fırın · Buhar & Haşlama · Yavaş Pişirme · Çiğ & Karma

**Temel gerçek:** korpusun tag sözlüğü (17 kaba kategori, §3) ile
uygulamanın tercih sözlüğü (fitness/doku/yöntem odaklı) **neredeyse hiç
kesişmiyor**. Görevde örneklenen "Vejetaryen" tarzı bir diyet tag'i ne
uygulamada ne korpusta var (`vegetarian|vegan` başlıkta yalnız 98 kayıt).
Eşleşme potansiyeli tag bazında:

| Tercih | Korpusta doğrudan tag? | Türetilebilir sinyal (yerel ölçüm) |
|---|---|---|
| Güne Başlangıç | ✅ `breakfast-and-brunch` | 440 kayıt — tek temiz doğrudan eşleşme |
| Pratik & Hızlı | ❌ | `prep_time_minutes <= 30` → **2.968 kayıt** (alan 9.426 kayıtta dolu) — güçlü türetilmiş filtre |
| Ketojenik Mod / Definasyon | ❌ | başlıkta keto/low-carb yalnız 78; makro alanı korpusta YOK — mevcut veriyle filtrelenemez |
| Protein Odaklı | ❌ | `meat-and-poultry`(643)+`seafood`(558) kaba vekil; başlıkta "protein" 7 |
| Yavaş Pişirme | ❌ | başlıkta slow-cooker/crock 153 |
| Sağlıklı Fırın | ❌ | başlıkta baked/roasted/oven ~500 |
| Buhar & Haşlama | ❌ | başlıkta steam/boil/poach yalnız 55 — havuz yetersiz |
| Çıtır / Kremamsı / Baharatlı / Taze | ❌ | başlık sinyalleri 77-398 arası — zayıf ve gürültülü |
| Enerji Deposu, Metabolik Denge, Performans Öncesi, Toparlanma, Gün Boyu Stabil, Gece Onarımı, Doyurucu, Çiğ & Karma | ❌ | anlamlı yapısal sinyal yok — bunlar zaten LLM'in yorumlaması gereken soyut kavramlar |

### Seçeneklerin karşılaştırması

**a) DB'de sınıflandırıp retrieval'da sert filtre (`filter_tag` kalıbı):**
Altyapı hazır ve ucuz — `match_recipes` zaten opsiyonel `filter_tag` alıyor
(fine-dining migration'ı), edge function'a parametre geçirmek küçük iş. Asıl
emek VERİ tarafında: 20 tercihin ~14'ü için korpusta etiket yok; tek seferlik
bir toplu LLM sınıflandırma geçişi gerekir (10k başlık+malzeme listesi,
Haiku ile batch — **tahmin** birkaç dolar + yarım günlük script işi,
`tag-fine-dining.ts` kalıbının LLM'li versiyonu). Havuz yeterliliği riski
gerçek: sert filtre "Buhar & Haşlama"da ~55, "Ketojenik"te ~78 kayda düşer —
retrieval 5-8 komşu isterken bu kadar dar havuzda benzerlik kalitesi çöker.
Ayrıca çoklu tercih seçiminde (AND) kesişim hızla boşalır.

**b) Sadece sorgu metni + prompt (bugünkü durum):** Tercihler zaten
`queryText`'e (`index.ts:613-615`) ve prompt kurallarına
(`buildSharedRules`, `index.ts:388-390`) giriyor. Sıfır ek emek. Zaaf:
Türkçe soyut tag'ler ("Gece Onarımı") İngilizce korpus embedding uzayında
zayıf sinyal — retrieval'ı anlamlı bükmez; işin çoğunu üretim LLM'i yapar.
Bu, tercihleri "yumuşak stil yönlendirmesi" olarak zaten makul karşılar.

**c) Hibrit — sert filtre az ve yapısal, gerisi yumuşak:** En iyi
maliyet/fayda. Sert tarafta yalnız **yapısal, veri-destekli** kısıtlar:
`Pratik & Hızlı → prep_time_minutes <= 30` (2.968 kayıt, tag'e bile gerek
yok — `match_recipes`'e opsiyonel `max_prep_time` parametresi), `Güne
Başlangıç → breakfast-and-brunch` (440), istenirse `desserts` dışlama.
Geri kalan 17 tercih prompt'ta yumuşak sinyal kalır. Diyet kısıtları
(Ketojenik, ileride Vejetaryen) sert filtreyi HAK EDER ama önce (a)'daki
etiketleme geçişi yapılmadan filtrelenemez — havuz sayıları ölçülüp
yeterliyse açılır.

**Net öneri:** **(c) hibrit, iki adımda.** Önce sıfır-veri-emeği kısımlar
(prep_time + breakfast filtresi — fine-dining `filter_tag` kalıbının
kopyası); diyet/profil tag'leri için toplu LLM etiketleme ayrı bir iş olarak
planlanır ve her tag açılmadan önce havuz sayısı (≥300 kalıbı, fine-dining'de
olduğu gibi) doğrulanır. (a)'yı tek başına yapmak dar havuz + AND-kesişim
riskiyle retrieval kalitesini düşürür; (b)'de kalmak ise "tercihler
retrieval'ı hiç etkilemiyor" durumunu kalıcılaştırır.

---

## 5. Görseller ne zaman oluşuyor?

Yaşam döngüsü ([services/images/](services/images/recipe-image.ts)):

1. **Tetik = kart mount'u.** Üretim, tarif listesi state'e yazılıp
   `RecipeCard`/`RecipeHeroImage` render olduğu anda `useRecipeImage`
   hook'uyla başlar ([useRecipeImage.ts:38-53](services/images/useRecipeImage.ts)) —
   tarif üretiminin parçası DEĞİL, ayrı ve sonradan. Web'de hiç çalışmaz
   (bilinçli guard, satır 44).
2. **Önce senkron cache kontrolü:** `getCachedRecipeImage`
   ([recipe-image.ts:83-94](services/images/recipe-image.ts)) FileSystem
   cache'ine (`Paths.cache/recipe-images/`) **TARİF ADI** anahtarıyla bakar
   (slug+hash). Varsa API'ye hiç gidilmez — envanter değişse bile ad aynıysa
   görsel cache'ten gelir. Yoksa kartta emoji placeholder + pulse görünür.
3. **Sıralı kuyruk:** cache miss'ler `enqueueRecipeImage` ile modül
   seviyesindeki kuyruğa girer ([recipe-image.ts:245-277](services/images/recipe-image.ts));
   aynı anda TEK API çağrısı işler (6-8 kartın birden yüklenmesini önleyen
   maliyet kuralı). Kullanıcı görselleri soldan sağa değil, kuyruk sırasına
   göre TEK TEK belirirken görür; her biri ~3s (~$0.034,
   `gemini-3.1-flash-lite-image`).
4. **Prompt:** `"Appetizing {dish description} Clean food photography, …"`
   ([recipe-image.ts:141-147](services/images/recipe-image.ts)).
   `dishDescription` önceliği: `image_prompt_en` → yoksa
   `"{ad}, a Turkish home-style dish made with {ilk 5 malzeme}"` fallback'i.
5. Orijinal (4:3) + 320px thumbnail cache'e yazılır; hata olursa placeholder
   kalır, kart yeniden mount olunca tekrar denenir.

**`image_prompt_en` iki yolda nasıl doluyor (RAG özelinde):**

- **LLM tarifleri** (hem iki aşamalı yol hem RAG `source:"llm"`): tool
  şemasında ZORUNLU alan — model tarifi üretirken plating cümleli, zengin
  bir İngilizce açıklama yazar. Görsel kalitesi bu yolda tasarlandığı gibi.
- **`source:"database"` tarifleri:** `image_prompt_en = matched.title`
  ([index.ts:305](supabase/functions/generate-recipe/index.ts)) — sadece
  başlık. Prompt `"Appetizing Simple Macaroni and Cheese. Clean food
  photography…"`e döner: plating/malzeme betimlemesi yok. **Etki:** görsel
  üretilebilir ama betimleme fakir olduğu için jenerik/yanlış yorumlanmış
  görsel riski belirgin artar; üstelik fallback'teki malzeme özetinden bile
  yoksundur (alan dolu olduğu için fallback devreye girmez). Not: bu yol
  bugün pratikte hiç tetiklenmediğinden (§1c) gözlemlenebilir bir etkisi
  henüz yok.
- İkincil not: cache anahtarı tarif ADI olduğundan dil değiştirip yeniden
  üretim yapılınca ("Menemen" → "Turkish Scrambled Eggs") aynı yemek için
  ikinci bir görsel üretilir — dil başına ayrı cache maliyeti.

---

## 7. CANLI TEST SONUÇLARI (2026-07-18, kurulum sonrası) + çift dil etkisi

Kurulum bu session'da tamamlandı: migration'lar → lokal fine dining
etiketleme (524) → embedding yüklemesi (10.000 satır) → secrets + function
deploy. Function probe'u 404 → 401'e döndü (deploy doğrulandı) ve toplam
**8 gerçek çağrı** koşuldu. İkinci test turu,
`claude/instagram-tutorial-images-46a9e7` branch'indeki **çift dilli
envanter** davranışına göre tasarlandı (İş 3: `InventoryItem.nameTr/nameEn`,
`simplifyInventory(inventory, language)` — RAG client'ı envanteri AKTİF
dilin adlarıyla gönderir; yanıta `applyInventoryReconciliation` uygulanır):
**aynı mantıksal envanter** TR ve EN adlarla ayrı ayrı gönderildi ki dil
değişkeni izole ölçülsün.

### 7a. Sonuç matrisi

8 ürünlük buzdolabı seti (domates/tomato, yumurta/eggs, beyaz peynir/feta,
tavuk göğsü/chicken breast, patates/potatoes, yoğurt/yogurt, süt/milk,
pirinç/rice), tercihler "Protein Odaklı, Pratik & Hızlı":

| Test | Girdi | Süre | source | topSim | Tarif (FD) | Server "eksik" toplamı |
|---|---|---|---|---|---|---|
| T1 TR mod (gerçek) | TR envanter + TR kiler + Turkish | **37.8s** | llm | 0.7219 | 8 (2) | 0 |
| T2 EN mod (gerçek: kiler TR kalır) | EN envanter + TR kiler + English | **28.8s** | llm | 0.7553 | 8 (2) | **12 ⚠️** |
| T3 EN mod (ideal: kiler de EN) | EN envanter + EN kiler + English | **29.2s** | llm | 0.7553 | 8 (2) | 2 |
| T4 Kısayol-TR | makarna seti TR + Turkish | 30.3s | llm | 0.7474 | 6 (**0** ⚠️) | 2 |
| T5 Kısayol-EN (kiler TR) | macaroni seti EN + English | 29.2s | **llm ⚠️** | **0.8029** | 6 (**0** ⚠️) | 0 |
| (ilk tur C) Kısayol-EN (kiler EN) | macaroni seti EN + English | **0.7s** | **database** | 0.8029 | **1** | 0 |

İlk turda (farklı envanterlerle) TR 36.8s / EN 31.1s ölçülmüştü — desen
tutarlı: **TR çıktı ~37-38s, EN çıktı ~29-31s (≈%25 daha hızlı)**. Neden
tahmini: Türkçe metin Haiku için daha fazla çıktı tokenı üretiyor (maliyete
de aynı oranda yansır). Retrieval çok dilli embedding sayesinde TR
envanterle de isabetli ("yumurta, beyaz peynir…" sorgusu "Turkish Eggs
(Cilbir)", "Feta Eggs" getirdi) ama benzerlik EN adlarla belirgin yüksek
(0.755 vs 0.722).

### 7b. Bulgu 1 — Kiler çift dilli DEĞİL: EN modda sahte-eksik + kısayol blokajı

İş 3 envanteri ve sepeti çift dilli yaptı ama **`pantry` hep Türkçe
gidiyor** (`generateRecipesRag.ts` → `pantry: options.activePantryNames`,
`PANTRY_STAPLES` Türkçe). İki ölçülmüş sonucu var:

1. **Sahte eksikler (T2 vs T3):** EN modda model İngilizce "salt / black
   pepper / olive oil" yazıyor, prompt'taki kiler listesi "tuz / karabiber /
   zeytinyağı" olduğu için bağ kuramıyor → 8 tarifte toplam **12 sahte
   eksik** (kiler EN gönderilince 2'ye düşüyor). Client'ın reconciliation
   katmanı bunları KURTARAMAZ — katman yalnızca envantere bakar, kilere
   bakmaz; `computeMissing`'in kiler eşleştirmesi de `namesMatch("salt",
   "tuz")=false` verir. **Yani EN kullanıcı neredeyse her kartta yanlış
   "N eksik" rozeti görür ve tuz/karabiber sepete düşer.**
2. **Kısayol blokajı (T5 vs ilk tur C):** T5'te benzerlik eşiği AŞILDI
   (0.8029 ≥ 0.8) ama kısayol tetiklenmedi — korpus tarifinin "salt"ı TR
   kiler listesinde karşılık bulamayınca `countMissing > 0`. Kiler EN
   gönderilince (C) kısayol tetiklendi: **0.7s, sıfır LLM maliyeti** (llm
   yoluna göre ~40× hızlı). Hibrit kısayolun tek gerçekçi tetiklenme
   senaryosu EN moddur ve bugün kiler yüzünden orada da ölüdür.

Düzeltme ucuz: `PANTRY_STAPLES` 20 maddelik SABİT liste — statik EN
karşılıklar (LLM'siz) eklenip aktif dile göre gönderilmesi ve
`computeMissing`/reconciliation'ın kileri de iki dilli eşleştirmesi yeter.

### 7c. Bulgu 2 — Fine dining retrieval'ı güvenilmez: HNSW + tag filtresi tuzağı

`fineDiningTitles` sonuçları: yumurta/kahvaltı sorgusunda 5, tavuk/pilav
sorgusunda 2, makarna sorgularında **0** (T4, T5 ve ilk tur C — üçünde de
fine dining tarifi hiç üretilmedi, yanıt 6 tarife düştü). Havuzda 524
etiketli kayıt varken 0 dönmesinin en olası nedeni pgvector'un bilinen
filtreli-arama tuzağı: HNSW index taraması en yakın ~`ef_search` (varsayılan
40) adayı getirir, `filter_tag` SONRADAN uygulanır — etiketli kayıtlar
havuzun ~%5'i olduğundan top-40 komşuda ortalama ~2 etiketli kayıt bulunur;
sorgu bölgesi fine-dining-fakiri ise (mac & cheese kümesi bilinçli
dışlanmıştı) 0 kalır. Kanıt deseni (5→2→0) bu teşhisle birebir uyumlu.
Doğrulama SQL'i (Dashboard):

```sql
set local hnsw.ef_search = 400;  -- veya: iterative scan / partial index
-- aynı sorgu embedding'iyle match_recipes(..., 'fine-dining') tekrar dene
```

Kalıcı çözüm adayları (biri yeter): (a) 524 satır için `where 'fine-dining'
= any(tags)` alt-sorgusunda **exact scan** (524 satırda index'e gerek yok,
maliyet önemsiz — en basit ve garantili), (b) `hnsw.iterative_scan`
(pgvector ≥0.8), (c) etiketli satırlara partial HNSW index.

### 7d. Kalite gözlemleri (canlı çıktılardan)

- Tarif isimleri/çeşitliliği makul; referans tariflerin izi görülüyor
  ("Cilbir Tarzı", frittata/risotto varyantları). TR çıktıda ara sıra
  dil pürüzü var ("Tavuk Rolü", "Yoğurtlu Tavuk Marinatı Grili" gibi
  yapay adlandırmalar) — Haiku'nun Türkçesi Sonnet'ten belirgin zayıf,
  kalite karşılaştırması flag kararından önce göz'le yapılmalı.
- `missing_count` LLM yolunda genelde tutarlı; fine dining tariflerinde
  kasıtlı 1-3 eksik dönüyor (tasarım gereği).
- Kısayol yanıtı (C) tek tarif döndürüyor — §1c'deki UX sorunu canlıda da
  doğrulandı (liste 1 karta düşer, kcal/makro 0, adımlar İngilizce).

## 8. Önerilen sonraki adımlar (öncelik sıralı — canlı test sonrası güncel)

> ✅ Tamamlananlar (bu session, 2026-07-18): Supabase kurulumu (migration +
> etiketli embedding yüklemesi + secrets + deploy), lokal fine dining
> etiketleme (524) ve 8 çağrılık canlı test turu (§7). İlk sürümün
> "kurulum + canlı test" maddeleri kapandı.

1. ✅ **UYGULANDI (2026-07-18): Kiler prompt dili düzeltildi (§7b).**
   `pantryPromptNames` (src/i18n/inventoryI18n.ts) varsayılan 20 kiler
   malzemesini statik i18n etiketiyle çevirir (LLM yok); iki aşamalı yol
   aktif dilde, RAG hattı HER ZAMAN İngilizce kiler gönderir. Not: UI
   eşleştirmesi (`expandPantryForMatching`) zaten iki dilliydi — kod
   incelemesinde görüldü, rozetler bu branch'te güvendeydi; düzeltme istek
   tarafını kapattı. Canlı doğrulama: gerçek EN kiler listesiyle 6/6 tarif
   0 eksik döndü. Ayrıca DİL POLİTİKASI değişti (kullanıcı kararı): RAG
   hattı artık uygulama dilinden bağımsız hep İngilizce üretir, TR gösterim
   üretim sonrası `ensureRecipeTranslations` ile — bkz. SKILL.md "RAG-EN".
2. ✅ **UYGULANDI (2026-07-18): Fine dining exact-scan migration'ı yazıldı
   (§7c)** — `supabase/migrations/20260718300000_match_recipes_fine_dining_exact.sql`:
   filter_tag doluyken materialized CTE ile 524 satırda tam tarama, null'ken
   eski HNSW yolu. `supabase db push` sonrası makarna sorgusunda
   fineDiningTitles=5 beklenir (push öncesi 0 — doğrulama bekliyor).
3. **Etiketli korpusu commit'le.** `tag-fine-dining.ts` lokal gz'yi bu
   session'da güncelledi (524 etiket) ama dosya henüz commit'lenmedi —
   commit'lenmezse gelecekte `embed-recipes.ts` tam upsert'i Supabase'deki
   etiketleri siler.
4. **Flag kararını dil bazlı düşün.** EN mod RAG'de ~%25 daha hızlı ve
   retrieval isabeti daha yüksek (§7a); TR modda Haiku'nun dil pürüzleri
   var (§7d). Seçenekler: (a) flag'i yalnız EN dilde aç, (b) TR için
   `RAG_GENERATION_MODEL`'i sonnet'e yükseltip maliyet/hız yeniden ölç,
   (c) iki aşamalı yolda kal. Karar öncesi aynı envanterle iki yolun
   çıktısını göz kalitesiyle yan yana karşılaştır (§7a çıktıları hazır).
5. **Hibrit kısayolun davranışını düzelt veya kaldır (§1c; canlıda
   doğrulandı, §7d).** Tek tarif + 0 kcal/makro + İngilizce adımlar
   dönüyor; kiler düzeltmesi (madde 1) sonrası EN modda gerçekten
   tetiklenmeye başlayacak — ya `count` tarife tamamla + alanları
   zenginleştir ya da eşiği fiilen kapat.
6. **`source:"database"` tariflerinde `image_prompt_en`'i zenginleştir**
   (başlık + ilk 4-5 malzeme) — kısayol canlanınca görsel kalite farkı
   görünür olacak (§5).
7. **Tercih filtreleri için hibrit planı başlat** (§4): önce
   `prep_time`/`breakfast` yapısal filtreleri (filter_tag kalıbı),
   diyet/profil tag'leri için toplu LLM etiketleme ayrı iş.
8. **Edge function'a gözlemlenebilirlik ekle:** Claude yanıtının
   `stop_reason` + `usage` alanlarını logla — `max_tokens: 8192` 6 tarifte
   sınıra yakın (kesilme riski) ve dil bazlı gerçek maliyet ancak böyle
   ölçülür.
