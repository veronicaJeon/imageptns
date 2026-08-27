import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("bank-transfer operations alert policy", () => {
  it("counts only bank-transfer orders that still need administrator confirmation", () => {
    const countsRoute = source("src/app/api/admin/support/counts/route.ts");

    expect(countsRoute).toContain('.from("orders")');
    expect(countsRoute).toContain('.eq("status", "pending")');
    expect(countsRoute).toContain('.eq("payment_provider", "bank_transfer")');
    expect(countsRoute).toContain('.eq("offline_payment_status", "requested")');
    expect(countsRoute).toContain("payment: paymentResult.count ?? 0");
  });

  it("creates and immediately dispatches the administrator email through the order outbox", () => {
    const migration = source("supabase/migrations/065_public_checkout_transaction_hardening.sql");
    const checkoutRoute = source("src/app/api/checkout/prepare/route.ts");
    const outbox = source("src/lib/orders/email-outbox.ts");

    expect(migration).toContain("bank_transfer_requested_ops");
    expect(checkoutRoute).toContain("dispatchOrderEmailsForOrder(order.id)");
    expect(outbox).toContain('eventType === "bank_transfer_requested_ops"');
    expect(outbox).toContain("notifyOpsBankTransferRequested(common)");
  });
});
