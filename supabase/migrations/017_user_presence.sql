-- IMAGE PARTNERS - Live user presence

create table if not exists public.user_presence (
  session_id text primary key,
  user_id uuid references public.profiles(id) on delete set null,
  path text,
  referrer text,
  user_agent text,
  ip_hash text,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists user_presence_last_seen_idx
  on public.user_presence(last_seen_at desc);

create index if not exists user_presence_user_idx
  on public.user_presence(user_id)
  where user_id is not null;

alter table public.user_presence enable row level security;

drop policy if exists "user_presence: anyone insert" on public.user_presence;
create policy "user_presence: anyone insert"
  on public.user_presence for insert
  with check (true);
