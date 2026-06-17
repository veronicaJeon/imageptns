-- IMAGE PARTNERS - Treasury fee accounting from on-chain escrow events.
-- Records one receipt per indexed PurchaseCompleted event so platform fees
-- routed to the treasury can be reconciled against on-chain state.
-- (tx_hash, log_index) is the idempotency key for incremental re-scans.

create table if not exists public.treasury_fee_receipts (
  id                uuid primary key default gen_random_uuid(),
  contract_order_id text not null,
  buyer_address     text not null,
  tx_hash           text not null,
  block_number      bigint not null,
  log_index         integer not null,
  chain_id          integer not null,
  gross_units       numeric(78, 0) not null,
  fee_units         numeric(78, 0) not null,
  gross_usdc        text not null,
  fee_usdc          text not null,
  order_id          uuid references public.orders(id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint treasury_fee_receipts_tx_log_unique unique (tx_hash, log_index)
);

create index if not exists treasury_fee_receipts_chain_idx
  on public.treasury_fee_receipts (chain_id);
create index if not exists treasury_fee_receipts_order_idx
  on public.treasury_fee_receipts (contract_order_id);

-- Service-role (admin client) access only; no public policies.
alter table public.treasury_fee_receipts enable row level security;

-- Incremental indexer cursors, keyed per logical event stream.
-- e.g. id = 'purchase_completed' tracks the last scanned block for fee receipts.
create table if not exists public.onchain_index_cursors (
  id                 text primary key,
  chain_id           integer not null,
  last_indexed_block bigint not null default 0,
  updated_at         timestamptz not null default now()
);

alter table public.onchain_index_cursors enable row level security;
