import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CART_ITEMS = 100;

export async function GET(req: NextRequest) {
  const requestedIds = Array.from(new Set(
    (req.nextUrl.searchParams.get("imageIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  )).slice(0, MAX_CART_ITEMS);

  if (requestedIds.length === 0) {
    return NextResponse.json({ purchasableIds: [], unavailableIds: [] });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .select("id")
    .in("id", requestedIds)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .eq("is_published", true);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const purchasableIds = (data ?? []).map((image) => image.id);
  const purchasableSet = new Set(purchasableIds);
  return NextResponse.json({
    purchasableIds,
    unavailableIds: requestedIds.filter((id) => !purchasableSet.has(id)),
  });
}
