-- Bulgu 2 düzeltmesi (analysis/rag-analysis.md §7c) — fine dining retrieval'ı
-- HNSW post-filter tuzağına takılıyordu: index taraması en yakın ~ef_search
-- (varsayılan 40) adayı getirir, `filter_tag` SONRADAN uygulanır; etiketli
-- kayıtlar havuzun ~%5'i (524/10k) olduğundan sorgu bölgesine göre 0-5 satır
-- kalıyordu (canlı ölçüm: yumurta sorgusunda 5, tavukta 2, makarnada 0 —
-- makarna yanıtlarında fine dining tarifi HİÇ üretilemedi).
--
-- Çözüm: filter_tag İSTENDİĞİNDE index'e hiç girmeyen TAM tarama —
-- materialized CTE, planlayıcının HNSW index'ini kullanmasını engeller;
-- etiketli alt küme küçük olduğu için (~524 satır) maliyet önemsizdir.
-- filter_tag NULL iken davranış öncekiyle birebir aynı (HNSW index yolu).
--
-- Uygulama: `supabase db push`. Edge function DEĞİŞMEDİ (aynı RPC imzası).

drop function if exists public.match_recipes(extensions.vector, int, text);

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
language plpgsql
stable
-- search_path sabitlenir ki fonksiyon SECURITY tanımından bağımsız, şema
-- gölgelemesine karşı güvenli çalışsın.
set search_path = public, extensions
as $$
begin
  if filter_tag is null then
    -- Filtresiz yol: HNSW index üzerinden ANN araması (önceki davranış).
    return query
      select
        r.id, r.source_id, r.title, r.ingredients, r.steps,
        r.prep_time_minutes, r.servings, r.tags, r.calories,
        (1 - (r.embedding <=> query_embedding))::float as similarity
      from public.recipes r
      where r.embedding is not null
      order by r.embedding <=> query_embedding
      limit match_count;
  else
    -- Filtreli yol: önce etiketli alt küme MATERIALIZED CTE'yle toplanır
    -- (index kullanılmaz), sıralama bu küçük küme üzerinde exact yapılır —
    -- havuzda etiketli kayıt olduğu sürece HER ZAMAN match_count satıra
    -- kadar sonuç döner.
    return query
      with tagged as materialized (
        select
          r.id, r.source_id, r.title, r.ingredients, r.steps,
          r.prep_time_minutes, r.servings, r.tags, r.calories, r.embedding
        from public.recipes r
        where r.embedding is not null
          and filter_tag = any(r.tags)
      )
      select
        t.id, t.source_id, t.title, t.ingredients, t.steps,
        t.prep_time_minutes, t.servings, t.tags, t.calories,
        (1 - (t.embedding <=> query_embedding))::float as similarity
      from tagged t
      order by t.embedding <=> query_embedding
      limit match_count;
  end if;
end;
$$;
