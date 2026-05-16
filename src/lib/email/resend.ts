const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL    = "Image Partners <noreply@imagepartners.com>";
const OPS_EMAIL     = "contact@imagepartners.com";

interface EmailPayload {
  to:      string | string[];
  subject: string;
  html:    string;
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[resend] RESEND_API_KEY not set — email skipped");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization:  `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, ...payload }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error("[resend] send failed", err);
  }
}

export async function sendContactConfirmation(opts: {
  name:    string;
  email:   string;
  subject: string;
}) {
  await sendEmail({
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

export async function notifyOpsContact(opts: {
  name:    string;
  email:   string;
  subject: string;
  message: string;
}) {
  await sendEmail({
    to:      OPS_EMAIL,
    subject: `[문의] ${opts.subject} — ${opts.name}`,
    html: `
      <p><strong>이름:</strong> ${opts.name}</p>
      <p><strong>이메일:</strong> ${opts.email}</p>
      <p><strong>제목:</strong> ${opts.subject}</p>
      <p><strong>내용:</strong></p>
      <pre>${opts.message}</pre>
    `,
  });
}

export async function sendImageApproved(opts: {
  photographerEmail: string;
  photographerName:  string;
  imageTitle:        string;
  assetId:           string;
}) {
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 이미지가 승인되었습니다 — ${opts.imageTitle}`,
    html: `
      <p>${opts.photographerName}님, 안녕하세요.</p>
      <p>제출하신 이미지가 검토를 통과하여 라이브러리에 게시되었습니다.</p>
      <p><strong>이미지:</strong> ${opts.imageTitle}</p>
      <p><strong>에셋 ID:</strong> ${opts.assetId}</p>
      <p>구매자들이 이미지를 검색하고 라이선스를 구매할 수 있습니다.</p>
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
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 이미지 검토 결과 안내 — ${opts.imageTitle}`,
    html: `
      <p>${opts.photographerName}님, 안녕하세요.</p>
      <p>제출하신 이미지가 아래 사유로 승인되지 않았습니다.</p>
      <p><strong>이미지:</strong> ${opts.imageTitle}</p>
      <p><strong>에셋 ID:</strong> ${opts.assetId}</p>
      <p><strong>반려 사유:</strong> ${opts.reason}</p>
      <p>수정 후 다시 제출해 주시면 재검토 해드리겠습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}
