import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

type PaymentRequestAction = "approve" | "cancel";

interface PaymentRequestItem {
  image: {
    id: string;
    title: string | null;
    asset_id: string | null;
    storage_path_preview: string | null;
  } | { id: string; title: string | null; asset_id: string | null; storage_path_preview: string | null }[] | null;
}

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

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
      )
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

  const { orderId, action, note }: { orderId?: string; action?: PaymentRequestAction; note?: string } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  if (action !== "approve" && action !== "cancel") return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: order, error: loadError } = await admin
    .from("orders")
    .select("id, order_number, status, payment_provider, offline_payment_status")
    .eq("id", orderId)
    .single();

  if (loadError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.payment_provider !== "bank_transfer") return NextResponse.json({ error: "Not a bank-transfer order" }, { status: 400 });
  if (order.status !== "pending" || order.offline_payment_status !== "requested") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const patch = action === "approve"
    ? {
        status: "completed",
        completed_at: now,
        offline_payment_status: "approved",
        offline_payment_reviewed_at: now,
        offline_payment_reviewed_by: adminUser.id,
        offline_payment_note: note?.trim() || null,
      }
    : {
        status: "canceled",
        offline_payment_status: "canceled",
        offline_payment_reviewed_at: now,
        offline_payment_reviewed_by: adminUser.id,
        offline_payment_note: note?.trim() || null,
      };

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("offline_payment_status", "requested")
    .select("id, order_number, status, offline_payment_status")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "요청 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ order: updated });
}
