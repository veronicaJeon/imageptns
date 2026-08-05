export interface ReceiptOrderItem {
  title: string;
  assetId: string;
  license: string;
  priceKrw: number;
  subscriptionCovered?: boolean;
  downloadExpiresAt?: string | null;
}

export interface ReceiptOrder {
  orderNumber: string;
  completedAt: string | null;
  billingName: string | null;
  billingEmail: string | null;
  paymentProvider: string | null;
  paymentTxHash: string | null;
  contractOrderId: string | null;
  subtotalKrw: number;
  vatKrw: number;
  totalKrw: number;
  items: ReceiptOrderItem[];
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

export function buildOrderReceiptHtml(order: ReceiptOrder) {
  const rows = order.items.map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <strong>${escapeHtml(item.title || "Untitled")}</strong>
        <span>${escapeHtml(item.assetId || "-")}</span>
      </td>
      <td>${escapeHtml(item.license)}</td>
      <td>${item.subscriptionCovered ? "구독 무료다운 적용" : "일반 구매"}</td>
      <td>${escapeHtml(formatDateTime(item.downloadExpiresAt))}</td>
      <td class="amount">${escapeHtml(formatKrw(item.priceKrw))}</td>
    </tr>
  `).join("");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>Image Partners Receipt ${escapeHtml(order.orderNumber)}</title>
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
      <h1>이미지 구매 영수증</h1>
    </div>
    <div>
      <span class="label">Order No.</span>
      <strong>${escapeHtml(order.orderNumber)}</strong>
    </div>
  </header>

  <section class="meta">
    <div><span class="label">구매자</span>${escapeHtml(order.billingName || "-")}</div>
    <div><span class="label">이메일</span>${escapeHtml(order.billingEmail || "-")}</div>
    <div><span class="label">구매 확정일</span>${escapeHtml(formatDateTime(order.completedAt))}</div>
    <div><span class="label">결제수단</span>${escapeHtml(order.paymentProvider || "toss")}</div>
    <div><span class="label">온체인 주문키</span>${escapeHtml(order.contractOrderId || "-")}</div>
    <div><span class="label">결제 Tx</span>${escapeHtml(order.paymentTxHash || "-")}</div>
  </section>

  <table>
    <thead>
      <tr>
        <th>No</th>
        <th>이미지</th>
        <th>라이선스</th>
        <th>적용</th>
        <th>다운로드 만료</th>
        <th class="amount">금액</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <section class="totals">
    <div><span>소계</span><strong>${escapeHtml(formatKrw(order.subtotalKrw))}</strong></div>
    <div><span>VAT</span><strong>${escapeHtml(formatKrw(order.vatKrw))}</strong></div>
    <div class="grand"><span>합계</span><strong>${escapeHtml(formatKrw(order.totalKrw))}</strong></div>
  </section>

  <footer>
    본 영수증은 Image Partners 플랫폼의 이미지 라이선스 구매 내역을 확인하기 위한 문서입니다.
    실제 이용 범위는 구매 시점의 라이선스 조건과 서비스 약관을 기준으로 합니다.
  </footer>
</body>
</html>`;
}
