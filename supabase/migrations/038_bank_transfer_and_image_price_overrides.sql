-- IMAGE PARTNERS - first release bank transfer payments and per-image pricing

alter table public.orders
  add column if not exists offline_payment_status text not null default 'not_applicable',
  add column if not exists offline_payment_requested_at timestamptz,
  add column if not exists offline_payment_reviewed_at timestamptz,
  add column if not exists offline_payment_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists offline_payment_note text;

alter table public.orders
  drop constraint if exists orders_payment_provider_check,
  drop constraint if exists orders_offline_payment_status_check;

alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('toss','base_usdc','bank_transfer'));

alter table public.orders
  add constraint orders_offline_payment_status_check
  check (offline_payment_status in ('not_applicable','requested','approved','canceled'));

create index if not exists orders_bank_transfer_requests_idx
  on public.orders(offline_payment_status, created_at desc)
  where payment_provider = 'bank_transfer';

create table if not exists public.image_price_overrides (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references public.images(id) on delete cascade,
  license_code text not null references public.license_types(code) on delete cascade,
  price_krw integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint image_price_overrides_price_check check (price_krw between 0 and 10000000)
);

create unique index if not exists image_price_overrides_unique_idx
  on public.image_price_overrides(image_id, license_code);

create index if not exists image_price_overrides_image_idx
  on public.image_price_overrides(image_id);

alter table public.image_price_overrides enable row level security;

drop policy if exists "image_price_overrides: public select" on public.image_price_overrides;
create policy "image_price_overrides: public select"
  on public.image_price_overrides for select
  using (true);

drop policy if exists "image_price_overrides: admin write" on public.image_price_overrides;
create policy "image_price_overrides: admin write"
  on public.image_price_overrides for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

