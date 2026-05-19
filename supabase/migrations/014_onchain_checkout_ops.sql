-- IMAGE PARTNERS - Onchain checkout hardening and quote snapshots

alter table public.orders
  add column if not exists onchain_quote_usdc_per_krw numeric,
  add column if not exists onchain_quote_source text,
  add column if not exists onchain_quote_created_at timestamptz,
  add column if not exists onchain_quote_expires_at timestamptz,
  add column if not exists onchain_confirm_attempts integer not null default 0,
  add column if not exists onchain_confirm_last_attempt_at timestamptz,
  add column if not exists onchain_confirm_backoff_until timestamptz;

alter table public.orders
  drop constraint if exists orders_onchain_quote_usdc_per_krw_check,
  drop constraint if exists orders_onchain_confirm_attempts_check;

alter table public.orders
  add constraint orders_onchain_quote_usdc_per_krw_check
  check (onchain_quote_usdc_per_krw is null or onchain_quote_usdc_per_krw > 0);

alter table public.orders
  add constraint orders_onchain_confirm_attempts_check
  check (onchain_confirm_attempts >= 0);

create index if not exists orders_onchain_confirm_backoff_idx
  on public.orders(onchain_confirm_backoff_until)
  where onchain_confirm_backoff_until is not null;

create index if not exists orders_onchain_quote_expires_at_idx
  on public.orders(onchain_quote_expires_at)
  where onchain_quote_expires_at is not null;
