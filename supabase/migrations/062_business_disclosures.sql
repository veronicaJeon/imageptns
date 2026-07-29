-- Admin-managed business disclosures and transaction-policy drafts.

create table if not exists public.business_disclosures (
  id boolean primary key default true,
  business_name text not null default '이미지파트너스',
  representative_name text,
  business_registration_number text,
  address text not null default '서울시 서대문구 거북골로 21길57 제1호',
  public_phone text,
  public_email text not null default 'contact@imagepartners.kr',
  ecommerce_registration_number text,
  ecommerce_registration_authority text,
  refund_policy text not null,
  receipt_policy text not null,
  show_business_name boolean not null default true,
  show_representative_name boolean not null default false,
  show_business_registration_number boolean not null default false,
  show_address boolean not null default true,
  show_public_phone boolean not null default false,
  show_public_email boolean not null default true,
  show_ecommerce_registration boolean not null default false,
  is_published boolean not null default false,
  published_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_disclosures_singleton check (id = true),
  constraint business_disclosures_publish_date_check check (
    (is_published = true and published_at is not null)
    or (is_published = false and published_at is null)
  )
);

alter table public.business_disclosures enable row level security;

drop policy if exists "business_disclosures: public select published" on public.business_disclosures;
create policy "business_disclosures: public select published"
  on public.business_disclosures for select
  using (is_published = true);

drop policy if exists "business_disclosures: admin all" on public.business_disclosures;
create policy "business_disclosures: admin all"
  on public.business_disclosures for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

insert into public.business_disclosures (
  id,
  refund_policy,
  receipt_policy
)
values (
  true,
  $refund$1. 입금 전 또는 관리자의 입금 승인 전에는 계좌이체 주문을 취소할 수 있습니다.
2. 입금 후 아직 원본 다운로드 권한이 제공되지 않았다면 운영팀 확인 후 결제금액 전액을 환급합니다.
3. 원본 다운로드 권한 제공이 시작된 디지털 콘텐츠는 관계 법령에 따른 사전 동의와 고지가 이루어진 경우 단순 변심에 의한 청약철회가 제한될 수 있습니다.
4. 파일 훼손, 주문 내용과 다른 파일 제공, 서비스가 보증한 권리 범위의 중대한 하자 등 서비스 책임 사유가 있으면 다운로드 여부와 관계없이 교환, 재제공 또는 환급을 제공합니다.
5. 취소·환불 요청은 주문번호와 신청 사유를 contact@imagepartners.kr로 접수합니다. 환급이 승인되면 원칙적으로 3영업일 이내에 구매자가 입금한 계좌로 반환합니다.
6. 소비자에게 법령상 더 유리한 청약철회·환급 기준이 적용되는 경우 해당 법령이 본 정책보다 우선합니다.$refund$,
  $receipt$1. 계좌이체 주문의 증빙 발급 요청은 주문번호와 함께 contact@imagepartners.kr로 접수합니다.
2. 개인 고객은 현금영수증 소득공제용, 사업자 고객은 현금영수증 지출증빙용 발급을 요청할 수 있습니다.
3. 세금계산서 발급을 요청하는 사업자 고객은 사업자등록 정보와 수신 이메일을 제공해야 하며, 관계 법령상 발급 가능한 거래에 대해 처리합니다.
4. 동일 거래에 대해 현금영수증과 세금계산서를 중복 발급하지 않습니다.
5. 화면 표시 금액의 부가가치세 포함 여부와 발급 시점은 최종 세무 운영방침 확정 후 주문 화면과 계약내용에 명시합니다.$receipt$
)
on conflict (id) do nothing;

revoke all on table public.business_disclosures from anon, authenticated;
grant select on table public.business_disclosures to anon, authenticated;
grant all on table public.business_disclosures to service_role;
