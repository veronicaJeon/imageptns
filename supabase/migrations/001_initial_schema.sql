-- ============================================================
-- IMAGE PARTNERS — Initial Schema
-- ============================================================

-- ── Extensions ────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ── 1. profiles ───────────────────────────────────────────
-- auth.users와 1:1. 트리거로 자동 생성.
create table public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  bio                  text,
  avatar_url           text,
  role                 text not null check (role in ('buyer','photographer')),
  notif_sales          boolean not null default true,
  notif_reviews        boolean not null default true,
  notif_newsletter     boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz
);

-- 트리거: 회원가입 시 profiles 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 2. images ─────────────────────────────────────────────
create table public.images (
  id                     uuid primary key default gen_random_uuid(),
  asset_id               text unique,           -- "IP-00001"
  photographer_id        uuid references public.profiles(id) on delete set null,
  title                  text not null,
  description            text,
  category               text not null check (category in ('nature','people','editorial','urban','abstract','architecture')),
  tags                   text[] default '{}',
  storage_path_preview   text,  -- Supabase Storage: previews/ (공개)
  storage_path_full      text,  -- Supabase Storage: fulls/ (비공개, signed URL)
  storage_path_original  text,  -- Supabase Storage: originals/ (비공개)
  width                  integer,
  height                 integer,
  resolution_mp          decimal(5,2),
  file_format            text,
  file_size_mb           decimal(6,2),
  status                 text not null default 'pending' check (status in ('draft','pending','approved','rejected')),
  rejection_reason       text,
  views_count            integer not null default 0,
  sales_count            integer not null default 0,
  approved_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz,
  fts                    tsvector
);

-- asset_id 자동 생성 함수
create sequence if not exists image_asset_seq start 1;

create or replace function public.generate_asset_id()
returns trigger language plpgsql as $$
begin
  if new.asset_id is null then
    new.asset_id := 'IP-' || lpad(nextval('image_asset_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger set_asset_id
  before insert on public.images
  for each row execute procedure public.generate_asset_id();

-- FTS 벡터 자동 갱신
create or replace function public.update_image_fts()
returns trigger language plpgsql as $$
begin
  new.fts := to_tsvector('simple',
    coalesce(new.title, '') || ' ' ||
    coalesce(new.description, '') || ' ' ||
    coalesce(new.category, '') || ' ' ||
    coalesce(array_to_string(new.tags, ' '), '')
  );
  return new;
end;
$$;

create trigger update_fts_vector
  before insert or update on public.images
  for each row execute procedure public.update_image_fts();

create index images_fts_idx on public.images using gin(fts);
create index images_category_idx on public.images(category);
create index images_status_idx on public.images(status);
create index images_photographer_idx on public.images(photographer_id);

-- ── 3. license_types ──────────────────────────────────────
create table public.license_types (
  id             serial primary key,
  code           text unique not null,  -- 'editorial','commercial','extended'
  name_en        text not null,
  name_ko        text not null,
  price_krw      integer not null,
  description_en text,
  description_ko text
);

insert into public.license_types (code, name_en, name_ko, price_krw, description_en, description_ko) values
  ('editorial',  'Editorial',  '에디토리얼', 15000,  'For news, editorial, and educational use.',            '뉴스, 기사, 교육 목적으로 사용 가능합니다.'),
  ('commercial', 'Commercial', '커머셜',     55000,  'For advertising, marketing, and commercial use.',     '광고, 마케팅, 상업적 목적으로 사용 가능합니다.'),
  ('extended',   'Extended',   '익스텐디드', 180000, 'Unlimited print runs, merchandise, and all media.',   '무제한 인쇄, 상품화, 모든 미디어에 사용 가능합니다.');

-- ── 4. favorites ──────────────────────────────────────────
create table public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_id   uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, image_id)
);

create index favorites_user_idx on public.favorites(user_id);

