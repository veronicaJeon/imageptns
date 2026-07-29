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

export async function notifyOpsNewUpload(opts: {
  photographerEmail: string;
  photographerName:  string;
  imageTitle:        string;
  imageId:           string;
}) {
  const photographerEmail = escapeHtml(opts.photographerEmail);
  const photographerName = escapeHtml(opts.photographerName);
  const imageTitle = escapeHtml(opts.imageTitle);
  const imageId = escapeHtml(opts.imageId);
  await sendEmail({
    to:      OPS_EMAIL,
    subject: `[새 업로드] ${opts.imageTitle} — ${opts.photographerName}`,
    html: `
      <p>새 이미지가 심사 대기 중입니다.</p>
      <p><strong>제목:</strong> ${imageTitle}</p>
      <p><strong>사진작가:</strong> ${photographerName} (${photographerEmail})</p>
      <p><strong>이미지 ID:</strong> ${imageId}</p>
      <p><a href="${buildSiteUrl("/admin/images")}">관리자 페이지에서 검토하기 →</a></p>
    `,
  });
}

export async function sendImageApproved(opts: {
  photographerEmail: string;
  photographerName:  string;
  imageTitle:        string;
  assetId:           string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const imageTitle = escapeHtml(opts.imageTitle);
  const assetId = escapeHtml(opts.assetId);
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 이미지가 승인되었습니다 — ${opts.imageTitle}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>제출하신 이미지가 검토를 통과하여 라이브러리에 게시되었습니다.</p>
      <p><strong>이미지:</strong> ${imageTitle}</p>
      <p><strong>에셋 ID:</strong> ${assetId}</p>
      <p>바이어들이 이미지를 검색하고 라이선스를 구매할 수 있습니다.</p>
      <br><p>Image Partners 팀 드림</p>
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
    subject: "[Image Partners] 사진가 신청이 승인되었습니다",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진가 신청이 승인되었습니다. 이제 이미지 업로드, 운영팀 요청, 판매 정산 기능을 사용할 수 있습니다.</p>
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
    subject: "[Image Partners] 사진가 신청 검토 결과 안내",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진가 신청이 아래 사유로 승인되지 않았습니다.</p>
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
    subject: "[Image Partners] 사진가 권한 상태 안내",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>운영 확인이 필요한 사유로 사진가 권한이 중지되었습니다.</p>
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
    subject: `[Image Partners] 사진 의뢰 초대 — ${opts.requestTitle}`,
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>Image Partners 운영팀에서 아래 사진 의뢰 후보로 초대드립니다.</p>
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
