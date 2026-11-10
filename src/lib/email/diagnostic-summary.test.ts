import { describe, expect, it } from "vitest";
import { buildEmailDiagnosticSummary } from "./diagnostic-summary";

const configured = {
  gmail: { ok: false, error: { code: "ESOCKET" } },
  resend: {
    ok: false,
    reason: "provider_error",
    providerStatus: 400,
    configuration: {
      apiKeyConfigured: true,
      inboundWebhookConfigured: true,
      fromConfigured: true,
      opsConfigured: true,
    },
    domain: null,
    inboundWebhook: null,
  },
  dns: {
    mxConfigured: true,
    sendingMxConfigured: true,
    spfConfigured: true,
    dkimConfigured: true,
  },
};

describe("email diagnostic summary", () => {
  it("does not report restricted provider reads or unsupported Worker SMTP as outages", () => {
    expect(buildEmailDiagnosticSummary(configured)).toEqual({
      resend: { status: "warning", detail: "발송 설정 확인 · 제한된 API 키로 공급자 상태 조회 생략" },
      inbound: { status: "warning", detail: "수신 DNS·웹훅 비밀키 확인 · 공급자 상태 조회 생략" },
      smtpFallback: { status: "warning", detail: "Cloudflare Workers는 직접 SMTP를 지원하지 않아 Resend를 기본 경로로 사용" },
    });
  });

  it("keeps missing primary delivery configuration as an error", () => {
    const result = buildEmailDiagnosticSummary({
      ...configured,
      resend: {
        ...configured.resend,
        reason: "api_key_not_set",
        providerStatus: undefined,
        configuration: { ...configured.resend.configuration, apiKeyConfigured: false },
      },
    });
    expect(result.resend.status).toBe("error");
    expect(result.inbound.status).toBe("error");
    expect(result.smtpFallback.status).toBe("warning");
  });
});
