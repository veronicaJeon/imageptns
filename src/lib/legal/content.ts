export const LEGAL_DOCUMENT_SLUGS = ["privacy", "terms", "license_guide", "cookie"] as const;

export type LegalDocumentSlug = typeof LEGAL_DOCUMENT_SLUGS[number];

export interface LegalDocumentContent {
  slug: LegalDocumentSlug;
  title: string;
  body: string;
}

export const DEFAULT_LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocumentContent> = {
  privacy: {
    slug: "privacy",
    title: "개인정보처리방침",
    body: [
      "Image Partners는 회원 가입, 이미지 라이선스 거래, 정산 및 고객지원을 위해 필요한 최소한의 개인정보를 처리합니다.",
      "관리자는 관련 법령과 서비스 운영 정책이 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.",
    ].join("\n\n"),
  },
  terms: {
    slug: "terms",
    title: "이용약관",
    body: [
      "본 약관은 Image Partners 서비스 이용 조건, 회원의 권리와 의무, 플랫폼 운영 기준을 정합니다.",
      "관리자는 서비스 정책 또는 법적 요건이 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.",
    ].join("\n\n"),
  },
  license_guide: {
    slug: "license_guide",
    title: "라이선스 안내",
    body: [
      "Image Partners의 이미지 라이선스는 구매자가 선택한 사용 범위와 사진가가 설정한 저작권 정책을 기준으로 적용됩니다.",
      "관리자는 상품 가격, 무료 사용 조건, Creative Commons 정책 변경 시 본 문서를 최신 내용으로 갱신해야 합니다.",
    ].join("\n\n"),
  },
  cookie: {
    slug: "cookie",
    title: "쿠키 정책",
    body: [
      "Image Partners는 로그인 유지, 장바구니, 방문 로그, 서비스 분석을 위해 쿠키와 유사 기술을 사용할 수 있습니다.",
      "관리자는 쿠키 사용 목적 또는 외부 분석 도구가 변경될 때 본 문서를 최신 내용으로 갱신해야 합니다.",
    ].join("\n\n"),
  },
};

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return (LEGAL_DOCUMENT_SLUGS as readonly string[]).includes(value);
}

export function normalizeLegalDocument(
  slug: LegalDocumentSlug,
  input: { title?: string | null; body?: string | null },
): LegalDocumentContent {
  const fallback = DEFAULT_LEGAL_DOCUMENTS[slug];
  const title = input.title?.trim() || fallback.title;
  const body = input.body?.trim() || fallback.body;

  return { slug, title, body };
}
