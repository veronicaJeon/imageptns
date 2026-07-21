-- Durable, privacy-conscious operational monitoring events.

create table if not exists public.operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  component text not null,
  status text not null check (status in ('ok', 'warning', 'error')),
  route text,
  provider text,
  status_code integer check (status_code is null or status_code between 100 and 599),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists operational_events_created_at_idx
  on public.operational_events(created_at desc);

create index if not exists operational_events_component_status_created_idx
  on public.operational_events(component, status, created_at desc);

alter table public.operational_events enable row level security;

drop policy if exists "operational_events: admins read" on public.operational_events;
create policy "operational_events: admins read"
  on public.operational_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );

revoke all on table public.operational_events from anon;
revoke insert, update, delete on table public.operational_events from authenticated;
grant select on table public.operational_events to authenticated;
grant all on table public.operational_events to service_role;

comment on table public.operational_events is
  'Sanitized availability, AI, storage, and server error events. Never store request bodies, credentials, emails, or image data.';

create or replace function public.purge_old_operational_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.operational_events
  where created_at < now() - interval '90 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_old_operational_events() from public, anon, authenticated;
grant execute on function public.purge_old_operational_events() to service_role;
