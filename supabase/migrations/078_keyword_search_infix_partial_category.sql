-- Keyword search quality for Korean compounds, partial multi-term matches and
-- localized category names.
--
-- 1. Korean terms of at least two characters also match inside compounds
--    (`공원` -> `한강공원`) through trigram-indexed plain-text columns.
-- 2. `p_match_any` lets the server ask for results that contain only some of
--    the terms after the strict AND search and semantic fallback found none.
-- 3. Category weight C indexes the Korean and English category labels of the
--    primary and assigned categories, not only the internal code.

alter table public.images
  add column if not exists search_text_primary text,
  add column if not exists search_text_secondary text;

comment on column public.images.search_text_primary is
  'Server-maintained lowercase title and tag text for Korean infix keyword matching.';
comment on column public.images.search_text_secondary is
  'Server-maintained lowercase description, caption and category label text for Korean infix keyword matching.';

create index if not exists images_search_text_primary_trgm_idx
  on public.images using gin (search_text_primary gin_trgm_ops);
create index if not exists images_search_text_secondary_trgm_idx
  on public.images using gin (search_text_secondary gin_trgm_ops);

create or replace function public.update_image_fts()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ai_caption text;
  v_category_labels text;
  v_primary text;
  v_secondary text;
begin
  select string_agg(
    coalesce(caption_row.caption_en, '') || ' ' || coalesce(array_to_string(caption_row.keywords_en, ' '), ''),
    ' '
  )
  into v_ai_caption
  from public.image_ai_captions caption_row
  where caption_row.image_id = new.id and caption_row.status = 'ready';

  select string_agg(category_row.code || ' ' || category_row.label_ko || ' ' || category_row.label_en, ' ')
  into v_category_labels
  from public.image_categories category_row
  where category_row.code = new.category
     or exists (
       select 1
       from public.image_category_assignments assignment
       where assignment.image_id = new.id
         and assignment.category_code = category_row.code
     );

  v_primary :=
    coalesce(new.title, '') || ' ' || coalesce(new.title_ko, '') || ' ' || coalesce(new.title_en, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '') || ' ' || coalesce(array_to_string(new.tags_ko, ' '), '') || ' ' ||
    coalesce(array_to_string(new.tags_en, ' '), '');
  v_secondary :=
    coalesce(new.description, '') || ' ' || coalesce(new.description_ko, '') || ' ' ||
    coalesce(new.description_en, '') || ' ' || coalesce(v_ai_caption, '');

  new.fts :=
    setweight(to_tsvector('simple', v_primary), 'A') ||
    setweight(to_tsvector('simple', v_secondary), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.category, '') || ' ' || coalesce(v_category_labels, '')), 'C');
  new.search_text_primary := lower(v_primary);
  new.search_text_secondary := lower(v_secondary || ' ' || coalesce(v_category_labels, ''));
  return new;
end;
$$;

-- Assignments are written after the image row, so refresh the image's search
-- text whenever its category set changes.
create or replace function public.refresh_image_fts_from_category_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    update public.images set title = title where id = old.image_id;
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.image_id is distinct from old.image_id) then
    update public.images set title = title where id = new.image_id;
  end if;
  return null;
end;
$$;

drop trigger if exists refresh_image_fts_after_category_assignment on public.image_category_assignments;
create trigger refresh_image_fts_after_category_assignment
after insert or update or delete on public.image_category_assignments
for each row execute function public.refresh_image_fts_from_category_assignment();

revoke all on function public.refresh_image_fts_from_category_assignment()
  from public, anon, authenticated;

-- Rebuild existing rows so the new columns and category labels are populated.
update public.images
set title = title;

drop function if exists public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real
);

