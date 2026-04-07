import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only allow deleting own pending/rejected images
  const { data: img } = await supabase
    .from("images")
    .select("id, status, storage_path_original")
    .eq("id", id)
    .eq("photographer_id", user.id)
    .single();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!["pending", "rejected", "draft"].includes((img as any).status)) {
    return NextResponse.json({ error: "Cannot delete approved images" }, { status: 403 });
  }

  // Remove from storage if path exists
  if ((img as any).storage_path_original) {
    await supabase.storage.from("images-original").remove([(img as any).storage_path_original]);
  }

  const { error } = await supabase.from("images").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
