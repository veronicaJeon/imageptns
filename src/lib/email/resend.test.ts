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

  it("reports an invalid provider key without attempting delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "expired-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: "API key is invalid" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { verifyResendProvider } = await import("./resend");
    const result = await verifyResendProvider();

    expect(result).toMatchObject({
      ok: false,
      reason: "api_key_invalid",
      providerStatus: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("requires a verified sending and receiving domain plus inbound webhook", async () => {
    vi.stubEnv("RESEND_API_KEY", "valid-key");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.imagepartners.kr");
    vi.stubEnv("RESEND_FROM_EMAIL", "Image Partners <contact@imagepartners.kr>");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_test");
    vi.stubEnv("OPS_EMAIL", "imgptns@gmail.com");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          name: "imagepartners.kr",
          status: "verified",
          capabilities: { sending: "enabled", receiving: "enabled" },
          records: [],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [{
          endpoint: "https://www.imagepartners.kr/api/webhooks/resend-inbound",
          status: "enabled",
          events: ["email.received"],
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const { verifyResendProvider } = await import("./resend");
    const result = await verifyResendProvider();

    expect(result).toMatchObject({
      ok: true,
      reason: null,
      domain: {
        name: "imagepartners.kr",
        capabilities: { sending: "enabled", receiving: "enabled" },
      },
      inboundWebhook: {
        endpoint: "https://www.imagepartners.kr/api/webhooks/resend-inbound",
      },
    });
  });
});
