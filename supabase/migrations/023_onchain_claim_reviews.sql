-- IMAGE PARTNERS - Admin review workflow for onchain claim items

alter table public.earnings_ledger
  add column if not exists settlement_provider text not null default 'offchain',
  add column if not exists claim_status text not null default 'not_applicable',
  add column if not exists claim_tx_hash text,
  add column if not exists claimable_amount numeric,
  add column if not exists claim_review_status text not null default 'not_required',
  add column if not exists claim_review_note text,
  add column if not exists claim_reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists claim_reviewed_at timestamptz;

alter table public.earnings_ledger
  drop constraint if exists earnings_settlement_provider_check,
  drop constraint if exists earnings_claim_status_check,
  drop constraint if exists earnings_claim_review_status_check;

alter table public.earnings_ledger
  add constraint earnings_settlement_provider_check
  check (settlement_provider in ('offchain', 'onchain_escrow'));

alter table public.earnings_ledger
  add constraint earnings_claim_status_check
  check (claim_status in ('not_applicable', 'claimable', 'claimed'));

alter table public.earnings_ledger
  add constraint earnings_claim_review_status_check
  check (claim_review_status in ('not_required', 'pending', 'approved', 'rejected', 'reviewed'));

update public.earnings_ledger
set claim_review_status = 'pending'
where settlement_provider = 'onchain_escrow'
  and claim_status in ('claimable', 'claimed')
  and claim_review_status = 'not_required';

create or replace function public.set_onchain_claim_review_status()
returns trigger language plpgsql as $$
begin
  if new.settlement_provider = 'onchain_escrow'
    and new.claim_status in ('claimable', 'claimed')
    and new.claim_review_status = 'not_required'
  then
    new.claim_review_status := 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists set_onchain_claim_review_status on public.earnings_ledger;

create trigger set_onchain_claim_review_status
  before insert or update of settlement_provider, claim_status, claim_review_status
  on public.earnings_ledger
  for each row execute procedure public.set_onchain_claim_review_status();

create index if not exists earnings_onchain_claim_review_idx
  on public.earnings_ledger(claim_review_status, claim_status)
  where settlement_provider = 'onchain_escrow';

create index if not exists earnings_claim_status_idx
  on public.earnings_ledger(claim_status);
