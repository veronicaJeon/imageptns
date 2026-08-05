import { describe, expect, it } from "vitest";
import { buildOrderReceiptHtml } from "./order";

describe("buildOrderReceiptHtml", () => {
  it("escapes customer and item fields while rendering receipt essentials", () => {
    const html = buildOrderReceiptHtml({
      orderNumber: "IP-20260521-0001",
      completedAt: "2026-05-21T01:00:00.000Z",
      billingName: "<Buyer>",
      billingEmail: "buyer@example.com",
      paymentProvider: "base_usdc",
      paymentTxHash: "0xabc",
      contractOrderId: "0xorder",
      subtotalKrw: 10000,
      vatKrw: 0,
      totalKrw: 10000,
      items: [
        {
          title: "Morning <Peak>",
          assetId: "IMG-000001",
          license: "commercial",
          priceKrw: 10000,
          downloadExpiresAt: "2026-06-20T01:00:00.000Z",
        },
      ],
    });

    expect(html).toContain("이미지 구매 영수증");
    expect(html).toContain("IP-20260521-0001");
    expect(html).toContain("&lt;Buyer&gt;");
    expect(html).toContain("Morning &lt;Peak&gt;");
    expect(html).toContain("IMG-000001");
    expect(html).not.toContain("<Buyer>");
  });
});
