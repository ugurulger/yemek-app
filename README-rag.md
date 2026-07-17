# RAG Altyapısı (BLOK A)

Tarif üretimini bir tarif korpusuyla (retrieval-augmented generation)
zenginleştiren altyapı. Mevcut iki aşamalı Claude akışı **değişmedi** — yeni
akış `EXPO_PUBLIC_USE_RAG=true` feature flag'inin arkasındadır (A6).

## Bileşenler

| Parça | Dosya | Ne yapar |
|---|---|---|
| Veri seti hazırlama | `scripts/prepare-dataset.ts` | HF `Shengtao/recipe` setinden ~10k İngilizce tarifi indirir, normalize eder, metriğe çevirir → `data/recipes-normalized.jsonl.gz` |
| Migration | `supabase/migrations/20260718000000_rag_recipes.sql` | pgvector + `recipes` tablosu + HNSW index + `match_recipes()` |
| Embedding yükleme | `scripts/embed-recipes.ts` | title+ingredients embedding'i (Gemini, 768d) üretip Supabase'e upsert eder (batch + resume) |
| Edge function | `supabase/functions/generate-recipe/` | retrieval → hibrit kısayol → Claude Haiku ile üretim (dil parametrik) |
| Client | `lib/rag/generateRecipesRag.ts` + `app/(tabs)/recipes.tsx` | Flag açıkken üretimi edge function'a yönlendirir |

> **Veri seti notu:** Görev Food.com/RecipeNLG öneriyordu; Food.com'un HF
> aynasında malzeme **birimleri yok** (miktarlar "1", "1/2" ama neyin?) —
> metrik dönüşüm imkânsız; RecipeNLG ise form onayı gerektiren gated bir set.
> Bu yüzden aynı nitelikte, tam "1 pound X" formatlı, süre/porsiyon/kalori/
> kategori alanları olan ~32.7k tariflik açık `Shengtao/recipe` (Allrecipes
> tabanlı) seti kullanıldı.

## Kurulum adımları (lokal)

### 0) Supabase projesi

