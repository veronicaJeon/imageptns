-- IMAGE PARTNERS - hard image purge logs

create table if not exists public.image_purge_logs (
  id uuid primary key default gen_random_uuid(),
  image_id uuid,
  asset_id text,
  title text,
  photographer_id uuid references public.profiles(id) on delete set null,
  photographer_name text,
  deleted_by uuid references public.profiles(id) on delete set null,
  delete_kind text not null default 'admin_hard_delete',
  delete_reason text not null,
  status_snapshot text,
  lifecycle_status_snapshot text,
  is_published_snapshot boolean,
  storage_paths_snapshot jsonb not null default '{}'::jsonb,
  reference_counts_snapshot jsonb not null default '{}'::jsonb,
  image_created_at timestamptz,
  purged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint image_purge_logs_delete_kind_check
    check (delete_kind in ('beta_cleanup','admin_hard_delete','photographer_request'))
);

create index if not exists image_purge_logs_asset_idx
  on public.image_purge_logs(asset_id);

create index if not exists image_purge_logs_purged_idx
  on public.image_purge_logs(purged_at desc);

create index if not exists image_purge_logs_deleted_by_idx
  on public.image_purge_logs(deleted_by, purged_at desc);

alter table public.image_purge_logs enable row level security;

drop policy if exists "image_purge_logs: admin select" on public.image_purge_logs;
create policy "image_purge_logs: admin select"
  on public.image_purge_logs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "image_purge_logs: admin insert" on public.image_purge_logs;
create policy "image_purge_logs: admin insert"
  on public.image_purge_logs for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
