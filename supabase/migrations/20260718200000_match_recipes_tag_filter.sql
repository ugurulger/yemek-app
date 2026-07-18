-- İş 1b — match_recipes'e opsiyonel tag filtresi: fine dining araması yalnızca
-- 'fine-dining' etiketli kayıtlarda yapılabilsin (filter_tag null ise davranış
-- öncekiyle birebir aynı). Uygulama: `supabase db push` — bkz. README-rag.md.
--
-- NOT: create or replace ile parametre EKLENEMEZ (farklı imza overload
-- oluşturur ve PostgREST RPC çağrısı iki imza arasında belirsizleşir) —
-- eski fonksiyon önce düşürülür.

drop function if exists public.match_recipes(extensions.vector, int);

create function public.match_recipes(
  query_embedding extensions.vector(768),
  match_count int default 8,
  filter_tag text default null
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
    and (filter_tag is null or filter_tag = any(r.tags))
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
