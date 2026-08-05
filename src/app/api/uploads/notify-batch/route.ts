import { NextRequest, NextResponse } from "next/server";
import { notifyOpsUploadBatch } from "@/lib/email/resend";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const MAX_BATCH_NOTIFICATION_IMAGES = 100;

interface UploadNotificationImageRow {
  id: string;
  title: string | null;
  asset_id: string | null;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  let parsedBody: unknown;
  try {
    parsedBody = await readBoundedJson(req, 16 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid notification payload" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }

  const imageIds = Array.isArray((parsedBody as { imageIds?: unknown } | null)?.imageIds)
    ? ((parsedBody as { imageIds: unknown[] }).imageIds)
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_BATCH_NOTIFICATION_IMAGES)
    : [];
  const uniqueIds = Array.from(new Set(imageIds));
  if (uniqueIds.length === 0) {
    return NextResponse.json({ error: "imageIds required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("images")
    .select("id, title, asset_id")
    .eq("photographer_id", user.id)
    .in("id", uniqueIds);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as UploadNotificationImageRow[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, notified: 0 });
  }

  await notifyOpsUploadBatch({
    photographerEmail: user.email ?? "",
    photographerName: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Unknown",
    images: rows.map((image) => ({
      title: image.title ?? "Untitled image",
      imageId: image.id,
      assetId: image.asset_id,
    })),
  });

  return NextResponse.json({ ok: true, notified: rows.length });
}
