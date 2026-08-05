-- Public checkout transaction hardening:
-- - immutable consent snapshots and idempotency
-- - atomic order + order item creation
-- - durable transactional email outbox
-- - atomic bank-transfer review transitions

alter table public.orders
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists checkout_request_hash text,
  add column if not exists transaction_terms_version text,
  add column if not exists transaction_terms_accepted_at timestamptz,
  add column if not exists transaction_terms_snapshot jsonb;

create unique index if not exists orders_buyer_checkout_idempotency_idx
  on public.orders (buyer_id, checkout_idempotency_key)
  where checkout_idempotency_key is not null;

alter table public.orders
  drop constraint if exists orders_checkout_request_hash_check,
  add constraint orders_checkout_request_hash_check
  check (checkout_request_hash is null or checkout_request_hash ~ '^[a-f0-9]{64}$');

alter table public.order_items
  add column if not exists license_name_ko_snapshot text,
  add column if not exists license_description_ko_snapshot text;

create table if not exists public.order_email_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_email_outbox_event_check check (
    event_type in (
      'free_order_confirmed_buyer',
      'bank_transfer_requested_buyer',
      'bank_transfer_requested_ops',
      'bank_transfer_approved_buyer',
      'bank_transfer_canceled_buyer'
    )
  ),
  constraint order_email_outbox_status_check check (status in ('pending', 'sending', 'sent', 'failed')),
  constraint order_email_outbox_attempt_check check (attempt_count >= 0),
  unique (order_id, event_type)
);

create index if not exists order_email_outbox_retry_idx
  on public.order_email_outbox (status, updated_at)
  where status in ('pending', 'failed');

alter table public.order_email_outbox enable row level security;
revoke all on table public.order_email_outbox from anon, authenticated;
grant all on table public.order_email_outbox to service_role;

-- Standard checkout orders are created through a server-authorized atomic
-- function. The legacy buyer insert policy is removed only after the new app
-- is deployed so a database-first rollout does not interrupt the beta.
create or replace function public.paid_commerce_disclosure_is_complete()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      is_published
      and nullif(trim(business_name), '') is not null
      and nullif(trim(representative_name), '') is not null
      and nullif(trim(business_registration_number), '') is not null
      and nullif(trim(address), '') is not null
      and nullif(trim(public_phone), '') is not null
      and nullif(trim(public_email), '') is not null
      and nullif(trim(ecommerce_registration_number), '') is not null
      and nullif(trim(ecommerce_registration_authority), '') is not null
      and nullif(trim(refund_policy), '') is not null
      and nullif(trim(receipt_policy), '') is not null
      and show_business_name
      and show_representative_name
      and show_business_registration_number
      and show_address
      and show_public_phone
      and show_public_email
      and show_ecommerce_registration
    from public.business_disclosures
    where id = true
  ), false);
$$;

revoke all on function public.paid_commerce_disclosure_is_complete() from public, anon, authenticated;
grant execute on function public.paid_commerce_disclosure_is_complete() to service_role;

