import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, subtotal_krw, vat_krw, total_krw,
      status, billing_name, billing_email, completed_at, created_at,
      order_items(
        id, license_code, price_krw,
        image:images!image_id(id, title, category, asset_id, storage_path_preview, width, height,
          photographer:profiles!photographer_id(full_name))
      )
    `)
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}
