-- IMAGE PARTNERS - Allow explicit cancellation of pending orders.
-- Distinguishes a buyer/admin-canceled order from a payment failure.
-- Used by admin manual cancel of stale pending Base USDC orders.

alter table public.orders
  drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'completed', 'failed', 'refunded', 'canceled'));

alter table public.orders
  drop constraint if exists orders_crypto_status_check;
alter table public.orders
  add constraint orders_crypto_status_check
  check (crypto_status in ('not_applicable', 'pending', 'confirmed', 'failed', 'canceled'));
