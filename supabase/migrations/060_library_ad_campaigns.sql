-- IMAGE PARTNERS - administrator-managed Library advertising and partnership campaigns

create table if not exists public.library_ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  campaign_type text not null default 'house',
  placement text not null default 'right_rail',
  title_ko text not null,
  title_en text,
  body_ko text,
  body_en text,
  cta_ko text not null,
  cta_en text,
  image_url text,
  image_alt_ko text,
  image_alt_en text,
  destination_url text not null,
  sponsor_name text,
  is_active boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  priority integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint library_ad_campaigns_name_length_check
    check (char_length(trim(name)) between 1 and 100),
  constraint library_ad_campaigns_type_check
    check (campaign_type in ('house', 'partner')),
  constraint library_ad_campaigns_placement_check
    check (placement in ('right_rail')),
  constraint library_ad_campaigns_title_ko_length_check
    check (char_length(trim(title_ko)) between 1 and 100),
  constraint library_ad_campaigns_title_en_length_check
    check (title_en is null or char_length(trim(title_en)) <= 100),
  constraint library_ad_campaigns_body_ko_length_check
    check (body_ko is null or char_length(trim(body_ko)) <= 240),
  constraint library_ad_campaigns_body_en_length_check
    check (body_en is null or char_length(trim(body_en)) <= 240),
  constraint library_ad_campaigns_cta_ko_length_check
    check (char_length(trim(cta_ko)) between 1 and 40),
  constraint library_ad_campaigns_cta_en_length_check
    check (cta_en is null or char_length(trim(cta_en)) <= 40),
  constraint library_ad_campaigns_image_alt_ko_length_check
    check (image_alt_ko is null or char_length(trim(image_alt_ko)) <= 160),
  constraint library_ad_campaigns_image_alt_en_length_check
    check (image_alt_en is null or char_length(trim(image_alt_en)) <= 160),
  constraint library_ad_campaigns_sponsor_length_check
    check (sponsor_name is null or char_length(trim(sponsor_name)) <= 100),
  constraint library_ad_campaigns_window_check
    check (ends_at is null or ends_at > starts_at),
  constraint library_ad_campaigns_priority_check
    check (priority between 0 and 1000)
);

create index if not exists library_ad_campaigns_active_window_idx
  on public.library_ad_campaigns(placement, is_active, priority desc, starts_at desc);

alter table public.library_ad_campaigns enable row level security;

drop policy if exists "library_ad_campaigns: admin all" on public.library_ad_campaigns;
create policy "library_ad_campaigns: admin all"
  on public.library_ad_campaigns for all
  using (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ))
  with check (exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ));

alter table public.user_events
  drop constraint if exists user_events_event_type_check;

alter table public.user_events
  add constraint user_events_event_type_check
  check (event_type in (
    'page_view',
    'image_view',
    'search',
    'cart_add',
    'checkout_started',
    'download',
    'ad_impression',
    'ad_click'
  ));

update public.legal_documents
set body = replace(
      replace(body, '시행일: 2026년 7월 21일', '시행일: 2026년 7월 28일'),
      '검색·열람·장바구니·다운로드 등 이용 기록',
      '검색·열람·장바구니·다운로드·광고 노출·광고 클릭 등 이용 기록'
    ),
    updated_at = now(),
    published_at = now()
where slug = 'privacy'
  and body like '%검색·열람·장바구니·다운로드 등 이용 기록%';

update public.legal_documents
set body = replace(
      replace(body, '시행일: 2026년 7월 21일', '시행일: 2026년 7월 28일'),
      '서비스 개선과 보안을 위해 페이지 경로, referrer, 브라우저 정보, IP 주소의 해시값, 익명 세션 식별자, 이미지 열람·검색·장바구니·다운로드 이벤트를 기록할 수 있습니다.',
      '서비스 개선과 광고·제휴 성과 확인을 위해 페이지 경로, referrer, 브라우저 정보, IP 주소의 해시값, 익명 세션 식별자, 이미지 열람·검색·장바구니·다운로드·광고 노출·광고 클릭 이벤트를 기록할 수 있습니다.'
    ),
    updated_at = now(),
    published_at = now()
where slug = 'cookie'
  and body like '%이미지 열람·검색·장바구니·다운로드 이벤트를 기록할 수 있습니다.%';
