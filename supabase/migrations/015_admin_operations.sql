-- ============================================================
-- Admin operations: activity logs, commission policies, audit logs, support inbox
-- ============================================================

create table if not exists public.user_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  session_id  text,
  event_type  text not null check (event_type in (
    'page_view',
    'image_view',
    'search',
    'cart_add',
    'checkout_started',
    'download'
  )),
  path        text,
  image_id    uuid references public.images(id) on delete set null,
  order_id    uuid references public.orders(id) on delete set null,
  referrer    text,
  user_agent  text,
  ip_hash     text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists user_events_user_created_idx on public.user_events(user_id, created_at desc);
create index if not exists user_events_session_created_idx on public.user_events(session_id, created_at desc);
create index if not exists user_events_image_created_idx on public.user_events(image_id, created_at desc);
create index if not exists user_events_type_created_idx on public.user_events(event_type, created_at desc);

alter table public.user_events enable row level security;

drop policy if exists "user_events: anyone insert" on public.user_events;
create policy "user_events: anyone insert"
  on public.user_events for insert
  with check (true);

create table if not exists public.commission_policies (
  id              uuid primary key default gen_random_uuid(),
  scope           text not null check (scope in ('default','license','photographer','image')),
  label           text not null,
  rate            numeric(5,4) not null check (rate >= 0 and rate <= 1),
  active          boolean not null default true,
  license_code    text references public.license_types(code) on delete cascade,
  photographer_id uuid references public.profiles(id) on delete cascade,
  image_id        uuid references public.images(id) on delete cascade,
  starts_at       timestamptz not null default now(),
  ends_at         timestamptz,
  created_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz,
  constraint commission_policies_scope_target check (
    (scope = 'default' and license_code is null and photographer_id is null and image_id is null)
    or (scope = 'license' and license_code is not null and photographer_id is null and image_id is null)
    or (scope = 'photographer' and photographer_id is not null and license_code is null and image_id is null)
    or (scope = 'image' and image_id is not null and license_code is null and photographer_id is null)
  ),
  constraint commission_policies_window check (ends_at is null or ends_at > starts_at)
);

create index if not exists commission_policies_scope_active_idx on public.commission_policies(scope, active, starts_at desc);
create index if not exists commission_policies_license_idx on public.commission_policies(license_code) where license_code is not null;
create index if not exists commission_policies_photographer_idx on public.commission_policies(photographer_id) where photographer_id is not null;
create index if not exists commission_policies_image_idx on public.commission_policies(image_id) where image_id is not null;

alter table public.commission_policies enable row level security;

insert into public.commission_policies (scope, label, rate, active, starts_at)
select 'default', '기본 플랫폼 수수료 20%', 0.2000, true, now()
where not exists (
  select 1 from public.commission_policies where scope = 'default' and active = true
);

create table if not exists public.admin_audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  target_type  text not null,
  target_id    text,
  target_label text,
  before_data  jsonb,
  after_data   jsonb,
  reason       text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists admin_audit_logs_actor_created_idx on public.admin_audit_logs(actor_id, created_at desc);
create index if not exists admin_audit_logs_target_created_idx on public.admin_audit_logs(target_type, target_id, created_at desc);
create index if not exists admin_audit_logs_action_created_idx on public.admin_audit_logs(action, created_at desc);

alter table public.admin_audit_logs enable row level security;

alter table public.contact_submissions
  add column if not exists priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  add column if not exists assigned_to uuid references public.profiles(id) on delete set null,
  add column if not exists admin_note text,
  add column if not exists resolved_at timestamptz,
  add column if not exists updated_at timestamptz;

create index if not exists contact_submissions_status_created_idx on public.contact_submissions(status, created_at desc);
create index if not exists contact_submissions_assigned_idx on public.contact_submissions(assigned_to) where assigned_to is not null;
