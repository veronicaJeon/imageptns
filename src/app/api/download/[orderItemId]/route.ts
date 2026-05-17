import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderItemId: string }> }
) {
  const { orderItemId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify download record exists and belongs to user
  const { data: dl, error: dlError } = await supabase
    .from("downloads")
    .select("id, expires_at, download_count, order_item_id")
    .eq("order_item_id", orderItemId)
    .eq("user_id", user.id)
    .single();

  if (dlError || !dl) {
    return NextResponse.json({ error: "Download not found" }, { status: 404 });
  }

  if (new Date((dl as any).expires_at) < new Date()) {
    return NextResponse.json({ error: "Download link expired" }, { status: 410 });
  }

  // Get the image storage path
  const { data: item } = await supabase
    .from("order_items")
    .select("image:images!image_id(storage_path_full, asset_id)")
    .eq("id", orderItemId)
    .single();

  const storagePath = (item?.image as any)?.storage_path_full;
  if (!storagePath) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  // Create signed URL (1 hour) — files live in images-original (MVP: no separate full-res bucket)
  const { data: signed, error: signError } = await supabase.storage
    .from("images-original")
    .createSignedUrl(storagePath, 60 * 60);

  if (signError || !signed) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  // Increment download count
  await supabase
    .from("downloads")
    .update({ download_count: (dl as any).download_count + 1 })
    .eq("id", (dl as any).id);

  return NextResponse.json({ url: signed.signedUrl, expiresAt: (dl as any).expires_at });
}
