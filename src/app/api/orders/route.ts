import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

interface OrderImage {
  id: string;
  title: string | null;
  category: string | null;
  asset_id: string | null;
  storage_path_preview: string | null;
  lifecycle_status: string | null;
  deleted_at: string | null;
  width: number | null;
  height: number | null;
  photographer: { full_name: string | null } | { full_name: string | null }[] | null;
}

interface OrderItem {
  id: string;
  license_code: string;
  price_krw: number;
  image_title_snapshot: string | null;
  image_asset_id_snapshot: string | null;
  image_preview_path_snapshot: string | null;
  image_lifecycle_status: string | null;
  image_deleted_at: string | null;
  image_deletion_notice: string | null;
  image: OrderImage | OrderImage[] | null;
}

interface OrderRow {
  order_items: OrderItem[] | null;
}

function normalizeImage(image: OrderItem["image"]) {
  const row = Array.isArray(image) ? image[0] : image;
  return row ? { ...row, storage_path_preview: previewUrl(row.storage_path_preview) } : null;
}

function normalizeOrderItem(item: OrderItem) {
  const image = normalizeImage(item.image);
  const snapshotPreview = previewUrl(item.image_preview_path_snapshot);
  return {
    ...item,
    image: image
      ? {
        ...image,
        title: image.title ?? item.image_title_snapshot,
        asset_id: image.asset_id ?? item.image_asset_id_snapshot,
        storage_path_preview: image.storage_path_preview || snapshotPreview,
        lifecycle_status: item.image_lifecycle_status ?? image.lifecycle_status ?? "active",
        deleted_at: item.image_deleted_at ?? image.deleted_at,
      }
      : {
        id: "",
        title: item.image_title_snapshot,
        category: null,
        asset_id: item.image_asset_id_snapshot,
        storage_path_preview: snapshotPreview,
        lifecycle_status: item.image_lifecycle_status ?? "active",
        deleted_at: item.image_deleted_at,
        width: null,
        height: null,
        photographer: null,
      },
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, subtotal_krw, vat_krw, total_krw,
      status, billing_name, billing_email, completed_at, created_at,
      payment_provider, chain_id, payment_token, payment_tx_hash,
      contract_order_id, crypto_amount, crypto_decimals, crypto_status,
      buyer_wallet_address,
      order_items(
        id, license_code, price_krw,
        image_title_snapshot, image_asset_id_snapshot, image_preview_path_snapshot,
        image_lifecycle_status, image_deleted_at, image_deletion_notice,
        image:images!image_id(id, title, category, asset_id, storage_path_preview, lifecycle_status, deleted_at, width, height,
          photographer:profiles!photographer_id(full_name))
      )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = ((data ?? []) as OrderRow[]).map((order) => ({
    ...order,
    order_items: (order.order_items ?? []).map((item) => normalizeOrderItem(item)),
  }));

  return NextResponse.json({ orders });
}
