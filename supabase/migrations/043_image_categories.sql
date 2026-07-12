-- IMAGE PARTNERS - Admin-managed image categories and multi-category assignments

alter table public.images
  drop constraint if exists images_category_check;

create table if not exists public.image_categories (
  code text primary key,
  label_ko text not null,
  label_en text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_categories_code_check
    check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$')
);

insert into public.image_categories (code, label_ko, label_en, sort_order, active)
values
  ('nature', '자연/풍경', 'Nature / Landscape', 10, true),
  ('heritage', '역사/문화재', 'History / Heritage', 20, true),
  ('architecture', '도시/건축', 'Urban / Architecture', 30, true),
  ('people', '인물/생활', 'People / Lifestyle', 40, true),
  ('editorial', '보도/현장', 'Editorial / Documentary', 50, true),
  ('object', '예술/오브제', 'Art / Object', 60, true),
  ('education', '교육자료', 'Educational Material', 70, true),
  ('urban', '도시/거리', 'City / Street', 80, true),
  ('abstract', '추상/배경', 'Abstract / Background', 90, true)
on conflict (code) do update
set label_ko = excluded.label_ko,
    label_en = excluded.label_en,
    sort_order = excluded.sort_order,
    active = excluded.active,
    updated_at = now();

insert into public.image_categories (code, label_ko, label_en, sort_order, active)
select distinct i.category, i.category, i.category, 1000, true
from public.images i
where i.category is not null
  and i.category <> ''
  and not exists (
    select 1 from public.image_categories c where c.code = i.category
  );

create table if not exists public.image_category_assignments (
  image_id uuid not null references public.images(id) on delete cascade,
  category_code text not null references public.image_categories(code) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (image_id, category_code)
);

create unique index if not exists image_category_assignments_primary_unique_idx
  on public.image_category_assignments(image_id)
  where is_primary = true;

create index if not exists image_category_assignments_category_idx
  on public.image_category_assignments(category_code, image_id);

insert into public.image_category_assignments (image_id, category_code, is_primary)
select i.id, i.category, true
from public.images i
where i.category is not null
  and i.category <> ''
on conflict (image_id, category_code) do update
set is_primary = excluded.is_primary;

alter table public.image_categories enable row level security;
alter table public.image_category_assignments enable row level security;

drop policy if exists "image_categories: public active select" on public.image_categories;
create policy "image_categories: public active select"
  on public.image_categories for select
  using (active = true);

drop policy if exists "image_categories: admin all" on public.image_categories;
create policy "image_categories: admin all"
  on public.image_categories for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "image_category_assignments: public select" on public.image_category_assignments;
create policy "image_category_assignments: public select"
  on public.image_category_assignments for select
  using (
    exists (
      select 1
      from public.images i
      where i.id = image_id
        and i.status = 'approved'
        and i.lifecycle_status = 'active'
        and i.is_published = true
    )
  );

drop policy if exists "image_category_assignments: admin all" on public.image_category_assignments;
create policy "image_category_assignments: admin all"
  on public.image_category_assignments for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

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
    and i.lifecycle_status = 'active'
    and i.is_published = true
    and i.fts @@ plainto_tsquery('simple', search_query)
    and (
      category_filter = ''
      or i.category = category_filter
      or exists (
        select 1
        from public.image_category_assignments a
        where a.image_id = i.id
          and a.category_code = category_filter
      )
    )
  order by rank desc
  limit lim
  offset off;
$$;

grant execute on function public.search_images(text, text, int, int) to anon, authenticated;