-- ── 5. orders ─────────────────────────────────────────────
create table public.orders (
  id               uuid primary key default gen_random_uuid(),
  order_number     text unique,
  buyer_id         uuid not null references public.profiles(id) on delete restrict,
  subtotal_krw     integer not null,
  vat_krw          integer not null,
  total_krw        integer not null,
  status           text not null default 'pending' check (status in ('pending','completed','failed','refunded')),
  billing_name     text,
  billing_email    text,
  billing_company  text,
  toss_payment_key text,
  toss_order_id    text unique,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- 주문번호 자동 생성
create sequence if not exists order_seq start 1;

create or replace function public.generate_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null then
    new.order_number := 'ORD-' || lpad(nextval('order_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

create trigger set_order_number
  before insert on public.orders
  for each row execute procedure public.generate_order_number();

create index orders_buyer_idx on public.orders(buyer_id);
create index orders_status_idx on public.orders(status);

-- ── 6. order_items ────────────────────────────────────────
create table public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  image_id        uuid not null references public.images(id) on delete restrict,
  license_code    text not null,
  price_krw       integer not null,
  photographer_id uuid references public.profiles(id) on delete set null,
  gross_krw       integer not null,
  commission_rate decimal(3,2) not null default 0.20,
  commission_krw  integer not null,
  net_krw         integer not null
);

-- sales_count 자동 증가
create or replace function public.increment_sales_count()
returns trigger language plpgsql as $$
begin
  update public.images
  set sales_count = sales_count + 1, updated_at = now()
  where id = new.image_id;
  return new;
end;
$$;

create trigger on_order_item_created
  after insert on public.order_items
  for each row execute procedure public.increment_sales_count();

create index order_items_order_idx on public.order_items(order_id);
create index order_items_image_idx on public.order_items(image_id);
create index order_items_photographer_idx on public.order_items(photographer_id);

-- ── 7. downloads ──────────────────────────────────────────
create table public.downloads (
  id             uuid primary key default gen_random_uuid(),
  order_item_id  uuid not null references public.order_items(id) on delete cascade,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  expires_at     timestamptz not null default (now() + interval '30 days'),
  download_count integer not null default 0,
  created_at     timestamptz not null default now()
);

create index downloads_user_idx on public.downloads(user_id);
create index downloads_order_item_idx on public.downloads(order_item_id);

-- ── 8. earnings_ledger ────────────────────────────────────
create table public.earnings_ledger (
  id              uuid primary key default gen_random_uuid(),
  photographer_id uuid not null references public.profiles(id) on delete cascade,
  order_item_id   uuid not null references public.order_items(id) on delete cascade,
  gross_krw       integer not null,
  commission_krw  integer not null,
  net_krw         integer not null,
  period          text not null,  -- "2026-04"
  payout_id       uuid,           -- FK payouts.id (nullable, 정산 후 연결)
  created_at      timestamptz not null default now()
);

-- 주문 완료 시 earnings_ledger 자동 생성 (orders.status → 'completed' 트리거)
create or replace function public.on_order_completed()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'completed' and old.status != 'completed' then
    insert into public.earnings_ledger (photographer_id, order_item_id, gross_krw, commission_krw, net_krw, period)
    select
      oi.photographer_id,
      oi.id,
      oi.gross_krw,
      oi.commission_krw,
      oi.net_krw,
      to_char(new.completed_at, 'YYYY-MM')
    from public.order_items oi
    where oi.order_id = new.id
      and oi.photographer_id is not null;

    -- downloads 레코드 생성
    insert into public.downloads (order_item_id, user_id)
    select oi.id, new.buyer_id
    from public.order_items oi
    where oi.order_id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_order_status_completed
  after update on public.orders
  for each row execute procedure public.on_order_completed();

create index earnings_photographer_idx on public.earnings_ledger(photographer_id);
create index earnings_period_idx on public.earnings_ledger(period);

-- ── 9. payouts ────────────────────────────────────────────
create table public.payouts (
  id                uuid primary key default gen_random_uuid(),
  photographer_id   uuid not null references public.profiles(id) on delete cascade,
  period            text not null,
  total_gross_krw   integer not null,
  total_commission  integer not null,
  total_net_krw     integer not null,
  status            text not null default 'pending' check (status in ('pending','processing','paid','failed')),
  payout_method     text default 'bank_transfer',
  scheduled_at      timestamptz,
  paid_at           timestamptz,
  created_at        timestamptz not null default now()
);

-- FK 역방향 연결
alter table public.earnings_ledger
  add constraint earnings_payout_fk
  foreign key (payout_id) references public.payouts(id) on delete set null;

create index payouts_photographer_idx on public.payouts(photographer_id);

-- ── 10. contact_submissions ───────────────────────────────
create table public.contact_submissions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  subject     text not null,
  message     text not null,
  status      text not null default 'pending' check (status in ('pending','in_progress','resolved')),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.profiles           enable row level security;
alter table public.images             enable row level security;
alter table public.favorites          enable row level security;
alter table public.orders             enable row level security;
alter table public.order_items        enable row level security;
alter table public.downloads          enable row level security;
alter table public.earnings_ledger    enable row level security;
alter table public.payouts            enable row level security;
alter table public.contact_submissions enable row level security;

-- profiles
create policy "profiles: self select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: self update"
  on public.profiles for update
  using (auth.uid() = id);

-- images: 누구나 approved 이미지 조회
create policy "images: public select approved"
  on public.images for select
  using (status = 'approved');

create policy "images: photographer select own"
  on public.images for select
  using (auth.uid() = photographer_id);

create policy "images: photographer insert"
  on public.images for insert
  with check (auth.uid() = photographer_id);

create policy "images: photographer update own"
  on public.images for update
  using (auth.uid() = photographer_id and status in ('draft','pending'));

-- favorites
create policy "favorites: self crud"
  on public.favorites for all
  using (auth.uid() = user_id);

-- orders
create policy "orders: buyer select own"
  on public.orders for select
  using (auth.uid() = buyer_id);

create policy "orders: buyer insert"
  on public.orders for insert
  with check (auth.uid() = buyer_id);

-- order_items: 구매자 또는 해당 사진작가만
create policy "order_items: buyer or photographer select"
  on public.order_items for select
  using (
    auth.uid() = photographer_id
    or auth.uid() = (select buyer_id from public.orders where id = order_id)
  );

-- downloads
create policy "downloads: self select"
  on public.downloads for select
  using (auth.uid() = user_id);

-- earnings_ledger
create policy "earnings: photographer select own"
  on public.earnings_ledger for select
  using (auth.uid() = photographer_id);

-- payouts
create policy "payouts: photographer select own"
  on public.payouts for select
  using (auth.uid() = photographer_id);

-- contact_submissions: 누구나 insert (로그인 불필요)
create policy "contact: anyone insert"
  on public.contact_submissions for insert
  with check (true);

-- license_types: 누구나 조회
alter table public.license_types enable row level security;
create policy "license_types: public select"
  on public.license_types for select
  using (true);

-- ============================================================
-- Storage Buckets
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('images-preview',  'images-preview',  true,  10485760,  array['image/jpeg','image/webp','image/png']),
  ('images-full',     'images-full',     false, 524288000, array['image/tiff','image/jpeg','image/png']),
  ('images-original', 'images-original', false, 524288000, null),
  ('avatars',         'avatars',         true,  2097152,   array['image/jpeg','image/webp','image/png'])
on conflict (id) do nothing;

-- Storage RLS
create policy "images-preview: public read"
  on storage.objects for select
  using (bucket_id = 'images-preview');

create policy "images-full: authenticated read"
  on storage.objects for select
  using (bucket_id = 'images-full' and auth.role() = 'authenticated');

create policy "images-original: photographer upload"
  on storage.objects for insert
  with check (bucket_id in ('images-original','images-full','images-preview') and auth.role() = 'authenticated');

create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: self upload"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
