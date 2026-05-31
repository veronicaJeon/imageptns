-- IMAGE PARTNERS - Self-funded Arweave registration fee payments
-- Photographers pay a fee (Toss) before admin can register pre-sale images on Arweave.

create table if not exists public.arweave_registration_fee_orders (
  id uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  toss_order_id uuid not null unique,
  toss_payment_key text,
  unit_fee_krw integer not null,
  image_count integer not null,
  amount_krw integer not null,
  status text not null default 'pending',
  billing_name text,
  billing_email text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  canceled_at timestamptz,
  refunded_at timestamptz,
  cancel_reason text,
  constraint arweave_registration_fee_orders_status_check
    check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  constraint arweave_registration_fee_orders_unit_fee_check check (unit_fee_krw >= 0),
  constraint arweave_registration_fee_orders_image_count_check check (image_count > 0),
  constraint arweave_registration_fee_orders_amount_check check (amount_krw >= 0)
);

create index if not exists arweave_registration_fee_orders_photographer_idx
  on public.arweave_registration_fee_orders(photographer_id);
create index if not exists arweave_registration_fee_orders_status_idx
  on public.arweave_registration_fee_orders(status);

create table if not exists public.arweave_registration_fee_order_items (
  id uuid primary key default gen_random_uuid(),
  fee_order_id uuid not null references public.arweave_registration_fee_orders(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  fee_krw integer not null,
  created_at timestamptz not null default now(),
  constraint arweave_registration_fee_order_items_fee_check check (fee_krw >= 0)
);

create unique index if not exists arweave_registration_fee_order_items_unique_idx
  on public.arweave_registration_fee_order_items(fee_order_id, image_id);
create index if not exists arweave_registration_fee_order_items_image_idx
  on public.arweave_registration_fee_order_items(image_id);

alter table public.arweave_registration_fee_orders enable row level security;
alter table public.arweave_registration_fee_order_items enable row level security;

drop policy if exists "arweave_fee_orders: self or admin select" on public.arweave_registration_fee_orders;
create policy "arweave_fee_orders: self or admin select"
  on public.arweave_registration_fee_orders for select
  using (
    photographer_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "arweave_fee_orders: admin write" on public.arweave_registration_fee_orders;
create policy "arweave_fee_orders: admin write"
  on public.arweave_registration_fee_orders for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "arweave_fee_order_items: self or admin select" on public.arweave_registration_fee_order_items;
create policy "arweave_fee_order_items: self or admin select"
  on public.arweave_registration_fee_order_items for select
  using (
    exists (
      select 1 from public.arweave_registration_fee_orders o
      where o.id = fee_order_id
        and (o.photographer_id = auth.uid()
          or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
    )
  );

drop policy if exists "arweave_fee_order_items: admin write" on public.arweave_registration_fee_order_items;
create policy "arweave_fee_order_items: admin write"
  on public.arweave_registration_fee_order_items for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

alter table public.images
  add column if not exists proof_request_payment_status text not null default 'none',
  add column if not exists proof_request_fee_order_id uuid references public.arweave_registration_fee_orders(id) on delete set null;

alter table public.images
  drop constraint if exists images_proof_request_payment_status_check;

alter table public.images
  add constraint images_proof_request_payment_status_check
  check (proof_request_payment_status in ('none', 'pending', 'paid', 'refunded'));

create index if not exists images_proof_request_payment_status_idx
  on public.images(proof_request_payment_status);
