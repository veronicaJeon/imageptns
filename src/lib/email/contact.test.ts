import { describe, expect, it, vi } from "vitest";
import { sendContactEmails } from "./contact";

const payload = {
  name: "홍길동",
  email: "buyer@example.com",
  subject: "라이선스 문의",
  message: "이미지 사용 범위를 알고 싶습니다.",
};

describe("sendContactEmails", () => {
  it("awaits both customer confirmation and ops notification", async () => {
    const sendConfirmation = vi.fn().mockResolvedValue(undefined);
    const notifyOps = vi.fn().mockResolvedValue(undefined);

    await sendContactEmails(payload, { sendConfirmation, notifyOps });

    expect(sendConfirmation).toHaveBeenCalledWith({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
    });
    expect(notifyOps).toHaveBeenCalledWith(payload);
  });

  it("throws when either delivery fails", async () => {
    await expect(
      sendContactEmails(payload, {
        sendConfirmation: vi.fn().mockResolvedValue(undefined),
        notifyOps: vi.fn().mockRejectedValue(new Error("SMTP rejected")),
      }),
    ).rejects.toThrow("Contact email delivery failed");
  });
});
