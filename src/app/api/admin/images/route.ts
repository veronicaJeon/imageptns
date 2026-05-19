import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

interface AdminImageListRow {
  storage_path_preview: string | null;
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const admin = createAdminClient();

  let query = admin
    .from("images")
    .select(`
      id, asset_id, title, description, category, tags,
      status, rejection_reason,
      chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at,
      storage_path_preview, storage_path_original,
      width, height, resolution_mp, file_format, file_size_mb,
      views_count, sales_count, created_at, approved_at,
      photographer:profiles!photographer_id(id, full_name, avatar_url, wallet_address)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const images = (data ?? []).map((img: AdminImageListRow) => ({
    ...img,
    storage_path_preview: previewUrl(img.storage_path_preview),
  }));

  return NextResponse.json({ images });
}
