-- IMAGE PARTNERS - Arweave self-funded requests, download windows, and subscription quotas

create table if not exists public.platform_commerce_settings (
  id boolean primary key default true,
  download_access_days integer not null default 30,
  subscription_basic_downloads integer not null default 5,
  subscription_pro_downloads integer not null default 30,
  subscription_enterprise_downloads integer not null default 100,
  arweave_self_funded_request_fee_krw integer not null default 10000,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  constraint platform_commerce_settings_singleton check (id = true),
  constraint platform_commerce_settings_download_days_check check (download_access_days between 1 and 3650),
  constraint platform_commerce_settings_basic_quota_check check (subscription_basic_downloads between 0 and 10000),
  constraint platform_commerce_settings_pro_quota_check check (subscription_pro_downloads between 0 and 10000),
  constraint platform_commerce_settings_enterprise_quota_check check (subscription_enterprise_downloads between 0 and 10000),
  constraint platform_commerce_settings_arweave_fee_check check (arweave_self_funded_request_fee_krw between 0 and 10000000)
);

insert into public.platform_commerce_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.platform_commerce_settings enable row level security;

drop policy if exists "platform_commerce_settings: admin select" on public.platform_commerce_settings;
create policy "platform_commerce_settings: admin select"
  on public.platform_commerce_settings for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "platform_commerce_settings: admin write" on public.platform_commerce_settings;
create policy "platform_commerce_settings: admin write"
  on public.platform_commerce_settings for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

alter table public.order_items
  add column if not exists subscription_id uuid references public.subscriptions(id) on delete set null,
  add column if not exists subscription_covered boolean not null default false,
  add column if not exists subscription_original_price_krw integer,
  add column if not exists subscription_plan text;

alter table public.order_items
  drop constraint if exists order_items_subscription_original_price_check;

alter table public.order_items
  add constraint order_items_subscription_original_price_check
  check (subscription_original_price_krw is null or subscription_original_price_krw >= 0);

create index if not exists order_items_subscription_idx on public.order_items(subscription_id);
create index if not exists order_items_subscription_covered_idx on public.order_items(subscription_covered);

create table if not exists public.subscription_download_usages (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete restrict,
  period_start timestamptz not null,
  period_end timestamptz not null,
  created_at timestamptz not null default now(),
  constraint subscription_download_usages_period_check check (period_end > period_start)
);

create unique index if not exists subscription_download_usages_order_item_unique_idx
  on public.subscription_download_usages(order_item_id);

create index if not exists subscription_download_usages_subscription_period_idx
  on public.subscription_download_usages(subscription_id, period_start, period_end);

create index if not exists subscription_download_usages_user_idx
  on public.subscription_download_usages(user_id);

alter table public.subscription_download_usages enable row level security;

drop policy if exists "subscription_download_usages: self or admin select" on public.subscription_download_usages;
create policy "subscription_download_usages: self or admin select"
  on public.subscription_download_usages for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "subscription_download_usages: admin write" on public.subscription_download_usages;
create policy "subscription_download_usages: admin write"
  on public.subscription_download_usages for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

alter table public.images
  add column if not exists proof_request_fee_payer text not null default 'platform',
  add column if not exists proof_request_kind text not null default 'post_sale',
  add column if not exists proof_request_fee_krw integer not null default 0;

alter table public.images
  drop constraint if exists images_proof_request_fee_payer_check,
  drop constraint if exists images_proof_request_kind_check,
  drop constraint if exists images_proof_request_fee_krw_check;

alter table public.images
  add constraint images_proof_request_fee_payer_check check (proof_request_fee_payer in ('platform', 'photographer')),
  add constraint images_proof_request_kind_check check (proof_request_kind in ('post_sale', 'self_funded')),
  add constraint images_proof_request_fee_krw_check check (proof_request_fee_krw >= 0);

create index if not exists images_proof_request_kind_idx on public.images(proof_request_kind);

create or replace function public.on_order_completed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  access_days integer;
begin
  if new.status = 'completed' and old.status != 'completed' then
    select coalesce(pcs.download_access_days, 30)
      into access_days
      from public.platform_commerce_settings pcs
      where pcs.id = true;
    access_days := coalesce(access_days, 30);

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

    insert into public.downloads (order_item_id, user_id, expires_at)
    select
      oi.id,
      new.buyer_id,
      coalesce(new.completed_at, now()) + make_interval(days => access_days)
    from public.order_items oi
    where oi.order_id = new.id
    on conflict (order_item_id) do nothing;

    insert into public.subscription_download_usages (
      subscription_id,
      user_id,
      order_item_id,
      image_id,
      period_start,
      period_end
    )
    select
      oi.subscription_id,
      new.buyer_id,
      oi.id,
      oi.image_id,
      s.current_period_start,
      s.current_period_end
    from public.order_items oi
    join public.subscriptions s on s.id = oi.subscription_id
    where oi.order_id = new.id
      and oi.subscription_covered = true
      and oi.subscription_id is not null
      and s.current_period_start is not null
      and s.current_period_end is not null
    on conflict (order_item_id) do nothing;

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
