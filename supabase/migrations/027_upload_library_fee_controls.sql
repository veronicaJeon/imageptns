create table if not exists public.platform_fee_settings (
  code text primary key,
  label text not null,
  amount_krw integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint platform_fee_settings_amount_check check (amount_krw >= 0)
);

alter table public.platform_fee_settings enable row level security;

drop policy if exists "platform_fee_settings: admin select" on public.platform_fee_settings;
create policy "platform_fee_settings: admin select"
  on public.platform_fee_settings for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "platform_fee_settings: admin write" on public.platform_fee_settings;
create policy "platform_fee_settings: admin write"
  on public.platform_fee_settings for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

insert into public.platform_fee_settings (code, label, amount_krw, active)
values
  ('image_delete_simple', '단순 삭제 요청 수수료', 5000, true),
  ('image_delete_complex', '판매/온체인 이력 삭제 요청 수수료', 30000, true)
on conflict (code) do nothing;

alter table public.images
  add column if not exists upload_rotation_degrees integer not null default 0,
  add column if not exists upload_original_width integer,
  add column if not exists upload_original_height integer,
  add column if not exists factuality_attested boolean not null default false,
  add column if not exists factuality_attested_at timestamptz,
  add column if not exists factuality_attestation_version text;

alter table public.images
  drop constraint if exists images_upload_rotation_degrees_check;

alter table public.images
  add constraint images_upload_rotation_degrees_check
  check (upload_rotation_degrees in (0, 90, 180, 270));

create index if not exists images_upload_rotation_degrees_idx
  on public.images(upload_rotation_degrees);

drop function if exists public.search_images(text, text, int, int);
drop function if exists public.search_images(text, text, int, int, text[], boolean);

create or replace function public.search_images(
  search_query      text,
  category_filter   text default '',
  lim               int  default 40,
  off               int  default 0,
  license_filters   text[] default null,
  free_only         boolean default false
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
  copyright_license     text,
  free_usage_policy     text,
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
    i.copyright_license,
    i.free_usage_policy,
    ts_rank(i.fts, plainto_tsquery('simple', search_query))::float4 as rank
  from public.images i
  left join public.profiles p on p.id = i.photographer_id
  where i.status = 'approved'
    and i.lifecycle_status = 'active'
    and i.fts @@ plainto_tsquery('simple', search_query)
    and (category_filter = '' or i.category = category_filter)
    and (
      coalesce(array_length(license_filters, 1), 0) = 0
      or i.copyright_license = any(license_filters)
    )
    and (
      free_only = false
      or i.free_usage_policy <> 'none'
      or i.copyright_license <> 'standard'
    )
  order by rank desc
  limit lim
  offset off;
$$;

grant execute on function public.search_images(text, text, int, int, text[], boolean) to anon, authenticated;
