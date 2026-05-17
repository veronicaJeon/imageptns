import nodemailer from "nodemailer";

// Set in Vercel env vars:
//   NAVER_SMTP_USER = imagepartners@naver.com
//   NAVER_SMTP_PASS = (Naver account password or app password)
const SMTP_USER = process.env.NAVER_SMTP_USER ?? "";
const SMTP_PASS = process.env.NAVER_SMTP_PASS ?? "";

function createTransport() {
  return nodemailer.createTransport({
    host: "smtp.naver.com",
    port: 465,
    secure: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

export async function sendContactConfirmationViaNaverSmtp(opts: {
  name:    string;
  email:   string;
  subject: string;
}) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[naver-smtp] credentials not set — skipping confirmation email");
    return;
  }
  const transport = createTransport();
  await transport.sendMail({
    from:    `"Image Partners" <${SMTP_USER}>`,
    to:      opts.email,
    subject: `[Image Partners] 문의가 접수되었습니다 — ${opts.subject}`,
    html: `
      <p>${opts.name}님, 안녕하세요.</p>
      <p>문의해 주셔서 감사합니다. 빠른 시일 내에 답변 드리겠습니다.</p>
      <p>문의 제목: <strong>${opts.subject}</strong></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function notifyOpsContactViaNaverSmtp(opts: {
  name:    string;
  email:   string;
  subject: string;
  message: string;
}) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn("[naver-smtp] credentials not set — skipping ops notification");
    return;
  }
  const transport = createTransport();
  // Reply-To is set to the enquirer's email so the business can reply directly
  await transport.sendMail({
    from:    `"Image Partners" <${SMTP_USER}>`,
    to:      SMTP_USER,
    replyTo: `"${opts.name}" <${opts.email}>`,
    subject: `[문의] ${opts.subject} — ${opts.name}`,
    html: `
      <p><strong>이름:</strong> ${opts.name}</p>
      <p><strong>이메일:</strong> <a href="mailto:${opts.email}">${opts.email}</a></p>
      <p><strong>제목:</strong> ${opts.subject}</p>
      <p><strong>내용:</strong></p>
      <pre style="white-space:pre-wrap;font-family:inherit">${opts.message}</pre>
    `,
  });
}
