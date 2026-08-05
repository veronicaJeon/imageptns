-- The atomic checkout app is live. Prevent authenticated clients from creating
-- arbitrary order headers outside the server-authorized checkout functions.

drop policy if exists "orders: buyer insert" on public.orders;
revoke insert on table public.orders from anon, authenticated;
