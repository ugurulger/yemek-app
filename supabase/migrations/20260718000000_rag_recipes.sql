-- BLOK A / A2 — RAG tarif korpusu: pgvector + recipes tablosu + benzerlik araması.
-- Uygulama: `supabase db push` (veya SQL Editor'da elle çalıştır) — bkz. README-rag.md.
--
-- NOT: Bu tablo GLOBAL bir referans korpusudur (İngilizce tarif veri seti,
-- kullanıcı verisi DEĞİL). SKILL.md'deki hedef mimarinin kullanıcı-bazlı
-- `recipes(user_id, ...)` tablosundan ayrıdır; o tablo ileride kurulursa
-- farklı bir ad/şema ile eklenmelidir.

-- pgvector uzantısı (Supabase'de "extensions" şemasına kurulur).
create extension if not exists vector with schema extensions;

create table if not exists public.recipes (
  id bigint generated always as identity primary key,
  -- Kaynak veri setindeki benzersiz kimlik — embed script'inin resume/upsert anahtarı.
  source_id text not null unique,
  title text not null,
  -- [{ text, name, qty, unit }] — metriğe çevrilmiş satır + çıplak malzeme adı
  -- (bkz. scripts/prepare-dataset.ts, NormalizedIngredient).
  ingredients jsonb not null,
  -- string[] — adım listesi.
  steps jsonb not null,
  prep_time_minutes integer,
  servings integer,
  -- Kaynak setin kategori/cuisine etiketleri.
  tags text[] not null default '{}',
  calories real,
  source text not null default 'huggingface:Shengtao/recipe',
  -- gemini-embedding-001, outputDimensionality=768, L2-normalize edilmiş
  -- (bkz. scripts/embed-recipes.ts). Boyut değişirse bu kolon + index +
  -- match_recipes imzası birlikte güncellenmelidir.
  embedding extensions.vector(768),
  created_at timestamptz not null default now()
);

-- RLS: tablo istemciden DOĞRUDAN okunmaz/yazılmaz (politika tanımlanmadı);
-- erişim yalnızca service-role üzerinden (edge function + embed script).
alter table public.recipes enable row level security;

-- Cosine benzerlik indexi. HNSW seçildi (ivfflat'in aksine boş tabloya da
-- kurulabilir ve veri arttıkça yeniden eğitim gerektirmez); ~10k satır için
-- varsayılan (m=16, ef_construction=64) parametreleri yeterli.
create index if not exists recipes_embedding_hnsw_idx
  on public.recipes
  using hnsw (embedding extensions.vector_cosine_ops);

-- Benzerlik araması: en benzer match_count tarifi similarity (1 - cosine
-- uzaklık) ile birlikte döndürür. Embedding'ler normalize olduğu için cosine
-- similarity doğrudan anlamlıdır.
create or replace function public.match_recipes(
  query_embedding extensions.vector(768),
  match_count int default 8
)
returns table (
  id bigint,
  source_id text,
  title text,
  ingredients jsonb,
  steps jsonb,
  prep_time_minutes integer,
  servings integer,
  tags text[],
  calories real,
  similarity float
)
language sql
stable
-- search_path sabitlenir ki fonksiyon SECURITY tanımından bağımsız, şema
-- gölgelemesine karşı güvenli çalışsın.
set search_path = public, extensions
as $$
  select
    r.id,
    r.source_id,
    r.title,
    r.ingredients,
    r.steps,
    r.prep_time_minutes,
    r.servings,
    r.tags,
    r.calories,
    1 - (r.embedding <=> query_embedding) as similarity
  from public.recipes r
  where r.embedding is not null
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
