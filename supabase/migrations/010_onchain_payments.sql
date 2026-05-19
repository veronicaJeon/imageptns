-- IMAGE PARTNERS - Base USDC onchain payments

alter table public.profiles
  add column if not exists wallet_address text;

alter table public.images
  add column if not exists chain_id integer,
  add column if not exists onchain_asset_id text,
  add column if not exists content_hash text,
  add column if not exists proof_tx_hash text,
  add column if not exists proof_status text not null default 'not_registered',
  add column if not exists proof_registered_at timestamptz;

alter table public.images
  drop constraint if exists images_proof_status_check;

alter table public.images
  add constraint images_proof_status_check
  check (proof_status in ('not_registered','pending','registered','failed'));

create unique index if not exists images_onchain_asset_id_idx
  on public.images(onchain_asset_id)
  where onchain_asset_id is not null;

alter table public.orders
  add column if not exists payment_provider text not null default 'toss',
  add column if not exists chain_id integer,
  add column if not exists payment_token text,
  add column if not exists payment_tx_hash text,
  add column if not exists contract_order_id text,
  add column if not exists crypto_amount numeric,
  add column if not exists crypto_decimals integer,
  add column if not exists crypto_status text not null default 'not_applicable',
  add column if not exists buyer_wallet_address text;

alter table public.orders
  drop constraint if exists orders_payment_provider_check,
  drop constraint if exists orders_crypto_status_check;

alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('toss','base_usdc'));

alter table public.orders
  add constraint orders_crypto_status_check
  check (crypto_status in ('not_applicable','pending','confirmed','failed'));

create unique index if not exists orders_payment_tx_hash_idx
  on public.orders(payment_tx_hash)
  where payment_tx_hash is not null;

create unique index if not exists orders_contract_order_id_idx
  on public.orders(contract_order_id)
  where contract_order_id is not null;

alter table public.earnings_ledger
  add column if not exists settlement_provider text not null default 'offchain',
  add column if not exists claim_status text not null default 'not_applicable',
  add column if not exists claim_tx_hash text,
  add column if not exists claimable_amount numeric;

alter table public.earnings_ledger
  drop constraint if exists earnings_settlement_provider_check,
  drop constraint if exists earnings_claim_status_check;

alter table public.earnings_ledger
  add constraint earnings_settlement_provider_check
  check (settlement_provider in ('offchain','onchain_escrow'));

alter table public.earnings_ledger
  add constraint earnings_claim_status_check
  check (claim_status in ('not_applicable','claimable','claimed'));

create index if not exists earnings_claim_status_idx
  on public.earnings_ledger(claim_status);
