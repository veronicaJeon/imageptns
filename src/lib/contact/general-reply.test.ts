import { describe, expect, it } from "vitest";
import { GENERAL_INQUIRY_REPLY_MAX_LENGTH, normalizeGeneralInquiryReply } from "./general-reply";

describe("general inquiry reply", () => {
  it("trims the reply and keeps line breaks", () => {
    expect(normalizeGeneralInquiryReply("  안녕하세요.\r\n\r\n확인했습니다.  ")).toBe("안녕하세요.\n\n확인했습니다.");
  });

  it("rejects empty, non-string, and oversized replies", () => {
    expect(() => normalizeGeneralInquiryReply("   ")).toThrow("답변 내용을 입력해주세요.");
    expect(() => normalizeGeneralInquiryReply(null)).toThrow("답변 내용을 입력해주세요.");
    expect(() => normalizeGeneralInquiryReply("가".repeat(GENERAL_INQUIRY_REPLY_MAX_LENGTH + 1))).toThrow("5,000자");
  });
});
