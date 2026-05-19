-- IMAGE PARTNERS - Base/onchain operational event log

create table if not exists public.onchain_events (
  id         uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity   text not null,
  actor_id   uuid,
  order_id   uuid,
  image_id   uuid,
  tx_hash    text,
  chain_id   integer,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint onchain_events_severity_check
    check (severity in ('info','warning','error'))
);

create index if not exists onchain_events_event_type_idx
  on public.onchain_events(event_type);

create index if not exists onchain_events_created_at_idx
  on public.onchain_events(created_at desc);

create index if not exists onchain_events_order_id_idx
  on public.onchain_events(order_id);

create index if not exists onchain_events_image_id_idx
  on public.onchain_events(image_id);

create index if not exists onchain_events_tx_hash_idx
  on public.onchain_events(tx_hash);

alter table public.onchain_events enable row level security;
