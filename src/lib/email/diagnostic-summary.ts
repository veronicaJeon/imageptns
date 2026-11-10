export type EmailDiagnosticTone = "ok" | "warning" | "error";

export interface EmailDiagnosticItem {
  status: EmailDiagnosticTone;
  detail: string;
}

interface DiagnosticInput {
  gmail: {
    ok: boolean;
    reason?: string;
    error?: { code?: string };
  };
  resend: {
    ok: boolean;
    reason: string | null;
    providerStatus?: number;
    configuration: {
      apiKeyConfigured: boolean;
      inboundWebhookConfigured: boolean;
      fromConfigured: boolean;
      opsConfigured: boolean;
    };
    domain: { capabilities: { sending?: string; receiving?: string } | null } | null;
    inboundWebhook: { status: string } | null;
  };
  dns: {
    mxConfigured: boolean;
    sendingMxConfigured: boolean;
    spfConfigured: boolean;
    dkimConfigured: boolean;
  };
}

export function buildEmailDiagnosticSummary(input: DiagnosticInput): {
  resend: EmailDiagnosticItem;
  inbound: EmailDiagnosticItem;
  smtpFallback: EmailDiagnosticItem;
} {
  const resendConfigured = input.resend.configuration.apiKeyConfigured
    && input.resend.configuration.fromConfigured
    && input.resend.configuration.opsConfigured
    && input.dns.sendingMxConfigured
    && input.dns.spfConfigured
    && input.dns.dkimConfigured;
  const providerReadRestricted = input.resend.reason === "provider_error"
    && [400, 401, 403].includes(input.resend.providerStatus ?? 0);

  const resend: EmailDiagnosticItem = input.resend.ok
    ? { status: "ok", detail: "도메인과 API 상태 확인" }
    : resendConfigured && providerReadRestricted
      ? { status: "warning", detail: "발송 설정 확인 · 제한된 API 키로 공급자 상태 조회 생략" }
      : { status: "error", detail: input.resend.reason ?? "발송 설정 확인 필요" };

  const inboundVerified = Boolean(
    input.resend.inboundWebhook
    && input.resend.inboundWebhook.status !== "disabled"
    && input.resend.domain?.capabilities?.receiving === "enabled",
  );
  const inboundConfigured = input.resend.configuration.inboundWebhookConfigured
    && input.dns.mxConfigured;
  const inbound: EmailDiagnosticItem = inboundVerified
    ? { status: "ok", detail: "수신 도메인과 웹훅 연결 확인" }
    : inboundConfigured && providerReadRestricted
      ? { status: "warning", detail: "수신 DNS·웹훅 비밀키 확인 · 공급자 상태 조회 생략" }
      : { status: "error", detail: "수신 웹훅 또는 도메인 설정 확인 필요" };

  const smtpUnsupported = input.gmail.error?.code === "ESOCKET";
  const smtpFallback: EmailDiagnosticItem = input.gmail.ok
    ? { status: "ok", detail: "비상 SMTP 연결 확인" }
    : smtpUnsupported
      ? { status: "warning", detail: "Cloudflare Workers는 직접 SMTP를 지원하지 않아 Resend를 기본 경로로 사용" }
      : { status: "warning", detail: input.gmail.reason ?? input.gmail.error?.code ?? "비상 SMTP 미사용" };

  return { resend, inbound, smtpFallback };
}
