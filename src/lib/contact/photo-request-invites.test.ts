import { describe, expect, it } from "vitest";
import { buildPhotoRequestInviteRecipients, formatPhotoRequestBudget } from "./photo-request-invites";

describe("photo request invite helpers", () => {
  it("only selects candidate matches with photographer email addresses", () => {
    const result = buildPhotoRequestInviteRecipients([
      {
        id: "match-candidate",
        photographer_id: "photographer-1",
        status: "candidate",
        photographerEmail: " artist@example.com ",
        photographerName: " 김작가 ",
      },
      {
        id: "match-invited",
        photographer_id: "photographer-2",
        status: "invited",
        photographerEmail: "invited@example.com",
        photographerName: "이미초대",
      },
      {
        id: "match-selected",
        photographer_id: "photographer-3",
        status: "selected",
        photographerEmail: "selected@example.com",
        photographerName: "선택됨",
      },
      {
        id: "match-missing-email",
        photographer_id: "photographer-4",
        status: "candidate",
        photographerEmail: null,
        photographerName: null,
      },
    ]);

    expect(result.recipients).toEqual([
      {
        matchId: "match-candidate",
        photographerId: "photographer-1",
        photographerEmail: "artist@example.com",
        photographerName: "김작가",
      },
    ]);
    expect(result.skipped).toEqual([
      { matchId: "match-invited", status: "invited", reason: "status_not_sendable" },
      { matchId: "match-selected", status: "selected", reason: "status_not_sendable" },
      { matchId: "match-missing-email", status: "candidate", reason: "missing_email" },
    ]);
  });

  it("formats budget ranges for invite email context", () => {
    expect(formatPhotoRequestBudget(100000, 250000)).toBe("₩100,000 ~ ₩250,000");
    expect(formatPhotoRequestBudget(100000, null)).toBe("₩100,000 이상");
    expect(formatPhotoRequestBudget(null, 250000)).toBe("₩250,000 이하");
    expect(formatPhotoRequestBudget(null, null)).toBeNull();
  });
});
