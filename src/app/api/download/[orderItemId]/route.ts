import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type DownloadRecord = {
  id: string;
  expires_at: string;
  download_count: number;
};

type DownloadImage = {
  storage_path_full: string | null;
  storage_path_original: string | null;
  original_filename: string | null;
  asset_id: string | null;
};

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

  const download = dl as DownloadRecord;

  if (new Date(download.expires_at) < new Date()) {
    return NextResponse.json({ error: "Download link expired" }, { status: 410 });
  }

  // Get the image storage path after buyer authorization above.
  const { data: item, error: itemError } = await supabase
    .from("order_items")
    .select("image:images!image_id(storage_path_full, storage_path_original, original_filename, asset_id)")
    .eq("id", orderItemId)
    .single();

  if (itemError || !item) {
    return NextResponse.json({ error: "Download not found" }, { status: 404 });
  }

  const imageData = Array.isArray(item.image) ? item.image[0] : item.image;
  const image = imageData as unknown as DownloadImage | null;
  const storagePath = image?.storage_path_full ?? image?.storage_path_original;
  if (!storagePath) {
    return NextResponse.json({ error: "File not available" }, { status: 404 });
  }

  // App-level checks above authorize the buyer. Service role bypasses storage RLS
  // for the private originals bucket when issuing the short-lived URL.
  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from("images-original")
    .createSignedUrl(storagePath, 60 * 60, {
      download: image?.original_filename ?? image?.asset_id ?? true,
    });

  if (signError || !signed) {
    return NextResponse.json({ error: "Could not generate download URL" }, { status: 500 });
  }

  // Increment download count
  await admin
    .from("downloads")
    .update({ download_count: download.download_count + 1 })
    .eq("id", download.id);

  return NextResponse.json({ url: signed.signedUrl, expiresAt: download.expires_at });
}
