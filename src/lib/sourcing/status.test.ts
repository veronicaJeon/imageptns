import { describe, expect, it } from "vitest";
import {
  BUYER_SOURCING_STATUSES,
  RIGHTS_CHECK_RESULTS,
  canRequestRevision,
  internalToBuyerSourcingStatus,
  revisionLimitNotice,
} from "./status";

describe("sourcing status helpers", () => {
  it("maps internal statuses to simple buyer statuses", () => {
    expect(internalToBuyerSourcingStatus("submitted")).toBe("received");
    expect(internalToBuyerSourcingStatus("matching")).toBe("under_review");
    expect(internalToBuyerSourcingStatus("drafting")).toBe("under_review");
    expect(internalToBuyerSourcingStatus("answered")).toBe("answer_ready");
    expect(internalToBuyerSourcingStatus("fulfilled")).toBe("closed");
    expect(internalToBuyerSourcingStatus("cancelled")).toBe("closed");
  });

  it("exports stable buyer status and rights result labels", () => {
    expect(BUYER_SOURCING_STATUSES.map((status) => status.labelKo)).toEqual([
      "접수됨",
      "검토 중",
      "후보 제안됨",
      "종료",
    ]);
    expect(RIGHTS_CHECK_RESULTS.map((result) => result.labelKo)).toEqual([
      "사용 가능",
      "조건부 가능",
      "확인 불가",
      "사용 비권장",
    ]);
  });

  it("allows at most three buyer revision requests", () => {
    expect(canRequestRevision(0)).toBe(true);
    expect(canRequestRevision(2)).toBe(true);
    expect(canRequestRevision(3)).toBe(false);
    expect(revisionLimitNotice).toBe("이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요.");
  });
});
