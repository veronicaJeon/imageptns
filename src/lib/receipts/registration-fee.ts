export interface RegistrationFeeReceiptItem {
  title: string;
  assetId: string;
  feeKrw: number;
}

export interface RegistrationFeeReceipt {
  orderNumber: string;
  paidAt: string | null;
  billingName: string | null;
  billingEmail: string | null;
  paymentProvider: string | null;
  paymentKey: string | null;
  unitFeeKrw: number;
  imageCount: number;
  amountKrw: number;
  items: RegistrationFeeReceiptItem[];
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatKrw(value: number) {
  return `₩${Number(value || 0).toLocaleString("ko-KR")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildRegistrationFeeReceiptHtml(receipt: RegistrationFeeReceipt) {
  const rows = receipt.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <strong>${escapeHtml(item.title || "Untitled")}</strong>
        <span>${escapeHtml(item.assetId || "-")}</span>
      </td>
      <td class="amount">${escapeHtml(formatKrw(item.feeKrw))}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Image Partners Arweave Fee Receipt ${escapeHtml(receipt.orderNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; color: #111; font-family: Arial, "Apple SD Gothic Neo", sans-serif; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111; padding-bottom: 18px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    .brand { font-weight: 900; font-size: 13px; text-transform: uppercase; }
    .meta { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px 28px; font-size: 12px; }
    .meta div { border-bottom: 1px solid #ddd; padding-bottom: 8px; }
    .label { display: block; color: #666; font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 12px; }
    th { text-align: left; font-size: 10px; color: #666; text-transform: uppercase; border-bottom: 1px solid #111; padding: 9px 8px; }
    td { border-bottom: 1px solid #ddd; padding: 10px 8px; vertical-align: top; }
    td span { display: block; margin-top: 3px; color: #666; font-size: 10px; }
    .amount { text-align: right; white-space: nowrap; }
    .totals { margin-left: auto; margin-top: 24px; width: 280px; font-size: 12px; }
    .totals div { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #ddd; }
    .totals .grand { font-weight: 900; font-size: 15px; border-bottom: 2px solid #111; }
    footer { margin-top: 36px; color: #666; font-size: 10px; line-height: 1.6; }
    @media print { body { padding: 18mm; } button { display: none; } }
  </style>
</head>
<body>
  <header>
    <div>
      <div class="brand">IMAGE PARTNERS</div>
      <h1>Arweave 셀프등록 수수료 영수증</h1>
    </div>
    <div>
      <span class="label">Receipt No.</span>
      <strong>${escapeHtml(receipt.orderNumber)}</strong>
    </div>
  </header>

  <section class="meta">
    <div><span class="label">사진작가</span>${escapeHtml(receipt.billingName || "-")}</div>
    <div><span class="label">이메일</span>${escapeHtml(receipt.billingEmail || "-")}</div>
    <div><span class="label">결제 확정일</span>${escapeHtml(formatDateTime(receipt.paidAt))}</div>
    <div><span class="label">결제수단</span>${escapeHtml(receipt.paymentProvider || "toss")}</div>
    <div><span class="label">건당 수수료</span>${escapeHtml(formatKrw(receipt.unitFeeKrw))}</div>
    <div><span class="label">결제 Key</span>${escapeHtml(receipt.paymentKey || "-")}</div>
  </section>

  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>이미지</th>
        <th class="amount">수수료</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <section class="totals">
    <div><span>대상 이미지</span><strong>${escapeHtml(receipt.imageCount)}건</strong></div>
    <div class="grand"><span>합계</span><strong>${escapeHtml(formatKrw(receipt.amountKrw))}</strong></div>
  </section>

  <footer>
    본 영수증은 Image Partners 플랫폼의 Arweave 셀프등록 수수료 결제 내역을 확인하기 위한 문서입니다.
    수수료는 판매 전 이미지의 Arweave 원본/메타데이터 등록 요청 처리를 위한 사진작가 부담 비용입니다.
  </footer>
</body>
</html>`;
}