create or replace function public.rank_keyword_images(
  p_search_query text,
  p_category_filter text default '',
  p_orientation_filter text default 'all',
  p_free_only boolean default false,
  p_education_free_only boolean default false,
  p_commercial_only boolean default false,
  p_derivatives_only boolean default false,
  p_match_count integer default 20,
  p_offset integer default 0,
  p_min_score real default 0,
  p_match_any boolean default false
)
returns table (
  image_id uuid,
  keyword_score real
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_term text;
  v_term_query tsquery;
  v_terms text[] := array[]::text[];
  v_queries tsquery[] := array[]::tsquery[];
  v_infix boolean[] := array[]::boolean[];
  v_term_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_search_query is null or char_length(trim(p_search_query)) < 1
     or char_length(p_search_query) > 300 then
    raise exception 'search query must be between 1 and 300 characters';
  end if;
  if p_category_filter is null or char_length(p_category_filter) > 80 then
    raise exception 'invalid category filter';
  end if;
  if p_orientation_filter is null
     or p_orientation_filter not in ('', 'all', 'landscape', 'portrait', 'square') then
    raise exception 'invalid orientation filter';
  end if;
  if p_match_count is null or p_match_count < 1 or p_match_count > 100 then
    raise exception 'match count must be between 1 and 100';
  end if;
  if p_offset is null or p_offset < 0 or p_offset > 10000 then
    raise exception 'offset must be between 0 and 10000';
  end if;
  if p_min_score is null or p_min_score < 0 or p_min_score > 1 then
    raise exception 'minimum score must be between 0 and 1';
  end if;
  if p_match_any is null then
    raise exception 'match mode is required';
  end if;

  -- Korean terms of at least two characters use a prefix lexeme so attached
  -- particles match (`북단` -> `북단의`) and may also match inside compounds
  -- (`공원` -> `한강공원`). One-character and non-Korean terms stay exact.
  foreach v_term in array tsvector_to_array(to_tsvector('simple', trim(p_search_query)))
  loop
    if v_term ~ '^[가-힣]{2,}$' then
      v_term_query := to_tsquery('simple', v_term || ':*');
    else
      v_term_query := plainto_tsquery('simple', v_term);
    end if;

    if numnode(v_term_query) > 0 then
      v_terms := v_terms || v_term;
      v_queries := v_queries || v_term_query;
      v_infix := v_infix || (v_term ~ '^[가-힣]{2,}$');
    end if;
  end loop;

  v_term_count := coalesce(array_length(v_terms, 1), 0);
  if v_term_count = 0 then
    return;
  end if;

  -- Each term scores by its strongest signal: a full-text hit keeps the
  -- weighted cover-density rank (title/tag 0.5, description 0.29, category
  -- 0.17 for one occurrence); an infix-only hit scores 0.3 in titles/tags and
  -- 0.15 elsewhere. The image score is the mean over all query terms, so a
  -- partial match ranks below images that contain more terms. The minimum
  -- score applies to the mean over the matched terms, so a partial result
  -- needs the same signal strength per matched term as a strict result.
  return query
  with visible as (
    select image_row.id, image_row.fts, image_row.search_text_primary, image_row.search_text_secondary
    from public.images image_row
    where image_row.status = 'approved'
      and image_row.lifecycle_status = 'active'
      and image_row.is_published = true
      and (
        p_category_filter = ''
        or image_row.category = p_category_filter
        or exists (
          select 1
          from public.image_category_assignments assignment
          where assignment.image_id = image_row.id
            and assignment.category_code = p_category_filter
        )
      )
      and (
        p_orientation_filter in ('', 'all')
        or image_row.orientation_class = p_orientation_filter
      )
      and (
        not p_education_free_only
        or image_row.free_usage_policy in ('education', 'all')
      )
      and (
        p_education_free_only
        or not p_free_only
        or image_row.free_usage_policy = 'all'
      )
      and (
        not p_commercial_only
        or image_row.copyright_license in ('standard', 'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nd')
      )
      and (
        not p_derivatives_only
        or image_row.copyright_license in ('standard', 'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'cc_by_nc_sa')
      )
  ),
  term_scores as (
    select
      visible.id,
      term.ordinal,
      case
        when visible.fts @@ term.query then
          ts_rank_cd(array[0.1, 0.2, 0.4, 1.0]::real[], visible.fts, term.query, 32)
        when term.infix and visible.search_text_primary like '%' || term.text || '%' then 0.3
        when term.infix and visible.search_text_secondary like '%' || term.text || '%' then 0.15
        else 0
      end::real as score
    from visible
    cross join unnest(v_terms, v_queries, v_infix) with ordinality as term(text, query, infix, ordinal)
  ),
  ranked as (
    select
      term_scores.id,
      (sum(term_scores.score) / v_term_count)::real as score,
      count(*) filter (where term_scores.score > 0) as matched_terms,
      sum(term_scores.score) as score_sum
    from term_scores
    group by term_scores.id
  )
  select ranked.id, ranked.score
  from ranked
  where ranked.matched_terms >= case when p_match_any then 1 else v_term_count end
    and (not p_match_any or v_term_count > 1)
    and ranked.score_sum / greatest(ranked.matched_terms, 1) >= p_min_score
  order by ranked.score desc, ranked.id
  limit p_match_count
  offset p_offset;
end;
$$;

revoke all on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real, boolean
) from public, anon, authenticated;
grant execute on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real, boolean
) to service_role;

comment on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real, boolean
) is 'Server-only weighted keyword ranking with Korean prefix and infix matching, localized category labels and an optional partial-match mode.';

-- Fail a fresh migration if the text behavior this function relies on changes.
do $$
begin
  if not ('서울 한강공원 산책' like '%공원%') then
    raise exception 'Korean infix search must match inside compounds';
  end if;

  if not (
    to_tsvector('simple', 'nature 자연/풍경 Nature / Landscape')
    @@ to_tsquery('simple', '풍경:*')
  ) then
    raise exception 'Category labels must be indexed as separate Korean lexemes';
  end if;
end;
$$;
