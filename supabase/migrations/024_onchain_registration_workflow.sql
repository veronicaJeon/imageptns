-- IMAGE PARTNERS - Post-sale Arweave credential registration workflow

create table if not exists public.onchain_registration_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  admin_id uuid references public.profiles(id) on delete set null,
  image_count integer not null default 0,
  total_bytes bigint not null default 0,
  arweave_manifest_tx_id text,
  arweave_confirmed_at timestamptz,
  graph_verified_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint onchain_registration_batches_status_check
    check (status in ('pending','uploaded','confirmed','failed'))
);

alter table public.onchain_registration_batches enable row level security;

create index if not exists onchain_registration_batches_created_at_idx
  on public.onchain_registration_batches(created_at desc);

alter table public.images
  add column if not exists proof_requested_at timestamptz,
  add column if not exists proof_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists proof_batch_id uuid references public.onchain_registration_batches(id) on delete set null,
  add column if not exists proof_arweave_original_tx_id text,
  add column if not exists proof_arweave_metadata_tx_id text,
  add column if not exists proof_arweave_manifest_tx_id text,
  add column if not exists proof_arweave_confirmed_at timestamptz,
  add column if not exists proof_failure_reason text,
  add column if not exists proof_original_sha256 text,
  add column if not exists proof_file_size_bytes bigint,
  add column if not exists proof_metadata jsonb not null default '{}'::jsonb,
  add column if not exists authorship_declaration text not null default 'human_original',
  add column if not exists authorship_declared_at timestamptz,
  add column if not exists authorship_attestation_version text not null default '2026-05-20';

alter table public.images
  drop constraint if exists images_proof_status_check,
  drop constraint if exists images_authorship_declaration_check;

alter table public.images
  add constraint images_proof_status_check
  check (proof_status in ('not_registered','available','requested','pending','registered','failed'));

alter table public.images
  add constraint images_authorship_declaration_check
  check (authorship_declaration in ('ai_generated','human_original'));

create index if not exists images_proof_requested_idx
  on public.images(proof_status, proof_requested_at desc);

create index if not exists images_proof_batch_idx
  on public.images(proof_batch_id)
  where proof_batch_id is not null;

create index if not exists images_authorship_declaration_idx
  on public.images(authorship_declaration);

create or replace function public.on_order_completed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    insert into public.earnings_ledger (photographer_id, order_item_id, gross_krw, commission_krw, net_krw, period)
    select
      oi.photographer_id,
      oi.id,
      oi.gross_krw,
      oi.commission_krw,
      oi.net_krw,
      to_char(coalesce(new.completed_at, now()), 'YYYY-MM')
    from public.order_items oi
    where oi.order_id = new.id
      and oi.photographer_id is not null
    on conflict do nothing;

    insert into public.downloads (order_item_id, user_id)
    select oi.id, new.buyer_id
    from public.order_items oi
    where oi.order_id = new.id
    on conflict do nothing;

    update public.images i
    set sales_count = sales_count + completed.count,
        proof_status = case
          when i.proof_status = 'not_registered' then 'available'
          else i.proof_status
        end,
        updated_at = now()
    from (
      select image_id, count(*)::integer as count
      from public.order_items
      where order_id = new.id
      group by image_id
    ) completed
    where i.id = completed.image_id;
  end if;

  return new;
end;
$$;

update public.images
set proof_status = 'available',
    updated_at = now()
where status = 'approved'
  and sales_count > 0
  and proof_status = 'not_registered';
