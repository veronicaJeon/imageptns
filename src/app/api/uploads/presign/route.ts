import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { randomUUID } from "crypto";
import {
  ALLOWED_UPLOAD_IMAGE_TYPES,
  normalizeUploadFileSize,
  uploadSessionExpiresAt,
} from "@/lib/uploads/security";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const rate = await consumeDistributedRateLimit({
    scope: "upload-presign",
    identity: user.id,
    limit: 100,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.unavailable ? "Upload service temporarily unavailable" : "Too many upload requests" },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let payload: unknown;
  try {
    payload = await readBoundedJson(req, 4 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid upload request" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  }
  const { filename, contentType, fileSize } = payload as {
    filename?: string;
    contentType?: string;
    fileSize?: number;
  };
  const normalizedFilename = filename?.trim();
  const normalizedFileSize = normalizeUploadFileSize(fileSize);
  if (!normalizedFilename || normalizedFilename.length > 255 || !contentType || !normalizedFileSize) {
    return NextResponse.json({ error: "Valid filename, contentType, and fileSize required" }, { status: 400 });
  }
  if (!ALLOWED_UPLOAD_IMAGE_TYPES[contentType]) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  const ext = ALLOWED_UPLOAD_IMAGE_TYPES[contentType];
  const objectPath = `${user.id}/${randomUUID()}.${ext}`;
  const expiresAt = uploadSessionExpiresAt();

  // Upload the original file to images-original, then generate public previews separately.
  const { data, error } = await admin.storage
    .from("images-original")
    .createSignedUploadUrl(objectPath);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  const { data: uploadSession, error: sessionError } = await admin
    .from("upload_sessions")
    .insert({
      user_id: user.id,
      storage_path: objectPath,
      content_type: contentType,
      declared_size_bytes: normalizedFileSize,
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (sessionError || !uploadSession) {
    console.error("[uploads/presign] Failed to create upload session", sessionError);
    return NextResponse.json({ error: "Failed to create upload session" }, { status: 500 });
  }

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    storagePath: objectPath,
    uploadSessionId: uploadSession.id,
    token: data.token,
    expiresAt,
  });
}
