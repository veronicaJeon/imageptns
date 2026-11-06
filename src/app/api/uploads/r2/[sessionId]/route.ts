import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { uploadPathBelongsToUser } from "@/lib/uploads/security";
import {
  imageR2Bucket,
  r2ImageStorageRequested,
} from "@/lib/storage/image-storage-server";
import { imageStorageObjectKey } from "@/lib/storage/image-path";

export const maxDuration = 60;

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!r2ImageStorageRequested()) {
    return NextResponse.json({ error: "R2 image storage is not enabled" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const { sessionId } = await params;
  const { data: session, error } = await admin
    .from("upload_sessions")
    .select("id, user_id, storage_path, storage_provider, content_type, declared_size_bytes, status, expires_at")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .eq("storage_provider", "r2")
    .eq("status", "pending")
    .maybeSingle();

  if (error) {
    console.error("[uploads/r2] Failed to read upload session", error);
    return NextResponse.json({ error: "Failed to verify upload session" }, { status: 500 });
  }
  if (
    !session
    || new Date(session.expires_at) <= new Date()
    || !uploadPathBelongsToUser(session.storage_path, user.id)
  ) {
    return NextResponse.json({ error: "Upload session is invalid or expired" }, { status: 409 });
  }

  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  const contentLengthHeader = req.headers.get("content-length");
  const contentLength = contentLengthHeader == null ? null : Number(contentLengthHeader);
  const declaredSize = Number(session.declared_size_bytes);
  if (contentType !== session.content_type) {
    return NextResponse.json({ error: "Uploaded file type does not match the upload session" }, { status: 400 });
  }
  if (contentLength != null && (!Number.isFinite(contentLength) || contentLength !== declaredSize)) {
    return NextResponse.json({ error: "Uploaded file size does not match the upload session" }, { status: 400 });
  }
  const uploadBytes = await req.arrayBuffer();
  if (uploadBytes.byteLength === 0) {
    return NextResponse.json({ error: "Uploaded file is empty" }, { status: 400 });
  }
  if (uploadBytes.byteLength !== declaredSize) {
    return NextResponse.json({ error: "Uploaded file size does not match the upload session" }, { status: 400 });
  }

  const r2 = await imageR2Bucket();
  if (!r2) return NextResponse.json({ error: "Image storage temporarily unavailable" }, { status: 503 });

  const key = imageStorageObjectKey("images-original", session.storage_path);
  try {
    const object = await r2.put(key, uploadBytes, {
      httpMetadata: { contentType: session.content_type, cacheControl: "private, no-store" },
    });
    if (object.size !== declaredSize) {
      await r2.delete(key);
      return NextResponse.json({ error: "Uploaded file size does not match the upload session" }, { status: 400 });
    }
  } catch (uploadError) {
    console.error("[uploads/r2] R2 upload failed", uploadError instanceof Error ? uploadError.message : "unknown");
    return NextResponse.json({ error: "Failed to store uploaded file" }, { status: 503 });
  }

  return new NextResponse(null, { status: 204 });
}
