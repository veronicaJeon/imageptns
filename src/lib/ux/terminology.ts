export const KO_SERVICE_TERMS = {
  asset: "이미지",
  contributor: "사진작가",
  contributorCredit: "사진작가명 또는 스튜디오명",
  customer: "구매자",
  imageRequest: "이미지 요청",
  license: "라이선스",
  paidLicenseAction: "사용권 구매",
  freeLicenseAction: "무료 사용권 확정",
  bankTransfer: "계좌이체",
  order: "주문",
  unpublish: "공개 중지",
  deletionRequest: "삭제 요청",
  permanentDeletion: "완전삭제",
  arweaveProof: "Arweave 원본 증명",
} as const;

export const IMAGE_REVIEW_STATUS_LABELS = {
  all: "전체",
  draft: "임시저장",
  pending: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
} as const;

export const PHOTOGRAPHER_APPLICATION_STATUS_LABELS = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "승인되지 않음",
} as const;

export const PAYOUT_STATUS_LABELS = {
  pending: "정산 대기",
  paid: "지급 완료",
  rejected: "반려됨",
} as const;
