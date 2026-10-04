export const GENERAL_INQUIRY_REPLY_MAX_LENGTH = 5000;

// Keeps the operator's line breaks; only trims surrounding whitespace.
export function normalizeGeneralInquiryReply(value: unknown): string {
  if (typeof value !== "string") throw new Error("답변 내용을 입력해주세요.");
  const reply = value.replace(/\r\n/g, "\n").trim();
  if (!reply) throw new Error("답변 내용을 입력해주세요.");
  if (reply.length > GENERAL_INQUIRY_REPLY_MAX_LENGTH) {
    throw new Error(`답변은 ${GENERAL_INQUIRY_REPLY_MAX_LENGTH.toLocaleString("ko-KR")}자 이내로 입력해주세요.`);
  }
  return reply;
}
