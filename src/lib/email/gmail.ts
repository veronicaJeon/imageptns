import nodemailer from "nodemailer";
import { escapeHtml } from "./html";

// Set in Vercel env vars:
//   GMAIL_SMTP_USER = imgptns@gmail.com
//   GMAIL_SMTP_PASS = Gmail App Password (Google 계정 → 보안 → 2단계 인증 → 앱 비밀번호)
const SMTP_USER = process.env.GMAIL_SMTP_USER ?? "";
const SMTP_PASS = process.env.GMAIL_SMTP_PASS ?? "";

function createTransport() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendContactConfirmation(opts: {
  name:    string;
  email:   string;
  subject: string;
}) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[gmail-smtp] credentials not set — skipping confirmation email");
    return;
  }
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
}) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[gmail-smtp] credentials not set — skipping ops notification");
    return;
  }
  const name = escapeHtml(opts.name);
  const email = escapeHtml(opts.email);
  const subject = escapeHtml(opts.subject);
  const message = escapeHtml(opts.message);
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
      <p><strong>제목:</strong> ${subject}</p>
      <p><strong>내용:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${message}</pre>
    `,
  });
}
