import "server-only";

import {
  notifyOpsBankTransferRequested,
  sendBankTransferRequested,
  sendBankTransferReviewed,
  sendFreeOrderConfirmed,
} from "@/lib/email/resend";
import { getBankTransferAccount } from "@/lib/payments/bank-transfer";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeOperationalMessage } from "@/lib/monitoring/events";

export const ORDER_EMAIL_EVENT_TYPES = [
  "free_order_confirmed_buyer",
  "bank_transfer_requested_buyer",
  "bank_transfer_requested_ops",
  "bank_transfer_approved_buyer",
  "bank_transfer_canceled_buyer",
] as const;

export type OrderEmailEventType = typeof ORDER_EMAIL_EVENT_TYPES[number];

interface OrderEmailRow {
  id: string;
  order_number: string;
  billing_name: string | null;
  billing_email: string | null;
  subtotal_krw: number;
  vat_krw: number;
  total_krw: number;
  offline_payment_note: string | null;
  order_items: Array<{
    price_krw: number;
    license_code: string;
    license_name_ko_snapshot: string | null;
    image_title_snapshot: string | null;
    image_asset_id_snapshot: string | null;
  }>;
}

function isOrderEmailEventType(value: string): value is OrderEmailEventType {
  return (ORDER_EMAIL_EVENT_TYPES as readonly string[]).includes(value);
}

async function deliver(eventType: OrderEmailEventType, order: OrderEmailRow) {
  if (!order.billing_email) throw new Error("Order billing email is missing");
  const common = {
    buyerEmail: order.billing_email,
    buyerName: order.billing_name || "고객",
    orderNumber: order.order_number,
    totalKrw: order.total_krw,
    items: order.order_items.map((item) => ({
      title: item.image_title_snapshot || "이미지",
      assetId: item.image_asset_id_snapshot,
      licenseName: item.license_name_ko_snapshot || item.license_code,
      priceKrw: item.price_krw,
    })),
  };

  if (eventType === "free_order_confirmed_buyer") {
    await sendFreeOrderConfirmed(common);
    return;
  }
  if (eventType === "bank_transfer_requested_buyer") {
    const account = getBankTransferAccount();
    await sendBankTransferRequested({
      ...common,
      subtotalKrw: order.subtotal_krw,
      vatKrw: order.vat_krw,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolder: account.accountHolder,
    });
    return;
  }
  if (eventType === "bank_transfer_requested_ops") {
    await notifyOpsBankTransferRequested(common);
    return;
  }
  await sendBankTransferReviewed({
    ...common,
    status: eventType === "bank_transfer_approved_buyer" ? "approved" : "canceled",
    note: order.offline_payment_note,
  });
}

export async function dispatchOrderEmailOutbox(outboxId: string) {
  const admin = createAdminClient();
  const { data: claimed, error: claimError } = await admin
    .from("order_email_outbox")
    .update({ status: "sending", updated_at: new Date().toISOString() })
    .eq("id", outboxId)
    .in("status", ["pending", "failed"])
    .select("id, order_id, event_type, attempt_count")
    .maybeSingle();

  if (claimError) return { ok: false as const, reason: claimError.message };
  if (!claimed) return { ok: true as const, skipped: true as const };
  if (!isOrderEmailEventType(claimed.event_type)) {
    return { ok: false as const, reason: "Unsupported order email event" };
  }

  try {
    const { data, error } = await admin
      .from("orders")
      .select(`
        id, order_number, billing_name, billing_email,
        subtotal_krw, vat_krw, total_krw, offline_payment_note,
        order_items(
          price_krw, license_code, license_name_ko_snapshot,
          image_title_snapshot, image_asset_id_snapshot
        )
      `)
      .eq("id", claimed.order_id)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Order email data is missing");

    await deliver(claimed.event_type, data as OrderEmailRow);
    await admin
      .from("order_email_outbox")
      .update({
        status: "sent",
        attempt_count: claimed.attempt_count + 1,
        last_error: null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    return { ok: true as const, skipped: false as const };
  } catch (error) {
    const message = sanitizeOperationalMessage(error) ?? "Order email delivery failed";
    await admin
      .from("order_email_outbox")
      .update({
        status: "failed",
        attempt_count: claimed.attempt_count + 1,
        last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", claimed.id);
    return { ok: false as const, reason: message };
  }
}

export async function dispatchOrderEmailsForOrder(orderId: string) {
  const admin = createAdminClient();
  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await admin
    .from("order_email_outbox")
    .update({ status: "failed", last_error: "Email delivery was interrupted", updated_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("status", "sending")
    .lt("updated_at", staleSendingBefore);
  const { data, error } = await admin
    .from("order_email_outbox")
    .select("id")
    .eq("order_id", orderId)
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true });
  if (error) return [{ ok: false as const, reason: error.message }];
  return Promise.all((data ?? []).map((row) => dispatchOrderEmailOutbox(row.id)));
}

export async function dispatchPendingOrderEmails(limit = 10) {
  const admin = createAdminClient();
  const staleSendingBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  await admin
    .from("order_email_outbox")
    .update({ status: "failed", last_error: "Email delivery was interrupted", updated_at: new Date().toISOString() })
    .eq("status", "sending")
    .lt("updated_at", staleSendingBefore);

  const { data, error } = await admin
    .from("order_email_outbox")
    .select("id")
    .in("status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 25)));
  if (error) return { processed: 0, succeeded: 0, failed: 1, error: error.message };
  const results = await Promise.all((data ?? []).map((row) => dispatchOrderEmailOutbox(row.id)));
  return {
    processed: results.length,
    succeeded: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
  };
}
