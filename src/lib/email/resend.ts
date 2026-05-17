const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Override via env vars in Vercel dashboard; defaults kept for local dev reference
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Image Partners <onboarding@resend.dev>";
const OPS_EMAIL  = process.env.OPS_EMAIL ?? "imagepartners@naver.com";

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

export async function notifyOpsNewUpload(opts: {
  photographerEmail: string;
  photographerName:  string;
  imageTitle:        string;
  imageId:           string;
}) {
  await sendEmail({
    to:      OPS_EMAIL,
    subject: `[새 업로드] ${opts.imageTitle} — ${opts.photographerName}`,
    html: `
      <p>새 이미지가 심사 대기 중입니다.</p>
      <p><strong>제목:</strong> ${opts.imageTitle}</p>
      <p><strong>사진작가:</strong> ${opts.photographerName} (${opts.photographerEmail})</p>
      <p><strong>이미지 ID:</strong> ${opts.imageId}</p>
      <p><a href="https://imageptns.vercel.app/admin/images">관리자 페이지에서 검토하기 →</a></p>
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
      <p>이미지 바이어들이 이미지를 검색하고 라이선스를 구매할 수 있습니다.</p>
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
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 정산이 완료되었습니다 — ${opts.period}`,
    html: `
      <p>${opts.photographerName}님, 안녕하세요.</p>
      <p>${opts.period} 기간의 정산이 처리되어 지급되었습니다.</p>
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
  await sendEmail({
    to:      opts.photographerEmail,
    subject: `[Image Partners] 정산 처리 안내 — ${opts.period}`,
    html: `
      <p>${opts.photographerName}님, 안녕하세요.</p>
      <p>${opts.period} 기간의 정산 요청이 아래 사유로 처리되지 않았습니다.</p>
      <p><strong>신청 금액:</strong> ₩${opts.netKrw.toLocaleString("ko-KR")}</p>
      ${opts.note ? `<p><strong>사유:</strong> ${opts.note}</p>` : ""}
      <p>문의 사항은 ${OPS_EMAIL}으로 연락해 주세요.</p>
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