create or replace function public.create_standard_checkout_order(
  p_buyer_id uuid,
  p_billing_name text,
  p_billing_email text,
  p_billing_company text,
  p_usage_purpose_note text,
  p_payment_provider text,
  p_toss_order_id text,
  p_subtotal_krw integer,
  p_vat_krw integer,
  p_total_krw integer,
  p_checkout_idempotency_key uuid,
  p_checkout_request_hash text,
  p_transaction_terms_version text,
  p_transaction_terms_snapshot jsonb,
  p_allow_incomplete_disclosure boolean,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.orders%rowtype;
  created_order public.orders%rowtype;
  item jsonb;
  item_count integer;
  item_total bigint;
  paid_checkout boolean;
  paid_bank_transfer boolean;
  disclosure_ready boolean := false;
begin
  if p_buyer_id is null or not exists (select 1 from public.profiles where id = p_buyer_id) then
    raise exception 'Checkout buyer does not exist';
  end if;
  if nullif(trim(p_billing_name), '') is null or nullif(trim(p_billing_email), '') is null then
    raise exception 'Billing name and email are required';
  end if;
  if p_payment_provider not in ('toss', 'bank_transfer') then
    raise exception 'Unsupported standard checkout provider';
  end if;
  if p_checkout_idempotency_key is null
    or p_checkout_request_hash !~ '^[a-f0-9]{64}$'
    or nullif(trim(p_transaction_terms_version), '') is null
    or p_transaction_terms_snapshot is null
    or jsonb_typeof(p_transaction_terms_snapshot) <> 'object'
  then
    raise exception 'Checkout consent or idempotency data is invalid';
  end if;
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Checkout items must be an array';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 or item_count > 50 then
    raise exception 'Checkout item count is invalid';
  end if;

  select coalesce(sum((value->>'price_krw')::bigint), 0)
  into item_total
  from jsonb_array_elements(p_items);

  if p_subtotal_krw < 0 or p_vat_krw < 0 or p_total_krw < 0
    or item_total <> p_subtotal_krw
    or p_total_krw <> p_subtotal_krw + p_vat_krw
    or p_vat_krw <> round(p_subtotal_krw * 0.1)::integer
  then
    raise exception 'Checkout totals are inconsistent';
  end if;

  paid_checkout := p_total_krw > 0;
  paid_bank_transfer := p_payment_provider = 'bank_transfer' and paid_checkout;
  if paid_checkout then
    select public.paid_commerce_disclosure_is_complete()
    into disclosure_ready;

    if not coalesce(disclosure_ready, false) and not p_allow_incomplete_disclosure then
      raise exception 'Paid commerce disclosure is incomplete';
    end if;
  end if;

  -- Serialize concurrent retries for the same buyer/key. Without this lock,
  -- two requests could both miss the initial lookup and one would surface a
  -- unique-index error instead of receiving the original order.
  perform pg_advisory_xact_lock(
    hashtextextended(p_buyer_id::text || ':' || p_checkout_idempotency_key::text, 0)
  );

  select * into existing_order
  from public.orders
  where buyer_id = p_buyer_id
    and checkout_idempotency_key = p_checkout_idempotency_key;

  if found then
    if existing_order.checkout_request_hash is distinct from p_checkout_request_hash then
      raise exception 'Checkout idempotency key was reused with different data';
    end if;
    return jsonb_build_object(
      'id', existing_order.id,
      'order_number', existing_order.order_number,
      'toss_order_id', existing_order.toss_order_id,
      'status', existing_order.status,
      'reused', true
    );
  end if;

  insert into public.orders (
    buyer_id,
    subtotal_krw,
    vat_krw,
    total_krw,
    billing_name,
    billing_email,
    billing_company,
    usage_purpose_note,
    toss_order_id,
    payment_provider,
    status,
    offline_payment_status,
    offline_payment_requested_at,
    checkout_idempotency_key,
    checkout_request_hash,
    transaction_terms_version,
    transaction_terms_accepted_at,
    transaction_terms_snapshot
  ) values (
    p_buyer_id,
    p_subtotal_krw,
    p_vat_krw,
    p_total_krw,
    trim(p_billing_name),
    trim(p_billing_email),
    nullif(trim(coalesce(p_billing_company, '')), ''),
    nullif(trim(coalesce(p_usage_purpose_note, '')), ''),
    p_toss_order_id,
    p_payment_provider,
    'pending',
    case when paid_bank_transfer then 'requested' else 'not_applicable' end,
    case when paid_bank_transfer then now() else null end,
    p_checkout_idempotency_key,
    p_checkout_request_hash,
    trim(p_transaction_terms_version),
    now(),
    p_transaction_terms_snapshot
  )
  returning * into created_order;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if nullif(item->>'image_id', '') is null
      or nullif(item->>'license_code', '') is null
      or (item->>'price_krw')::integer < 0
      or (item->>'gross_krw')::integer < 0
      or (item->>'commission_krw')::integer < 0
      or (item->>'net_krw')::integer < 0
      or (item->>'commission_krw')::integer + (item->>'net_krw')::integer <> (item->>'gross_krw')::integer
    then
      raise exception 'Checkout item is invalid';
    end if;

    insert into public.order_items (
      order_id,
      image_id,
      license_code,
      price_krw,
      photographer_id,
      image_title_snapshot,
      image_asset_id_snapshot,
      image_preview_path_snapshot,
      image_original_path_snapshot,
      image_original_filename_snapshot,
      license_name_ko_snapshot,
      license_description_ko_snapshot,
      gross_krw,
      commission_rate,
      commission_krw,
      net_krw,
      subscription_id,
      subscription_covered,
      subscription_original_price_krw,
      subscription_plan
    ) values (
      created_order.id,
      (item->>'image_id')::uuid,
      item->>'license_code',
      (item->>'price_krw')::integer,
      nullif(item->>'photographer_id', '')::uuid,
      item->>'image_title_snapshot',
      item->>'image_asset_id_snapshot',
      item->>'image_preview_path_snapshot',
      item->>'image_original_path_snapshot',
      item->>'image_original_filename_snapshot',
      item->>'license_name_ko_snapshot',
      item->>'license_description_ko_snapshot',
      (item->>'gross_krw')::integer,
      (item->>'commission_rate')::numeric,
      (item->>'commission_krw')::integer,
      (item->>'net_krw')::integer,
      nullif(item->>'subscription_id', '')::uuid,
      coalesce((item->>'subscription_covered')::boolean, false),
      nullif(item->>'subscription_original_price_krw', '')::integer,
      nullif(item->>'subscription_plan', '')
    );
  end loop;

  if p_total_krw = 0 then
    update public.orders
    set status = 'completed', completed_at = now()
    where id = created_order.id
    returning * into created_order;

    insert into public.order_email_outbox (order_id, event_type)
    values (created_order.id, 'free_order_confirmed_buyer');
  elsif paid_bank_transfer then
    insert into public.order_email_outbox (order_id, event_type)
    values
      (created_order.id, 'bank_transfer_requested_buyer'),
      (created_order.id, 'bank_transfer_requested_ops');
  end if;

  return jsonb_build_object(
    'id', created_order.id,
    'order_number', created_order.order_number,
    'toss_order_id', created_order.toss_order_id,
    'status', created_order.status,
    'reused', false
  );
end;
$$;

revoke all on function public.create_standard_checkout_order(
  uuid, text, text, text, text, text, text, integer, integer, integer,
  uuid, text, text, jsonb, boolean, jsonb
) from public, anon, authenticated;
grant execute on function public.create_standard_checkout_order(
  uuid, text, text, text, text, text, text, integer, integer, integer,
  uuid, text, text, jsonb, boolean, jsonb
) to service_role;

create or replace function public.review_bank_transfer_order(
  p_order_id uuid,
  p_action text,
  p_note text,
  p_admin_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.orders%rowtype;
  updated public.orders%rowtype;
  now_at timestamptz := now();
begin
  if p_action not in ('approve', 'cancel') then
    raise exception 'Invalid bank transfer action';
  end if;
  if not exists (select 1 from public.profiles where id = p_admin_id and is_admin = true) then
    raise exception 'Administrator authorization is required';
  end if;

  select * into target
  from public.orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found'; end if;
  if target.payment_provider <> 'bank_transfer' then raise exception 'Not a bank-transfer order'; end if;
  if target.status <> 'pending' or target.offline_payment_status <> 'requested' then
    raise exception 'Bank-transfer order was already processed';
  end if;

  update public.orders
  set
    status = case when p_action = 'approve' then 'completed' else 'canceled' end,
    completed_at = case when p_action = 'approve' then now_at else completed_at end,
    offline_payment_status = case when p_action = 'approve' then 'approved' else 'canceled' end,
    offline_payment_reviewed_at = now_at,
    offline_payment_reviewed_by = p_admin_id,
    offline_payment_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_order_id
  returning * into updated;

  insert into public.order_email_outbox (order_id, event_type)
  values (
    updated.id,
    case when p_action = 'approve' then 'bank_transfer_approved_buyer' else 'bank_transfer_canceled_buyer' end
  )
  on conflict (order_id, event_type) do nothing;

  return jsonb_build_object(
    'id', updated.id,
    'order_number', updated.order_number,
    'status', updated.status,
    'offline_payment_status', updated.offline_payment_status
  );
end;
$$;

revoke all on function public.review_bank_transfer_order(uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.review_bank_transfer_order(uuid, text, text, uuid)
  to service_role;
