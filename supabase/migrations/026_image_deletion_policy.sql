-- IMAGE PARTNERS - Safe image deletion and archive workflow

alter table public.images
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text,
  add column if not exists deletion_fee_krw integer not null default 0,
  add column if not exists deletion_fee_status text not null default 'none',
  add column if not exists archived_at timestamptz,
  add column if not exists purged_at timestamptz,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reviewed_at timestamptz,
  add column if not exists deletion_admin_note text;

alter table public.images
  drop constraint if exists images_lifecycle_status_check,
  drop constraint if exists images_deletion_fee_status_check;

alter table public.images
  add constraint images_lifecycle_status_check
  check (lifecycle_status in ('active','deletion_requested','archived','purged','legal_hold'));

alter table public.images
  add constraint images_deletion_fee_status_check
  check (deletion_fee_status in ('none','quoted','waived','pending','paid','failed'));

create index if not exists images_lifecycle_status_idx
  on public.images(lifecycle_status, created_at desc);

create index if not exists images_deletion_requested_idx
  on public.images(lifecycle_status, deletion_requested_at desc)
  where lifecycle_status = 'deletion_requested';

alter table public.order_items
  add column if not exists image_title_snapshot text,
  add column if not exists image_asset_id_snapshot text,
  add column if not exists image_preview_path_snapshot text,
  add column if not exists image_original_path_snapshot text,
  add column if not exists image_original_filename_snapshot text,
  add column if not exists image_lifecycle_status text not null default 'active',
  add column if not exists image_deleted_at timestamptz,
  add column if not exists image_deletion_notice text;

create index if not exists order_items_image_lifecycle_idx
  on public.order_items(image_lifecycle_status, image_id);

update public.order_items oi
set image_title_snapshot = coalesce(oi.image_title_snapshot, i.title),
    image_asset_id_snapshot = coalesce(oi.image_asset_id_snapshot, i.asset_id),
    image_preview_path_snapshot = coalesce(oi.image_preview_path_snapshot, i.storage_path_preview),
    image_original_path_snapshot = coalesce(oi.image_original_path_snapshot, i.storage_path_original),
    image_original_filename_snapshot = coalesce(oi.image_original_filename_snapshot, i.original_filename)
from public.images i
where oi.image_id = i.id;

create table if not exists public.image_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete restrict,
  requester_id uuid references public.profiles(id) on delete set null,
  requester_role text not null default 'photographer',
  reason_category text not null default 'other',
  reason text not null,
  requested_action text not null default 'auto',
  status text not null default 'pending',
  estimated_fee_krw integer not null default 0,
  charged_fee_krw integer not null default 0,
  fee_currency text not null default 'KRW',
  fee_status text not null default 'quoted',
  impact_snapshot jsonb not null default '{}'::jsonb,
  admin_note text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint image_deletion_requests_requester_role_check
    check (requester_role in ('photographer','admin')),
  constraint image_deletion_requests_reason_category_check
    check (reason_category in ('portfolio_cleanup','copyright_issue','privacy_issue','duplicate','quality','other')),
  constraint image_deletion_requests_requested_action_check
    check (requested_action in ('auto','purge','archive')),
  constraint image_deletion_requests_status_check
    check (status in ('pending','approved','rejected','completed','cancelled')),
  constraint image_deletion_requests_fee_status_check
    check (fee_status in ('quoted','waived','pending','paid','failed'))
);

create index if not exists image_deletion_requests_status_created_idx
  on public.image_deletion_requests(status, created_at desc);

create index if not exists image_deletion_requests_image_idx
  on public.image_deletion_requests(image_id, created_at desc);

create index if not exists image_deletion_requests_requester_idx
  on public.image_deletion_requests(requester_id, created_at desc);

alter table public.image_deletion_requests enable row level security;

drop policy if exists "image_deletion_requests: requester select own" on public.image_deletion_requests;
create policy "image_deletion_requests: requester select own"
  on public.image_deletion_requests for select
  using (requester_id = auth.uid());

drop policy if exists "image_deletion_requests: requester insert own" on public.image_deletion_requests;
create policy "image_deletion_requests: requester insert own"
  on public.image_deletion_requests for insert
  with check (requester_id = auth.uid());

drop policy if exists "image_deletion_requests: admin all" on public.image_deletion_requests;
create policy "image_deletion_requests: admin all"
  on public.image_deletion_requests for all
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
    and i.fts @@ plainto_tsquery('simple', search_query)
    and (category_filter = '' or i.category = category_filter)
  order by rank desc
  limit lim
  offset off;
$$;

grant execute on function public.search_images(text, text, int, int) to anon, authenticated;
