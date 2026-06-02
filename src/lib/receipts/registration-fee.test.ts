import { describe, expect, it } from "vitest";

import { buildRegistrationFeeReceiptHtml } from "./registration-fee";

describe("buildRegistrationFeeReceiptHtml", () => {
  const receipt = {
    orderNumber: "FEE-2026-0001",
    paidAt: "2026-05-31T09:00:00.000Z",
    billingName: "John <Doe>",
    billingEmail: "john@example.com",
    paymentProvider: "toss",
    paymentKey: "pay_key_123",
    unitFeeKrw: 10000,
    imageCount: 2,
    amountKrw: 20000,
    items: [
      { title: "Sunrise & \"Light\"", assetId: "IMG-000001", feeKrw: 10000 },
      { title: "Dusk", assetId: "IMG-000002", feeKrw: 10000 },
    ],
  };

  it("renders the fee total and per-image rows", () => {
    const html = buildRegistrationFeeReceiptHtml(receipt);
    expect(html).toContain("Arweave 셀프등록 수수료 영수증");
    expect(html).toContain("FEE-2026-0001");
    expect(html).toContain("₩20,000");
    expect(html).toContain("IMG-000001");
    expect(html).toContain("IMG-000002");
  });

  it("escapes untrusted html in titles and billing fields", () => {
    const html = buildRegistrationFeeReceiptHtml(receipt);
    expect(html).toContain("John &lt;Doe&gt;");
    expect(html).toContain("Sunrise &amp; &quot;Light&quot;");
    expect(html).not.toContain("<Doe>");
  });
});
