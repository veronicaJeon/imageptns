create or replace function public.search_images(
  search_query      text,
  category_filter   text default '',
  lim               int  default 40,
  off               int  default 0
)
returns table (
  id                    uuid,
  asset_id              text,
  title                 text,
  category              text,
  tags                  text[],
  storage_path_preview  text,
  width                 integer,
  height                integer,
  photographer_id       uuid,
  photographer_name     text,
  rank                  float4
)
language sql stable security definer
as $$
  select
    i.id,
    i.asset_id,
    i.title,
    i.category,
    i.tags,
    i.storage_path_preview,
    i.width,
    i.height,
    i.photographer_id,
    p.full_name,
    ts_rank(i.fts, plainto_tsquery('simple', search_query))::float4 as rank
  from public.images i
  left join public.profiles p on p.id = i.photographer_id
  where i.status = 'approved'
    and i.fts @@ plainto_tsquery('simple', search_query)
    and (category_filter = '' or i.category = category_filter)
  order by rank desc
  limit lim
  offset off;
$$;

grant execute on function public.search_images(text, text, int, int) to anon, authenticated;
