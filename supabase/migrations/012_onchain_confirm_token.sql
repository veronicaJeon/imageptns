-- IMAGE PARTNERS - Onchain checkout confirmation token

alter table public.orders
  add column if not exists onchain_confirm_token text;

create unique index if not exists orders_onchain_confirm_token_idx
  on public.orders(onchain_confirm_token)
  where onchain_confirm_token is not null;
