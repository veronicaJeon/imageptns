export const BUSINESS_DISCLOSURE_FIELDS = [
  "business_name",
  "representative_name",
  "business_registration_number",
  "address",
  "public_phone",
  "public_email",
  "ecommerce_registration",
] as const;

export type BusinessDisclosureField = typeof BUSINESS_DISCLOSURE_FIELDS[number];

export interface BusinessDisclosure {
  business_name: string;
  representative_name: string | null;
  business_registration_number: string | null;
  address: string;
  public_phone: string | null;
  public_email: string;
  ecommerce_registration_number: string | null;
  ecommerce_registration_authority: string | null;
  refund_policy: string;
  receipt_policy: string;
  show_business_name: boolean;
  show_representative_name: boolean;
  show_business_registration_number: boolean;
  show_address: boolean;
  show_public_phone: boolean;
  show_public_email: boolean;
  show_ecommerce_registration: boolean;
  is_published: boolean;
  published_at: string | null;
  updated_at: string | null;
}

export const DEFAULT_REFUND_POLICY = `1. 입금 전 또는 관리자의 입금 승인 전에는 계좌이체 주문을 취소할 수 있습니다.
2. 입금 후 아직 원본 다운로드 권한이 제공되지 않았다면 운영팀 확인 후 결제금액 전액을 환급합니다.
3. 원본 다운로드 권한 제공이 시작된 디지털 콘텐츠는 관계 법령에 따른 사전 동의와 고지가 이루어진 경우 단순 변심에 의한 청약철회가 제한될 수 있습니다.
4. 파일 훼손, 주문 내용과 다른 파일 제공, 서비스가 보증한 권리 범위의 중대한 하자 등 서비스 책임 사유가 있으면 다운로드 여부와 관계없이 교환, 재제공 또는 환급을 제공합니다.
5. 취소·환불 요청은 주문번호와 신청 사유를 contact@imagepartners.kr로 접수합니다. 환급이 승인되면 원칙적으로 3영업일 이내에 구매자가 입금한 계좌로 반환합니다.
6. 소비자에게 법령상 더 유리한 청약철회·환급 기준이 적용되는 경우 해당 법령이 본 정책보다 우선합니다.`;

export const DEFAULT_RECEIPT_POLICY = `1. 계좌이체 주문의 증빙 발급 요청은 주문번호와 함께 contact@imagepartners.kr로 접수합니다.
2. 개인 고객은 현금영수증 소득공제용, 사업자 고객은 현금영수증 지출증빙용 발급을 요청할 수 있습니다.
3. 세금계산서 발급을 요청하는 사업자 고객은 사업자등록 정보와 수신 이메일을 제공해야 하며, 관계 법령상 발급 가능한 거래에 대해 처리합니다.
4. 동일 거래에 대해 현금영수증과 세금계산서를 중복 발급하지 않습니다.
5. 화면 표시 금액의 부가가치세 포함 여부와 발급 시점은 최종 세무 운영방침 확정 후 주문 화면과 계약내용에 명시합니다.`;

export const DEFAULT_BUSINESS_DISCLOSURE: BusinessDisclosure = {
  business_name: "이미지파트너스",
  representative_name: null,
  business_registration_number: null,
  address: "서울시 서대문구 거북골로 21길57 제1호",
  public_phone: null,
  public_email: "contact@imagepartners.kr",
  ecommerce_registration_number: null,
  ecommerce_registration_authority: null,
  refund_policy: DEFAULT_REFUND_POLICY,
  receipt_policy: DEFAULT_RECEIPT_POLICY,
  show_business_name: true,
  show_representative_name: false,
  show_business_registration_number: false,
  show_address: true,
  show_public_phone: false,
  show_public_email: true,
  show_ecommerce_registration: false,
  is_published: false,
  published_at: null,
  updated_at: null,
};

export function disclosureIsCompleteForPaidCommerce(disclosure: BusinessDisclosure) {
  return Boolean(
    disclosure.business_name.trim() &&
    disclosure.representative_name?.trim() &&
    disclosure.business_registration_number?.trim() &&
    disclosure.address.trim() &&
    disclosure.public_phone?.trim() &&
    disclosure.public_email.trim() &&
    disclosure.ecommerce_registration_number?.trim() &&
    disclosure.ecommerce_registration_authority?.trim() &&
    disclosure.refund_policy.trim() &&
    disclosure.receipt_policy.trim() &&
    disclosure.show_business_name &&
    disclosure.show_representative_name &&
    disclosure.show_business_registration_number &&
    disclosure.show_address &&
    disclosure.show_public_phone &&
    disclosure.show_public_email &&
    disclosure.show_ecommerce_registration &&
    disclosure.is_published
  );
}

export function publicDisclosureRows(disclosure: BusinessDisclosure) {
  if (!disclosure.is_published) return [];
  return [
    disclosure.show_business_name ? ["상호", disclosure.business_name] : null,
    disclosure.show_representative_name ? ["대표자", disclosure.representative_name] : null,
    disclosure.show_business_registration_number ? ["사업자등록번호", disclosure.business_registration_number] : null,
    disclosure.show_address ? ["사업장 주소", disclosure.address] : null,
    disclosure.show_public_phone ? ["전화번호", disclosure.public_phone] : null,
    disclosure.show_public_email ? ["이메일", disclosure.public_email] : null,
    disclosure.show_ecommerce_registration
      ? [
          "통신판매업 신고",
          [disclosure.ecommerce_registration_number, disclosure.ecommerce_registration_authority]
            .filter(Boolean)
            .join(" / "),
        ]
      : null,
  ].filter((row): row is [string, string] => Boolean(row?.[1]));
}
