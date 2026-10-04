-- Search autocomplete over every public image instead of an arbitrary sample.
-- Titles and tags of approved, active, published images are matched as
-- literal text (LIKE wildcards in the query are escaped). Terms that start
-- with the query rank first, then terms used by more images.

create or replace function public.suggest_search_terms(
  p_query text,
  p_limit integer default 8
)
returns table (
  term text,
  image_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text;
  v_pattern text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role required';
  end if;
  v_query := lower(trim(coalesce(p_query, '')));
  if char_length(v_query) < 2 or char_length(v_query) > 80 then
    raise exception 'query must be between 2 and 80 characters';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 20 then
    raise exception 'limit must be between 1 and 20';
  end if;

  v_pattern := '%' || replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%';

  return query
  with visible as (
    select image_row.id, image_row.title, image_row.title_ko, image_row.title_en,
           image_row.tags, image_row.tags_ko, image_row.tags_en
    from public.images image_row
    where image_row.status = 'approved'
      and image_row.lifecycle_status = 'active'
      and image_row.is_published = true
  ),
  candidates as (
    select visible.id, trim(candidate.value) as value
    from visible
    cross join lateral (
      select visible.title
      union all select visible.title_ko
      union all select visible.title_en
      union all select unnest(coalesce(visible.tags, array[]::text[]))
      union all select unnest(coalesce(visible.tags_ko, array[]::text[]))
      union all select unnest(coalesce(visible.tags_en, array[]::text[]))
    ) as candidate(value)
    where candidate.value is not null
      and lower(candidate.value) like v_pattern escape '\'
  ),
  grouped as (
    select min(candidates.value) as term,
           count(distinct candidates.id) as image_count,
           bool_or(lower(candidates.value) like replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\') as is_prefix
    from candidates
    where char_length(candidates.value) between 1 and 80
    group by lower(candidates.value)
  )
  select grouped.term, grouped.image_count
  from grouped
  order by grouped.is_prefix desc, grouped.image_count desc, char_length(grouped.term), grouped.term
  limit p_limit;
end;
$$;

revoke all on function public.suggest_search_terms(text, integer)
  from public, anon, authenticated;
grant execute on function public.suggest_search_terms(text, integer) to service_role;

comment on function public.suggest_search_terms(text, integer) is
  'Server-only search autocomplete over titles and tags of public images.';
