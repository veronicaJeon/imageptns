import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Resend routing", () => {
  it("uses the public domain sender and routes operations mail to Gmail", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubEnv("RESEND_FROM_EMAIL", "Image Partners <contact@imagepartners.kr>");
    vi.stubEnv("OPS_EMAIL", "imgptns@gmail.com");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "email-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { notifyOpsContact } = await import("./resend");
    await notifyOpsContact({
      name: "요청자",
      email: "requester@example.com",
      subject: "문의",
      message: "내용",
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "Image Partners <contact@imagepartners.kr>",
      to: "imgptns@gmail.com",
      reply_to: "requester@example.com",
    });
  });

  it("fails visibly when the provider key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const { sendContactConfirmation } = await import("./resend");

    await expect(sendContactConfirmation({
      name: "고객",
      email: "customer@example.com",
      subject: "문의",
    })).rejects.toThrow("RESEND_API_KEY");
  });
});
