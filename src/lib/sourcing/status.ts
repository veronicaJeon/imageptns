export type BuyerSourcingStatusCode = "received" | "under_review" | "answer_ready" | "closed";
export type RightsCheckResultCode = "usable" | "conditional" | "unverified" | "not_recommended";

export const revisionLimitNotice =
  "이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요.";

export const BUYER_SOURCING_STATUSES: Array<{ code: BuyerSourcingStatusCode; labelKo: string }> = [
  { code: "received", labelKo: "접수됨" },
  { code: "under_review", labelKo: "검토 중" },
  { code: "answer_ready", labelKo: "후보 제안됨" },
  { code: "closed", labelKo: "종료" },
];

export const RIGHTS_CHECK_RESULTS: Array<{ code: RightsCheckResultCode; labelKo: string }> = [
  { code: "usable", labelKo: "사용 가능" },
  { code: "conditional", labelKo: "조건부 가능" },
  { code: "unverified", labelKo: "확인 불가" },
  { code: "not_recommended", labelKo: "사용 비권장" },
];

export function internalToBuyerSourcingStatus(status: string | null | undefined): BuyerSourcingStatusCode {
  if (status === "answered") return "answer_ready";
  if (status === "fulfilled" || status === "cancelled" || status === "rejected" || status === "closed") {
    return "closed";
  }
  if (status === "submitted") return "received";
  return "under_review";
}

export function canRequestRevision(revisionCount: number) {
  return Number.isFinite(revisionCount) && revisionCount < 3;
}
