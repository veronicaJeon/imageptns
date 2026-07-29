import nodemailer from "nodemailer";
import { escapeHtml } from "./html";
import { buildSiteUrl } from "../routing/canonical";

// Set in Vercel env vars:
//   GMAIL_SMTP_USER = imgptns@gmail.com
//   GMAIL_SMTP_PASS = Gmail App Password (Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호)
const SMTP_USER = process.env.GMAIL_SMTP_USER ?? "";
const SMTP_PASS = process.env.GMAIL_SMTP_PASS ?? "";

class MissingSmtpCredentialsError extends Error {
  code = "SMTP_CREDENTIALS_MISSING";

  constructor() {
    super("GMAIL_SMTP_USER and GMAIL_SMTP_PASS must be set before sending email");
    this.name = "MissingSmtpCredentialsError";
  }
}

function assertSmtpCredentials() {
  if (!SMTP_USER || !SMTP_PASS) {
    throw new MissingSmtpCredentialsError();
  }
}

function createTransport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export interface SafeEmailErrorDetails {
  name?: string;
  message: string;
  code?: string;
  command?: string;
  responseCode?: number;
  response?: string;
  errors?: SafeEmailErrorDetails[];
}

export function safeEmailErrorDetails(error: unknown): SafeEmailErrorDetails {
  if (!(error instanceof Error)) return { message: String(error) };
  const details = error as Error & {
    code?: string;
    command?: string;
    responseCode?: number;
    response?: string;
    errors?: unknown[];
  };
  return {
    name: details.name,
    message: details.message,
    code: details.code,
    command: details.command,
    responseCode: details.responseCode,
    response: details.response ? details.response.slice(0, 500) : undefined,
    errors: Array.isArray(details.errors)
      ? details.errors.map((innerError) => safeEmailErrorDetails(innerError))
      : undefined,
  };
}

export async function verifyGmailSmtp() {
  if (!SMTP_USER || !SMTP_PASS) {
    return { ok: false, reason: "credentials_not_set" as const };
  }
  const transport = createTransport();
  try {
    await transport.verify();
    return { ok: true as const, user: SMTP_USER };
  } catch (error) {
    return { ok: false as const, user: SMTP_USER, error: safeEmailErrorDetails(error) };
  }
}

export async function sendContactConfirmation(opts: {
  name:    string;
  email:   string;
  subject: string;
}) {
  assertSmtpCredentials();
  const name = escapeHtml(opts.name);
  const subject = escapeHtml(opts.subject);
  const transport = createTransport();
  await transport.sendMail({
    from:    `"Image Partners" <${SMTP_USER}>`,
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
  assertSmtpCredentials();
  const name = escapeHtml(opts.name);
  const email = escapeHtml(opts.email);
  const subject = escapeHtml(opts.subject);
  const message = escapeHtml(opts.message);
  const phone = opts.phone ? escapeHtml(opts.phone) : null;
  const organization = opts.organization ? escapeHtml(opts.organization) : null;
  const transport = createTransport();
  // Reply-To 설정으로 수신 후 바로 답장 가능
  await transport.sendMail({
    from:    `"Image Partners" <${SMTP_USER}>`,
    to:      SMTP_USER,
    replyTo: `"${opts.name.replace(/"/g, "'")}" <${opts.email}>`,
    subject: `[문의] ${opts.subject} — ${opts.name}`,
    html: `
      <p><strong>이름:</strong> ${name}</p>
      <p><strong>이메일:</strong> <a href="mailto:${email}">${email}</a></p>
      ${phone ? `<p><strong>연락처:</strong> ${phone}</p>` : ""}
      ${organization ? `<p><strong>소속:</strong> ${organization}</p>` : ""}
      <p><strong>제목:</strong> ${subject}</p>
      <p><strong>내용:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${message}</pre>
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
  assertSmtpCredentials();
  const name = escapeHtml(opts.name || "고객");
  const subject = escapeHtml(opts.subject);
  const isResolved = opts.status === "resolved";
  const statusLabel = isResolved ? "답변 완료" : "검토 중";
  const destination = opts.inquiryType === "photo_request" ? "/dashboard/sourcing" : "/contact";
  const destinationUrl = buildSiteUrl(destination);
  const transport = createTransport();

  await transport.sendMail({
    from: `"Image Partners" <${SMTP_USER}>`,
    to: opts.email,
    subject: `[Image Partners] 문의 상태가 ${statusLabel}으로 변경되었습니다 — ${opts.subject}`,
    html: `
      <p>${name}님, 안녕하세요.</p>
      <p>문의 <strong>${subject}</strong>의 처리 상태가 <strong>${statusLabel}</strong>으로 변경되었습니다.</p>
      <p>${isResolved ? "답변 내용을 확인해 주세요." : "담당자가 내용을 확인하고 있습니다. 처리가 완료되면 다시 알려드리겠습니다."}</p>
      <p><a href="${destinationUrl}">Image Partners에서 확인하기 →</a></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}