Henüz Supabase kurulu değilse: [supabase.com](https://supabase.com)'da proje
aç, `supabase` CLI'ı kur (`brew install supabase/tap/supabase`) ve projeye
bağlan:

```sh
supabase login
supabase link --project-ref <PROJECT_REF>
```

`.env`'e client değişkenlerini ekle (bkz. `.env.example`):

```sh
EXPO_PUBLIC_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

### 1) Migration'ı uygula

```sh
supabase db push
```

(İstersen SQL Editor'da `supabase/migrations/20260718000000_rag_recipes.sql`
içeriğini elle de çalıştırabilirsin.) Bu; pgvector'ı aktive eder, `recipes`
tablosunu, HNSW indexini ve `match_recipes(query_embedding, match_count)`
fonksiyonunu oluşturur. Tabloda RLS açıktır ve **hiç politika yoktur** —
client doğrudan erişemez, erişim yalnızca service-role iledir (edge function
+ embed script).

### 2) Veri setini hazırla (gerekirse)

`data/recipes-normalized.jsonl.gz` repoda hazır geliyorsa bu adımı atla.
Yeniden üretmek için (yalnızca ağ gerekir, API anahtarı gerekmez):

```sh
npx tsx scripts/prepare-dataset.ts
```

HF datasets-server hız sınırına takılırsa script bekleyip devam eder
(~10-20 dk sürebilir).

### 3) Embedding'leri üret ve yükle

```sh
SUPABASE_URL=https://<PROJECT_REF>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key> \
npx tsx scripts/embed-recipes.ts
```

- Gemini anahtarı `.env`'deki `EXPO_PUBLIC_GOOGLE_API_KEY`'den okunur
  (istersen `GOOGLE_API_KEY` ile override et).
- 50'lik batch'lerle çalışır, her batch sonrası `data/.embed-checkpoint.json`a
  ilerleme yazar — **kesilirse aynı komut kaldığı yerden devam eder.**
  Baştan başlamak için o dosyayı sil.
- Upsert `on_conflict=source_id` ile yapılır; script'i tekrar çalıştırmak
  güvenlidir (duplikasyon üretmez).
- Maliyet notu: 10k × ~50 token, gemini-embedding-001 — önemsiz seviyede.

### 4) Edge function'ı deploy et

```sh
supabase secrets set ANTHROPIC_API_KEY=<anthropic key> GOOGLE_API_KEY=<google key>
supabase functions deploy generate-recipe
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` Supabase tarafından function
environment'ına otomatik enjekte edilir. **API anahtarları yalnızca burada
yaşar — client'a asla girmez.**

Opsiyonel config (env ile override, `supabase secrets set ...`):

| Değişken | Varsayılan | Anlamı |
|---|---|---|
| `RAG_MATCH_THRESHOLD` | `0.8` | Hibrit kısayol benzerlik eşiği (cosine) |
| `RAG_MATCH_COUNT` | `8` | Retrieval'da çekilen tarif sayısı |
| `RAG_GENERATION_MODEL` | `claude-haiku-4-5` | Üretim modeli (ucuz model) |
| `RAG_RECIPE_COUNT` | `6` | Varsayılan üretilen tarif sayısı |

### 5) Uygulamada aç

`.env`:

```sh
EXPO_PUBLIC_USE_RAG=true
```

Flag kapalıyken (varsayılan) mevcut akış aynen çalışır; diğer session'ların
üzerinde çalıştığı hiçbir davranış değişmez.

## Edge function sözleşmesi

`POST /functions/v1/generate-recipe` (anon key ile):

```jsonc
{
  "inventory": [{ "name": "domates", "qty": 4, "unit": "adet" }],
  "preferences": ["Protein Odaklı", "Pratik & Hızlı"],  // tercih ekranı tag'leri
  "pantry": ["tuz", "zeytinyağı"],                        // aktif kiler
  "servings": 2,                 // opsiyonel kişi sayısı
  "language": "Turkish",         // çıktı dili — varsayılan "English"
  "count": 6                     // üretilecek tarif sayısı
}
```

Yanıt: `{ source: "database" | "llm", recipes: Recipe[], retrieval: {...} }`
— `recipes` uygulamanın mevcut `Recipe` şemasındadır (types/recipe.ts) +
tarif başına `source` alanı.

**Hibrit kısayol (A5):** en benzer tarifin benzerliği `RAG_MATCH_THRESHOLD`
üstünde **ve** eksik malzeme sayısı 0 ise LLM hiç çağrılmaz, korpus tarifi
`source: "database"` ile döner. Eksik hesabı basit ad-içerme eşleştirmesiyle
yapılır; korpus İngilizce, envanter Türkçe olduğundan diller karışıkken
kısayol nadiren tetiklenir — bilinçli MVP sınırı (i18n dönüşümü [BLOK B]
İngilizce envanterle bu kısayolu anlamlı hale getirir).

## Teknik kararlar

- **Embedding:** `gemini-embedding-001`, `outputDimensionality: 768`,
  L2-normalize (768'e kesilen vektörler normalize dönmez — cosine için şart).
  Korpus `RETRIEVAL_DOCUMENT`, sorgu `RETRIEVAL_QUERY` task tipiyle. Boyut
  değiştirilecekse migration'daki `vector(768)` + index + `match_recipes`
  imzası + iki script birlikte güncellenmeli.
- **Index:** HNSW (ivfflat değil) — boş tabloya kurulabilir, veri arttıkça
  yeniden eğitim istemez; ~10k satırda varsayılan parametreler yeterli.
- **Üretim modeli:** proje tarif üretiminde Claude kullandığı için ucuz model
  Claude Haiku seçildi (görevdeki "projede hangisi kuruluysa" kuralı);
  zorunlu tool-use ile şema garanti (mevcut akışla aynı desen).
- **`recipes` tablosu global korpustur** — SKILL.md'deki kullanıcı-bazlı
  hedef `recipes(user_id, ...)` tablosu DEĞİLDİR; o ileride kurulursa ayrı
  ad/şema gerekir.
