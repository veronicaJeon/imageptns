import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { dispatchOrderEmailsForOrder } from "@/lib/orders/email-outbox";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

type PaymentRequestAction = "approve" | "cancel" | "resend";

interface PaymentRequestItem {
  image: {
    id: string;
    title: string | null;
    asset_id: string | null;
    storage_path_preview: string | null;
  } | Array<{
    id: string;
    title: string | null;
    asset_id: string | null;
    storage_path_preview: string | null;
  }> | null;
}

export async function GET() {
  if (!await requireAdminUser()) return forbidden();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(`
      id, order_number, buyer_id, billing_name, billing_email, billing_company,
      subtotal_krw, vat_krw, total_krw, status, payment_provider,
      offline_payment_status, offline_payment_requested_at, offline_payment_reviewed_at,
      offline_payment_note, created_at, completed_at,
      buyer:profiles!buyer_id(id, full_name, avatar_url),
      order_items(
        id, license_code, price_krw,
        image:images!image_id(id, title, asset_id, storage_path_preview)
      ),
      order_email_outbox(event_type, status, attempt_count, last_error, sent_at, updated_at)
    `)
    .eq("payment_provider", "bank_transfer")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const requests = (data ?? []).map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item: PaymentRequestItem) => ({
      ...item,
      image: (() => {
        const image = Array.isArray(item.image) ? item.image[0] : item.image;
        return image ? { ...image, storage_path_preview: previewUrl(image.storage_path_preview) } : null;
      })(),
    })),
  }));
  return NextResponse.json({ requests });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  let parsed: unknown;
  try {
    parsed = await readBoundedJson(req, 8 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid payment request" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
  }
  const { orderId, action, note } = parsed as { orderId?: string; action?: PaymentRequestAction; note?: string };
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  if (action !== "approve" && action !== "cancel" && action !== "resend") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
  if (note != null && (typeof note !== "string" || note.length > 1_000)) {
    return NextResponse.json({ error: "Invalid note" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: loadError } = await admin
    .from("orders")
    .select("id, order_number, status, payment_provider, offline_payment_status, offline_payment_note")
    .eq("id", orderId)
    .maybeSingle();
  if (loadError || !before) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (before.payment_provider !== "bank_transfer") {
    return NextResponse.json({ error: "Not a bank-transfer order" }, { status: 400 });
  }

  if (action === "resend") {
    const emailResults = await dispatchOrderEmailsForOrder(orderId);
    return NextResponse.json({ emailResults, emailDeliveryPending: emailResults.some((result) => !result.ok) });
  }

  const { data, error } = await admin.rpc("review_bank_transfer_order", {
    p_order_id: orderId,
    p_action: action,
    p_note: note?.trim() || null,
    p_admin_id: adminUser.id,
  });
  if (error || !data) {
    const conflict = /already processed/i.test(error?.message ?? "");
    return NextResponse.json(
      { error: conflict ? "이미 처리된 요청입니다." : error?.message ?? "요청 처리에 실패했습니다." },
      { status: conflict ? 409 : 500 },
    );
  }

  const emailResults = await dispatchOrderEmailsForOrder(orderId);
  const emailDeliveryPending = emailResults.some((result) => !result.ok);
  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: action === "approve" ? "bank_transfer.approved" : "bank_transfer.canceled",
    targetType: "order",
    targetId: orderId,
    targetLabel: before.order_number,
    before,
    after: data,
  });
  return NextResponse.json({ order: data, emailResults, emailDeliveryPending });
}
