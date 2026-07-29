-- P0 controls: bind uploads to one user/session and make public API limits durable.

-- Original/full objects can only enter through server-issued signed upload URLs.
-- This prevents approved accounts from bypassing session, quota, and file limits.
drop policy if exists "images-original: photographer upload" on storage.objects;
drop policy if exists "images-original: owner upload" on storage.objects;
drop policy if exists "images-full: owner upload" on storage.objects;

update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
where id in ('images-original', 'images-full');

create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  content_type text not null,
  declared_size_bytes bigint not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'consumed', 'failed', 'expired')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint upload_sessions_size_check
    check (declared_size_bytes between 1 and 104857600)
);

create index if not exists upload_sessions_user_created_idx
  on public.upload_sessions(user_id, created_at desc);
create index if not exists upload_sessions_expiry_idx
  on public.upload_sessions(expires_at);

alter table public.upload_sessions enable row level security;
revoke all on table public.upload_sessions from public, anon, authenticated;
grant all on table public.upload_sessions to service_role;

create table if not exists public.api_rate_limit_windows (
  bucket_key text primary key,
  request_count integer not null,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  constraint api_rate_limit_count_check check (request_count >= 0)
);

create index if not exists api_rate_limit_windows_expiry_idx
  on public.api_rate_limit_windows(expires_at);

alter table public.api_rate_limit_windows enable row level security;
revoke all on table public.api_rate_limit_windows from public, anon, authenticated;
grant all on table public.api_rate_limit_windows to service_role;

create or replace function public.consume_api_rate_limit(
  rate_key text,
  max_requests integer,
  window_seconds integer
)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.api_rate_limit_windows%rowtype;
  v_now timestamptz := clock_timestamp();
  next_expiry timestamptz;
begin
  if rate_key is null or length(rate_key) < 8 or length(rate_key) > 200
     or max_requests < 1 or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(rate_key, 0));

  select * into current_row
  from public.api_rate_limit_windows
  where bucket_key = rate_key
  for update;

  if not found or current_row.expires_at <= v_now then
    next_expiry := v_now + make_interval(secs => window_seconds);
    insert into public.api_rate_limit_windows (
      bucket_key, request_count, window_started_at, expires_at
    )
    values (rate_key, 1, v_now, next_expiry)
    on conflict (bucket_key) do update
      set request_count = 1,
          window_started_at = excluded.window_started_at,
          expires_at = excluded.expires_at;
    return query select true, 0;
    return;
  end if;

  if current_row.request_count >= max_requests then
    return query
      select false, greatest(1, ceil(extract(epoch from current_row.expires_at - v_now))::integer);
    return;
  end if;

  update public.api_rate_limit_windows
  set request_count = request_count + 1
  where bucket_key = rate_key;

  return query select true, 0;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

create or replace function public.purge_expired_api_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.api_rate_limit_windows
  where expires_at < now() - interval '1 day';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_expired_api_rate_limits()
  from public, anon, authenticated;
grant execute on function public.purge_expired_api_rate_limits()
  to service_role;

-- Event ingestion is mediated by validated server routes using service_role.
drop policy if exists "user_events: anyone insert" on public.user_events;
drop policy if exists "user_presence: anyone insert" on public.user_presence;
revoke insert, update, delete on table public.user_events from anon, authenticated;
revoke insert, update, delete on table public.user_presence from anon, authenticated;
grant all on table public.user_events to service_role;
grant all on table public.user_presence to service_role;
