-- IMAGE PARTNERS - subscription renewal bookkeeping

alter table public.subscriptions
  add column if not exists billing_cycle text not null default 'monthly';

alter table public.subscriptions
  drop constraint if exists subscriptions_billing_cycle_check;

alter table public.subscriptions
  add constraint subscriptions_billing_cycle_check
  check (billing_cycle in ('monthly','annual'));

create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  toss_order_id text,
  amount_krw integer,
  status text not null default 'pending' check (status in ('pending','paid','failed')),
  error_message text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_subscription_idx
  on public.subscription_payments(subscription_id, created_at desc);

alter table public.subscription_payments enable row level security;

drop policy if exists "subscription_payments: self select" on public.subscription_payments;
create policy "subscription_payments: self select"
  on public.subscription_payments for select
  using (auth.uid() = user_id);
