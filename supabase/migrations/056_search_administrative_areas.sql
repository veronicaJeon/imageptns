-- Ranked, bounded search surface for upload location autocomplete.

create or replace function public.search_administrative_areas(
  search_query text,
  result_limit integer default 8
)
returns table (
  code text,
  full_name text,
  leaf_name text,
  level text
)
language sql
stable
security definer
set search_path = public
as $$
  select area.code, area.full_name, area.leaf_name, area.level
  from public.administrative_areas area
  where char_length(trim(search_query)) between 2 and 50
    and area.full_name ilike '%' || trim(search_query) || '%'
  order by
    case
      when area.leaf_name = trim(search_query) then 0
      when area.leaf_name ilike trim(search_query) || '%' then 1
      when area.leaf_name ilike '%' || trim(search_query) || '%' then 2
      else 3
    end,
    char_length(area.full_name),
    area.full_name
  limit least(greatest(result_limit, 1), 20);
$$;

revoke all on function public.search_administrative_areas(text, integer) from public, anon, authenticated;
grant execute on function public.search_administrative_areas(text, integer) to service_role;
