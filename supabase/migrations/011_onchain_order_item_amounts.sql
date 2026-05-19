-- IMAGE PARTNERS - Snapshot onchain item amounts

alter table public.order_items
  add column if not exists crypto_gross_amount numeric,
  add column if not exists crypto_net_amount numeric;
