-- IMAGE PARTNERS - Admin-editable legal documents

create table if not exists public.legal_documents (
  slug text primary key,
  title text not null,
  body text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_documents_slug_check
    check (slug in ('privacy', 'terms', 'license_guide', 'cookie'))
);

create index if not exists legal_documents_published_at_idx
  on public.legal_documents(published_at desc);

alter table public.legal_documents enable row level security;

drop policy if exists "legal_documents: public select published" on public.legal_documents;
create policy "legal_documents: public select published"
  on public.legal_documents for select
  using (published_at is not null);

drop policy if exists "legal_documents: admin all" on public.legal_documents;
create policy "legal_documents: admin all"
  on public.legal_documents for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

insert into public.legal_documents (slug, title, body)
values
  (
    'privacy',
    '개인정보처리방침',
    $$Image Partners는 회원 가입, 이미지 라이선스 거래, 정산 및 고객지원을 위해 필요한 최소한의 개인정보를 처리합니다.

관리자는 관련 법령과 서비스 운영 정책이 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.$$
  ),
  (
    'terms',
    '이용약관',
    $$본 약관은 Image Partners 서비스 이용 조건, 회원의 권리와 의무, 플랫폼 운영 기준을 정합니다.

관리자는 서비스 정책 또는 법적 요건이 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.$$
  ),
  (
    'license_guide',
    '라이선스 안내',
    $$Image Partners의 이미지 라이선스는 구매자가 선택한 사용 범위와 사진가가 설정한 저작권 정책을 기준으로 적용됩니다.

관리자는 상품 가격, 무료 사용 조건, Creative Commons 정책 변경 시 본 문서를 최신 내용으로 갱신해야 합니다.$$
  ),
  (
    'cookie',
    '쿠키 정책',
    $$Image Partners는 로그인 유지, 장바구니, 방문 로그, 서비스 분석을 위해 쿠키와 유사 기술을 사용할 수 있습니다.

관리자는 쿠키 사용 목적 또는 외부 분석 도구가 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.$$
  )
on conflict (slug) do nothing;
