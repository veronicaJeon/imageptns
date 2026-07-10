import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { randomUUID } from "crypto";

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/tiff": "tif",
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const { filename, contentType } = await req.json() as { filename?: string; contentType?: string };
  if (!filename || !contentType) {
    return NextResponse.json({ error: "filename and contentType required" }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES[contentType]) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const ext = ALLOWED_IMAGE_TYPES[contentType];
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
