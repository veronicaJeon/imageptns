import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, contentType } = await req.json();
  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }

  const ext = filename.split(".").pop() ?? "jpg";
  const objectPath = `${user.id}/${randomUUID()}.${ext}`;

  // Upload the original file to images-original, then generate public previews separately.
  const { data, error } = await supabase.storage
    .from("images-original")
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl:   data.signedUrl,
    storagePath: objectPath,
    token:       data.token,
  });
}
