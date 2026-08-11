import { escapeHtml } from "./html";
import { DEFAULT_OPS_EMAIL, PUBLIC_CONTACT_EMAIL } from "./inbound";
import type { PhotoRequestInviteEmailPayload } from "./contact";
import { buildSiteUrl } from "../routing/canonical";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Image Partners <contact@imagepartners.kr>";
const OPS_EMAIL  = process.env.OPS_EMAIL ?? DEFAULT_OPS_EMAIL;

interface EmailPayload {
  to:      string | string[];
  subject: string;
  html:    string;
  replyTo?: string;
}

interface ResendDomainRecord {
  record?: string;
  name?: string;
  type?: string;
  value?: string;
  status?: string;
}

interface ResendDomain {
  name: string;
  status: string;
  capabilities?: {
    sending?: string;
    receiving?: string;
  };
  records?: ResendDomainRecord[];
}

interface ResendWebhook {
  endpoint: string;
  status?: string;
  events?: string[];
}

async function resendApiJson(path: string) {
  if (!RESEND_API_KEY) {
    return { ok: false as const, status: 0, data: null, reason: "api_key_not_set" as const };
  }

  try {
    const response = await fetch(`https://api.resend.com${path}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      data,
      reason: response.ok
        ? null
        : response.status === 401
          ? "api_key_invalid"
          : response.status === 403
            ? "api_key_permission_denied"
            : "provider_error",
    } as const;
  } catch {
    return { ok: false as const, status: 0, data: null, reason: "provider_unreachable" as const };
  }
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  const { replyTo, ...message } = payload;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      ...message,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[resend] send failed", err);
    throw new Error("Resend email delivery failed");
  }
}

function emailDomain(value: string) {
  const address = value.match(/<([^>]+)>/)?.[1] ?? value;
  return address.split("@")[1]?.trim().toLowerCase() ?? null;
}

export function resendRuntimeConfiguration() {
  return {
    apiKeyConfigured: Boolean(process.env.RESEND_API_KEY),
    inboundWebhookConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    fromConfigured: Boolean(process.env.RESEND_FROM_EMAIL),
    opsConfigured: Boolean(process.env.OPS_EMAIL),
    fromDomain: emailDomain(FROM_EMAIL),
    opsDomain: emailDomain(OPS_EMAIL),
    usingResendTestSender: emailDomain(FROM_EMAIL) === "resend.dev",
  };
}

export async function verifyResendProvider() {
  const configuration = resendRuntimeConfiguration();
  if (!configuration.apiKeyConfigured) {
    return {
      ok: false as const,
      reason: "api_key_not_set" as const,
      configuration,
      domain: null,
      inboundWebhook: null,
    };
  }

  const domainsResponse = await resendApiJson("/domains");
  if (!domainsResponse.ok) {
    return {
      ok: false as const,
      reason: domainsResponse.reason,
      providerStatus: domainsResponse.status,
      configuration,
      domain: null,
      inboundWebhook: null,
    };
  }

  const domains = ((domainsResponse.data as { data?: ResendDomain[] } | null)?.data ?? []);
  const domain = domains.find((candidate) => candidate.name.toLowerCase() === configuration.fromDomain) ?? null;
  if (!domain) {
    return {
      ok: false as const,
      reason: "sending_domain_missing" as const,
      configuration,
      domain: null,
      inboundWebhook: null,
    };
  }

  const webhooksResponse = await resendApiJson("/webhooks");
  const webhooks = webhooksResponse.ok
    ? ((webhooksResponse.data as { data?: ResendWebhook[] } | null)?.data ?? [])
    : [];
  const expectedEndpoint = buildSiteUrl("/api/webhooks/resend-inbound");
  const inboundWebhook = webhooks.find((webhook) => (
    webhook.endpoint === expectedEndpoint &&
    webhook.events?.includes("email.received")
  )) ?? null;
  const domainVerified = domain.status === "verified";
  const sendingEnabled = domain.capabilities?.sending === "enabled";
  const receivingEnabled = domain.capabilities?.receiving === "enabled";
  const webhookEnabled = inboundWebhook?.status !== "disabled" && Boolean(inboundWebhook);

  return {
    ok: domainVerified && sendingEnabled && receivingEnabled && webhookEnabled,
    reason: !domainVerified
      ? "sending_domain_not_verified"
      : !sendingEnabled
        ? "sending_not_enabled"
        : !receivingEnabled
          ? "receiving_not_enabled"
          : !webhooksResponse.ok
            ? webhooksResponse.reason
            : !webhookEnabled
              ? "inbound_webhook_missing"
              : null,
    configuration,
    domain: {
      name: domain.name,
      status: domain.status,
      capabilities: domain.capabilities ?? null,
      records: domain.records ?? [],
    },
    inboundWebhook: inboundWebhook
      ? {
        endpoint: inboundWebhook.endpoint,
        status: inboundWebhook.status ?? "enabled",
        events: inboundWebhook.events ?? [],
      }
      : null,
  };
}

export async function sendContactConfirmation(opts: {
  name:    string;
  email:   string;
  subject: string;
}) {
  const name = escapeHtml(opts.name);
  const subject = escapeHtml(opts.subject);
  await sendEmail({
    to:      opts.email,
    subject: `[Image Partners] 문의가 접수되었습니다 — ${opts.subject}`,
    html: `
      <p>${name}님, 안녕하세요.</p>
      <p>문의해 주셔서 감사합니다. 빠른 시일 내에 답변 드리겠습니다.</p>
      <p>문의 제목: <strong>${subject}</strong></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

interface OrderEmailItem {
  title: string;
  assetId?: string | null;
  licenseName: string;
  priceKrw: number;
}

function orderItemsHtml(items: OrderEmailItem[]) {
  return items.map((item) => `
    <li>
      <strong>${escapeHtml(item.title)}</strong>
      ${item.assetId ? ` · ${escapeHtml(item.assetId)}` : ""}
      · ${escapeHtml(item.licenseName)}
      · ₩${item.priceKrw.toLocaleString("ko-KR")}
    </li>
  `).join("");
}

function orderPolicyLinksHtml() {
  return `
    <p>
      <a href="${buildSiteUrl("/terms")}">이용약관</a> ·
      <a href="${buildSiteUrl("/license-guide")}">라이선스 안내</a> ·
      <a href="${buildSiteUrl("/business-info")}">사업자정보·취소환불 정책</a>
    </p>
  `;
}

export async function sendFreeOrderConfirmed(opts: {
  buyerEmail: string;
  buyerName: string;
  orderNumber: string;
  totalKrw: number;
  items: OrderEmailItem[];
}) {
  await sendEmail({
    to: opts.buyerEmail,
    subject: `[Image Partners] 무료 사용권이 확정되었습니다 — ${opts.orderNumber}`,
    html: `
      <p>${escapeHtml(opts.buyerName)}님, 무료 사용권이 확정되었습니다.</p>
      <p><strong>주문번호:</strong> ${escapeHtml(opts.orderNumber)}</p>
      <ul>${orderItemsHtml(opts.items)}</ul>
      <p><strong>합계:</strong> ₩${opts.totalKrw.toLocaleString("ko-KR")}</p>
      <p><a href="${buildSiteUrl("/dashboard/orders")}">주문 내역에서 원본 다운로드하기 →</a></p>
      ${orderPolicyLinksHtml()}
      <p>이 메일은 주문 당시 계약내용에 관한 전자문서입니다. 필요한 기간 동안 보관해 주세요.</p>
    `,
  });
}

export async function sendBankTransferRequested(opts: {
  buyerEmail: string;
  buyerName: string;
  orderNumber: string;
  subtotalKrw: number;
  vatKrw: number;
  totalKrw: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  items: OrderEmailItem[];
}) {
  await sendEmail({
    to: opts.buyerEmail,
    subject: `[Image Partners] 계좌이체 요청이 접수되었습니다 — ${opts.orderNumber}`,
    html: `
      <p>${escapeHtml(opts.buyerName)}님, 계좌이체 요청이 접수되었습니다.</p>
      <p><strong>주문번호:</strong> ${escapeHtml(opts.orderNumber)}</p>
      <ul>${orderItemsHtml(opts.items)}</ul>
      <p>공급가액 ₩${opts.subtotalKrw.toLocaleString("ko-KR")} · VAT ₩${opts.vatKrw.toLocaleString("ko-KR")} · <strong>입금액 ₩${opts.totalKrw.toLocaleString("ko-KR")}</strong></p>
      <p><strong>입금계좌:</strong> ${escapeHtml(opts.bankName)} ${escapeHtml(opts.accountNumber)} / 예금주 ${escapeHtml(opts.accountHolder)}</p>
      <p>운영팀이 입금을 확인하면 주문이 확정되고 원본 다운로드 권한이 열립니다.</p>
      ${orderPolicyLinksHtml()}
      <p>이 메일은 주문 당시 계약내용에 관한 전자문서입니다. 필요한 기간 동안 보관해 주세요.</p>
    `,
  });
}

export async function notifyOpsBankTransferRequested(opts: {
  buyerEmail: string;
  buyerName: string;
  orderNumber: string;
  totalKrw: number;
  items: OrderEmailItem[];
}) {
  await sendEmail({
    to: OPS_EMAIL,
    replyTo: opts.buyerEmail,
    subject: `[계좌이체 요청] ${opts.orderNumber} — ₩${opts.totalKrw.toLocaleString("ko-KR")}`,
    html: `
      <p><strong>구매자:</strong> ${escapeHtml(opts.buyerName)} (${escapeHtml(opts.buyerEmail)})</p>
      <p><strong>주문번호:</strong> ${escapeHtml(opts.orderNumber)}</p>
      <p><strong>요청금액:</strong> ₩${opts.totalKrw.toLocaleString("ko-KR")}</p>
      <ul>${orderItemsHtml(opts.items)}</ul>
      <p><a href="${buildSiteUrl("/admin/payment-requests")}">관리자 입금확인 화면 열기 →</a></p>
    `,
  });
}

export async function sendBankTransferReviewed(opts: {
  buyerEmail: string;
  buyerName: string;
  orderNumber: string;
  status: "approved" | "canceled";
  totalKrw: number;
  note?: string | null;
  items: OrderEmailItem[];
}) {
  const approved = opts.status === "approved";
  await sendEmail({
    to: opts.buyerEmail,
    subject: `[Image Partners] 계좌이체 주문이 ${approved ? "확정" : "취소"}되었습니다 — ${opts.orderNumber}`,
    html: `
      <p>${escapeHtml(opts.buyerName)}님, 계좌이체 주문이 <strong>${approved ? "확정" : "취소"}</strong>되었습니다.</p>
      <p><strong>주문번호:</strong> ${escapeHtml(opts.orderNumber)}</p>
      <p><strong>금액:</strong> ₩${opts.totalKrw.toLocaleString("ko-KR")}</p>
      <ul>${orderItemsHtml(opts.items)}</ul>
      ${opts.note ? `<p><strong>운영 메모:</strong> ${escapeHtml(opts.note)}</p>` : ""}
      ${approved
        ? `<p><a href="${buildSiteUrl("/dashboard/orders")}">주문 내역에서 원본 다운로드하기 →</a></p>`
        : `<p>입금 또는 환급 확인이 필요한 경우 ${PUBLIC_CONTACT_EMAIL}으로 문의해 주세요.</p>`}
      ${orderPolicyLinksHtml()}
    `,
  });
}

export async function notifyOpsContact(opts: {
  name:    string;
  email:   string;
  subject: string;
  message: string;
  phone?: string | null;
  organization?: string | null;
}) {
  const name = escapeHtml(opts.name);
  const email = escapeHtml(opts.email);
  const subject = escapeHtml(opts.subject);
  const message = escapeHtml(opts.message);
  const phone = opts.phone ? escapeHtml(opts.phone) : null;
  const organization = opts.organization ? escapeHtml(opts.organization) : null;
  await sendEmail({
    to:      OPS_EMAIL,
    replyTo: opts.email,
    subject: `[문의] ${opts.subject} — ${opts.name}`,
    html: `
      <p><strong>이름:</strong> ${name}</p>
      <p><strong>이메일:</strong> ${email}</p>
      ${phone ? `<p><strong>연락처:</strong> ${phone}</p>` : ""}
      ${organization ? `<p><strong>소속:</strong> ${organization}</p>` : ""}
      <p><strong>제목:</strong> ${subject}</p>
      <p><strong>내용:</strong></p>
      <pre>${message}</pre>
    `,
  });
}

export async function sendPayoutApproved(opts: {
  photographerEmail: string;
  photographerName:  string;
  period:            string;
  netKrw:            number;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const period = escapeHtml(opts.period);
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 정산이 완료되었습니다 — ${opts.period}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>${period} 기간의 정산이 처리되어 지급되었습니다.</p>
      <p><strong>지급 금액:</strong> ₩${opts.netKrw.toLocaleString("ko-KR")}</p>
      <p>수익 장부에서 상세 내역을 확인하실 수 있습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPayoutRejected(opts: {
  photographerEmail: string;
  photographerName:  string;
  period:            string;
  netKrw:            number;
  note?:             string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const period = escapeHtml(opts.period);
  const note = opts.note ? escapeHtml(opts.note) : null;
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 정산 처리 안내 — ${opts.period}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>${period} 기간의 정산 요청이 아래 사유로 처리되지 않았습니다.</p>
      <p><strong>신청 금액:</strong> ₩${opts.netKrw.toLocaleString("ko-KR")}</p>
      ${note ? `<p><strong>사유:</strong> ${note}</p>` : ""}
      <p>문의 사항은 ${PUBLIC_CONTACT_EMAIL}으로 연락해 주세요.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendImageRejected(opts: {
  photographerEmail: string;
  photographerName:  string;
  imageTitle:        string;
  assetId:           string;
  reason:            string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const imageTitle = escapeHtml(opts.imageTitle);
  const assetId = escapeHtml(opts.assetId);
  const reason = escapeHtml(opts.reason);
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 이미지 검토 결과 안내 — ${opts.imageTitle}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>제출하신 이미지가 아래 사유로 승인되지 않았습니다.</p>
      <p><strong>이미지:</strong> ${imageTitle}</p>
      <p><strong>에셋 ID:</strong> ${assetId}</p>
      <p><strong>반려 사유:</strong> ${reason}</p>
      <p>수정 후 다시 제출해 주시면 재검토 해드리겠습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPhotographerApplicationApproved(opts: {
  photographerEmail: string;
  photographerName: string;
}) {
  const photographerName = escapeHtml(opts.photographerName);

  await sendEmail({
    to: opts.photographerEmail,
    subject: "[Image Partners] 사진작가 신청이 승인되었습니다",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진작가 신청이 승인되었습니다. 이제 이미지 업로드, 운영팀 요청, 사용권 판매·정산 기능을 사용할 수 있습니다.</p>
      <p><a href="${buildSiteUrl("/dashboard/uploads")}">대시보드에서 업로드 시작하기 →</a></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPhotographerApplicationRejected(opts: {
  photographerEmail: string;
  photographerName: string;
  reason: string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const reason = escapeHtml(opts.reason);

  await sendEmail({
    to: opts.photographerEmail,
    subject: "[Image Partners] 사진작가 신청 검토 결과 안내",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진작가 신청이 아래 사유로 승인되지 않았습니다.</p>
      <p><strong>사유:</strong> ${reason}</p>
      <p>정보를 보완한 뒤 설정 페이지에서 다시 신청할 수 있습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPhotographerAccessSuspended(opts: {
  photographerEmail: string;
  photographerName: string;
  reason?: string | null;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const reason = opts.reason ? escapeHtml(opts.reason) : null;

  await sendEmail({
    to: opts.photographerEmail,
    subject: "[Image Partners] 사진작가 권한 상태 안내",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>운영 확인이 필요한 사유로 사진작가 권한이 중지되었습니다.</p>
      ${reason ? `<p><strong>메모:</strong> ${reason}</p>` : ""}
      <p>설정 페이지에서 활동 정보를 보완해 재신청할 수 있습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPhotoRequestInvite(opts: PhotoRequestInviteEmailPayload) {
  const photographerName = escapeHtml(opts.photographerName);
  const requestTitle = escapeHtml(opts.requestTitle);
  const locationLabel = opts.locationLabel ? escapeHtml(opts.locationLabel) : null;
  const usageProject = opts.usageProject ? escapeHtml(opts.usageProject) : null;
  const usageContext = opts.usageContext ? escapeHtml(opts.usageContext) : null;
  const deadlineAt = opts.deadlineAt ? escapeHtml(new Date(opts.deadlineAt).toLocaleDateString("ko-KR")) : null;
  const budgetLabel = opts.budgetLabel ? escapeHtml(opts.budgetLabel) : null;

  await sendEmail({
    to: opts.photographerEmail,
    subject: `[Image Partners] 이미지 의뢰 초대 — ${opts.requestTitle}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>Image Partners 운영팀에서 아래 이미지 의뢰 후보로 초대드립니다.</p>
      <p><strong>의뢰:</strong> ${requestTitle}</p>
      ${usageProject ? `<p><strong>사용 프로젝트:</strong> ${usageProject}</p>` : ""}
      ${usageContext ? `<p><strong>사용 맥락:</strong> ${usageContext}</p>` : ""}
      ${locationLabel ? `<p><strong>지역:</strong> ${locationLabel}</p>` : ""}
      ${deadlineAt ? `<p><strong>희망 마감:</strong> ${deadlineAt}</p>` : ""}
      ${budgetLabel ? `<p><strong>예산:</strong> ${budgetLabel}</p>` : ""}
      <p>참여 가능 여부와 세부 조건은 Image Partners 계정에서 확인해 주세요.</p>
      <p>문의 사항은 ${PUBLIC_CONTACT_EMAIL}으로 연락해 주세요.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendSupportStatusUpdate(opts: {
  name: string;
  email: string;
  subject: string;
  status: "in_progress" | "resolved";
  inquiryType: "general" | "photo_request" | string;
}) {
  const name = escapeHtml(opts.name || "고객");
  const subject = escapeHtml(opts.subject);
  const statusLabel = opts.status === "resolved" ? "답변 완료" : "검토 중";
  const destination = opts.inquiryType === "photo_request" ? "/dashboard/sourcing" : "/contact";

  await sendEmail({
    to: opts.email,
    subject: `[Image Partners] 문의 상태가 ${statusLabel}으로 변경되었습니다 — ${opts.subject}`,
    html: `
      <p>${name}님, 안녕하세요.</p>
      <p>문의 <strong>${subject}</strong>의 처리 상태가 <strong>${statusLabel}</strong>으로 변경되었습니다.</p>
      <p>${opts.status === "resolved" ? "답변 내용을 확인해 주세요." : "담당자가 내용을 확인하고 있습니다. 처리가 완료되면 다시 알려드리겠습니다."}</p>
      <p><a href="${buildSiteUrl(destination)}">Image Partners에서 확인하기 →</a></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}
