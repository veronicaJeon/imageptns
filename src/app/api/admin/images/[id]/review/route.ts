import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { detachImageFromAboutPage } from "@/lib/about/library-assets";
import { sendImageApproved, sendImageRejected } from "@/lib/email/resend";

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

interface ReviewImage {
  id: string;
  asset_id: string | null;
  title: string;
  photographer_id: string | null;
}

interface ReviewResponseImage {
  id: string;
  status: string;
  lifecycle_status?: string | null;
  is_published?: boolean;
  rejection_reason: string | null;
  approved_at: string | null;
  title: string;
  asset_id: string | null;
  photographer_id: string | null;
  proof_status?: string | null;
  proof_registered_at?: string | null;
  proof_tx_hash?: string | null;
}

const REVIEW_SELECT = "id, status, lifecycle_status, is_published, rejection_reason, approved_at, title, asset_id, photographer_id, proof_status, proof_registered_at, proof_tx_hash";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action, rejection_reason } = body as {
    action: "approve" | "reject";
    rejection_reason?: string;
  };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && !rejection_reason?.trim()) {
    return NextResponse.json({ error: "rejection_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let data: ReviewResponseImage;

  if (action === "approve") {
    const { data: loadedImage, error: loadError } = await admin
      .from("images")
      .select("id, asset_id, title, photographer_id")
      .eq("id", id)
      .single();

    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    const image = loadedImage as ReviewImage;
    if (!image.asset_id) return NextResponse.json({ error: "Image asset_id required" }, { status: 400 });
    if (!image.photographer_id) return NextResponse.json({ error: "Photographer required" }, { status: 400 });

    const approvedAt = new Date().toISOString();
    const { data: approved, error: approveError } = await admin
      .from("images")
      .update({
        status: "approved",
        is_published: true,
        unpublished_at: null,
        unpublished_by: null,
        unpublished_reason: null,
        approved_at: approvedAt,
        rejection_reason: null,
        rejected_at: null,
      })
      .eq("id", id)
      .eq("status", "pending")
      .eq("lifecycle_status", "active")
      .select(REVIEW_SELECT)
      .maybeSingle();

    if (approveError) {
      return NextResponse.json({ error: approveError.message }, { status: 500 });
    }
    if (!approved) {
      return NextResponse.json(
        { error: "Image is no longer pending" },
        { status: 409 }
      );
    }

    data = approved;
  } else {
    const rejectedAt = new Date().toISOString();
    const { data: rejected, error } = await admin
      .from("images")
      .update({
        status: "rejected",
        is_published: false,
        unpublished_at: rejectedAt,
        unpublished_by: user.id,
        unpublished_reason: "관리자 검토 반려",
        rejection_reason: rejection_reason!.trim(),
        rejected_at: rejectedAt,
        approved_at: null,
      })
      .eq("id", id)
      .in("status", ["pending", "approved"])
      .eq("lifecycle_status", "active")
      .select(REVIEW_SELECT)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!rejected) {
      return NextResponse.json(
        { error: "Image is no longer reviewable" },
        { status: 409 }
      );
    }
    data = rejected;
    await detachImageFromAboutPage(admin, id);
  }

  // Fire-and-forget notification — never block the response
  const photographerId = data.photographer_id;
  if (photographerId) {
    (async () => {
      const [profileRes, authRes] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", photographerId).single(),
        admin.auth.admin.getUserById(photographerId),
      ]);
      const email = authRes.data.user?.email;
      const name  = profileRes.data?.full_name ?? "사진작가";
      if (!email) return;
      const assetId = data.asset_id ?? data.id;

      if (action === "approve") {
        await sendImageApproved({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId });
      } else {
        await sendImageRejected({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId, reason: rejection_reason! });
      }
    })().catch(console.error);
  }

  return NextResponse.json({ image: data });
}
