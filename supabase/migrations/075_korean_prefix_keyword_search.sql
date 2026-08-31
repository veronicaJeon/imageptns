-- Allow Korean keyword queries to match particles and compound suffixes that
-- PostgreSQL's `simple` text search keeps attached to the indexed lexeme.
-- Examples: `북단` -> `북단의`, `한강` -> `한강공원`.

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
  p_min_score real default 0
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
  v_query tsquery;
  v_term text;
  v_term_query tsquery;
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

  -- `simple` keeps Korean particles attached (`북단의`), so an exact
  -- plainto_tsquery for `북단` misses it. Build the same AND query one lexeme
  -- at a time, but use a prefix lexeme for Korean terms of at least two
  -- characters. One-character terms remain exact to avoid broad result sets.
  foreach v_term in array tsvector_to_array(to_tsvector('simple', trim(p_search_query)))
  loop
    if v_term ~ '^[가-힣]{2,}$' then
      v_term_query := to_tsquery('simple', v_term || ':*');
    else
      v_term_query := plainto_tsquery('simple', v_term);
    end if;

    if numnode(v_term_query) > 0 then
      if v_query is null then
        v_query := v_term_query;
      else
        v_query := v_query && v_term_query;
      end if;
    end if;
  end loop;

  if v_query is null or numnode(v_query) = 0 then
    return;
  end if;

  return query
  with ranked as (
    select
      image_row.id,
      ts_rank_cd(
        array[0.1, 0.2, 0.4, 1.0]::real[],
        image_row.fts,
        v_query,
        32
      )::real as score
    from public.images image_row
    where image_row.status = 'approved'
      and image_row.lifecycle_status = 'active'
      and image_row.is_published = true
      and image_row.fts @@ v_query
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
  )
  select ranked.id, ranked.score
  from ranked
  where ranked.score >= p_min_score
  order by ranked.score desc, ranked.id
  limit p_match_count
  offset p_offset;
end;
$$;

revoke all on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real
) from public, anon, authenticated;
grant execute on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real
) to service_role;

comment on function public.rank_keyword_images(
  text, text, text, boolean, boolean, boolean, boolean, integer, integer, real
) is 'Server-only weighted keyword ranking with Korean particle and compound-prefix matching.';

-- Fail a fresh migration if the PostgreSQL text-search behavior this function
-- relies on changes. This block has no persistent data side effects.
do $$
begin
  if not (
    to_tsvector('simple', '서울 한강 북단의 모습')
    @@ (to_tsquery('simple', '한강:*') && to_tsquery('simple', '북단:*'))
  ) then
    raise exception 'Korean prefix search must match attached particles';
  end if;

  if (
    to_tsvector('simple', '서울 한강 남단의 모습')
    @@ (to_tsquery('simple', '한강:*') && to_tsquery('simple', '북단:*'))
  ) then
    raise exception 'Korean multi-term search must preserve AND semantics';
  end if;

  if to_tsvector('simple', '강변') @@ plainto_tsquery('simple', '강') then
    raise exception 'One-character Korean search must remain exact';
  end if;
end;
$$;
