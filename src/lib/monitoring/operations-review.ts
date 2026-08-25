export type OperationsReviewStatus = "ok" | "warning" | "error";

export interface OperationsReviewMetrics {
  inventory: {
    publicImages: number;
    missingPreview: number;
    invalidPreview: number;
    missingAnalysis: number;
  };
  workflow: {
    imageReviewOver24h: number;
    photographerApplicationOver48h: number;
    generalInquiryOver24h: number;
    photoRequestOver24h: number;
    bankTransferOver24h: number;
  };
  semantic: {
    enabled: boolean;
    ready: number;
    pending: number;
    failed: number;
    missing: number;
  };
  delivery: { failedOrderEmails: number };
  reliability: { requestErrors24h: number };
  activity24h: {
    newUsers: number;
    uploads: number;
    completedOrders: number;
    downloads: number;
  };
  activityPrevious24h: {
    newUsers: number;
    uploads: number;
    completedOrders: number;
    downloads: number;
  };
}

export interface OperationsReviewFinding {
  code: string;
  severity: Exclude<OperationsReviewStatus, "ok">;
  count: number;
  message: string;
}

export interface OperationsReviewResult {
  status: OperationsReviewStatus;
  metrics: OperationsReviewMetrics;
  findings: OperationsReviewFinding[];
}

export function evaluateOperationsReview(metrics: OperationsReviewMetrics): OperationsReviewResult {
  const findings: OperationsReviewFinding[] = [];
  const add = (
    code: string,
    severity: OperationsReviewFinding["severity"],
    count: number,
    message: string,
  ) => {
    if (count > 0) findings.push({ code, severity, count, message });
  };

  add("PUBLIC_PREVIEW_MISSING", "error", metrics.inventory.missingPreview, "공개 승인 이미지의 미리보기가 누락되었습니다.");
  add("PUBLIC_PREVIEW_INVALID", "error", metrics.inventory.invalidPreview, "공개 미리보기 파일이 없거나 JPEG가 아닙니다.");
  add("ANALYSIS_DERIVATIVE_MISSING", "warning", metrics.inventory.missingAnalysis, "공개 승인 이미지의 비공개 분석 사본이 누락되었습니다.");
  add("IMAGE_REVIEW_SLA", "warning", metrics.workflow.imageReviewOver24h, "24시간 넘게 검토 대기 중인 이미지가 있습니다.");
  add("PHOTOGRAPHER_APPLICATION_SLA", "warning", metrics.workflow.photographerApplicationOver48h, "48시간 넘게 대기 중인 사진가 신청이 있습니다.");
  add("GENERAL_INQUIRY_SLA", "warning", metrics.workflow.generalInquiryOver24h, "24시간 넘게 미처리된 일반 문의가 있습니다.");
  add("PHOTO_REQUEST_SLA", "warning", metrics.workflow.photoRequestOver24h, "24시간 넘게 매칭을 시작하지 않은 촬영 의뢰가 있습니다.");
  add("BANK_TRANSFER_SLA", "warning", metrics.workflow.bankTransferOver24h, "24시간 넘게 확인되지 않은 입금 요청이 있습니다.");
  add("SEMANTIC_INDEX_FAILED", "error", metrics.semantic.failed, "현재 검색 모델의 임베딩 실패가 있습니다.");
  add("SEMANTIC_INDEX_PENDING", "warning", metrics.semantic.pending, "현재 검색 모델의 임베딩 처리가 완료되지 않았습니다.");
  add("SEMANTIC_INDEX_MISSING", "warning", metrics.semantic.missing, "공개 승인 이미지의 임베딩이 누락되었습니다.");
  add("ORDER_EMAIL_FAILED", "warning", metrics.delivery.failedOrderEmails, "재시도가 필요한 주문 이메일이 있습니다.");
  add("REQUEST_ERROR_SPIKE", "error", metrics.reliability.requestErrors24h >= 5 ? metrics.reliability.requestErrors24h : 0, "최근 24시간 서버 오류가 5건 이상입니다.");
  const currentActivity = Object.values(metrics.activity24h).reduce((sum, value) => sum + value, 0);
  const previousActivity = Object.values(metrics.activityPrevious24h).reduce((sum, value) => sum + value, 0);
  add(
    "ACTIVITY_DROP",
    "warning",
    previousActivity >= 5 && currentActivity <= Math.floor(previousActivity * 0.2)
      ? previousActivity - currentActivity
      : 0,
    "가입·업로드·주문·다운로드 활동이 직전 24시간보다 80% 이상 감소했습니다.",
  );

  const status = findings.some((finding) => finding.severity === "error")
    ? "error"
    : findings.length > 0
      ? "warning"
      : "ok";
  return { status, metrics, findings };
}
