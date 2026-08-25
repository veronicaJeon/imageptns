-- Keyword-first public image search.
-- The server calls this service-role-only RPC before deciding whether a
-- semantic provider call is necessary.

create or replace function public.update_image_fts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.fts :=
    setweight(to_tsvector('simple',
      coalesce(new.title, '') || ' ' ||
      coalesce(new.title_ko, '') || ' ' ||
      coalesce(new.title_en, '') || ' ' ||
      coalesce(array_to_string(new.tags, ' '), '') || ' ' ||
      coalesce(array_to_string(new.tags_ko, ' '), '') || ' ' ||
      coalesce(array_to_string(new.tags_en, ' '), '')
    ), 'A') ||
    setweight(to_tsvector('simple',
      coalesce(new.description, '') || ' ' ||
      coalesce(new.description_ko, '') || ' ' ||
      coalesce(new.description_en, '')
    ), 'B') ||
    setweight(to_tsvector('simple', coalesce(new.category, '')), 'C');
  return new;
end;
$$;

-- Rebuild existing rows because replacing the trigger function only affects
-- future writes. Touching a searched metadata column invokes update_image_fts.
update public.images
set title = title;

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

  v_query := plainto_tsquery('simple', trim(p_search_query));
  if numnode(v_query) = 0 then
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
) is 'Server-only weighted keyword ranking for the keyword-first semantic search cascade.';
