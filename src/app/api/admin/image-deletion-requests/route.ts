import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { applyImageDeletion, type ImageDeletionRow } from "@/lib/images/deletion-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

interface DeletionRequestRow {
  id: string;
  image_id: string;
  requester_id: string | null;
  requester_role: "photographer" | "admin";
  reason_category: string;
  reason: string;
  status: string;
  estimated_fee_krw: number;
  charged_fee_krw: number;
  fee_status: string;
  impact_snapshot: Record<string, unknown>;
  admin_note: string | null;
  created_at: string;
  image: ImageDeletionRow | ImageDeletionRow[] | null;
  requester: { full_name: string | null; avatar_url: string | null } | { full_name: string | null; avatar_url: string | null }[] | null;
}

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function normalizeDecision(value: unknown) {
  return value === "approved" || value === "rejected" ? value : null;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const admin = createAdminClient();
  let query = admin
    .from("image_deletion_requests")
    .select(`
      id, image_id, requester_id, requester_role, reason_category, reason,
      status, estimated_fee_krw, charged_fee_krw, fee_status,
      impact_snapshot, admin_note, created_at,
      image:images!image_id(
        id, asset_id, title, status, lifecycle_status,
        storage_path_preview, storage_path_full, storage_path_original, original_filename,
        sales_count, proof_status, proof_tx_hash,
        proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id
      ),
      requester:profiles!requester_id(full_name, avatar_url)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requests = ((data ?? []) as DeletionRequestRow[]).map((request) => {
    const image = first(request.image);
    return {
      ...request,
      image: image ? { ...image, storage_path_preview: previewUrl(image.storage_path_preview) } : null,
      requester: first(request.requester),
    };
  });

  return NextResponse.json({ requests });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    id?: unknown;
    decision?: unknown;
    adminNote?: unknown;
    chargedFeeKrw?: unknown;
    waiveFee?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id : "";
  const decision = normalizeDecision(body?.decision);
  if (!id || !decision) {
    return NextResponse.json({ error: "id and decision are required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestData, error: requestError } = await admin
    .from("image_deletion_requests")
    .select(`
      id, image_id, requester_id, requester_role, reason_category, reason,
      status, estimated_fee_krw, charged_fee_krw, fee_status, impact_snapshot,
      image:images!image_id(
        id, asset_id, title, status, lifecycle_status,
        storage_path_preview, storage_path_full, storage_path_original, original_filename,
        sales_count, proof_status, proof_tx_hash,
        proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id
      )
    `)
    .eq("id", id)
    .single();

  if (requestError || !requestData) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const request = requestData as DeletionRequestRow;
  if (request.status !== "pending") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const adminNote = typeof body?.adminNote === "string" ? body.adminNote.trim() : "";

  if (decision === "rejected") {
    const { data, error } = await admin
      .from("image_deletion_requests")
      .update({
        status: "rejected",
        admin_note: adminNote || null,
        decided_by: adminUser.id,
        decided_at: now,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin
      .from("images")
      .update({
        lifecycle_status: "active",
        deletion_reviewed_by: adminUser.id,
        deletion_reviewed_at: now,
        deletion_admin_note: adminNote || null,
        updated_at: now,
      })
      .eq("id", request.image_id)
      .eq("lifecycle_status", "deletion_requested");

    await recordAdminAuditLog(admin, {
      actorId: adminUser.id,
      action: "image_deletion_request.rejected",
      targetType: "image_deletion_request",
      targetId: id,
      reason: adminNote || null,
      before: request as unknown as Record<string, unknown>,
      after: data,
    });

    return NextResponse.json({ request: data });
  }

  const image = first(request.image);
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const chargedFee = body?.waiveFee === true
    ? 0
    : Number.isFinite(Number(body?.chargedFeeKrw))
      ? Math.max(0, Math.round(Number(body?.chargedFeeKrw)))
      : request.estimated_fee_krw;

  const result = await applyImageDeletion(admin, image, {
    actorId: adminUser.id,
    requesterRole: request.requester_role,
    reason: request.reason,
    adminNote,
    chargedFeeKrw: chargedFee,
    feeStatus: chargedFee > 0 ? "pending" : "waived",
  });

  const { data, error } = await admin
    .from("image_deletion_requests")
    .update({
      status: "completed",
      charged_fee_krw: chargedFee,
      fee_status: chargedFee > 0 ? "pending" : "waived",
      admin_note: adminNote || null,
      decided_by: adminUser.id,
      decided_at: now,
      completed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: `image_deletion_request.${result.action}`,
    targetType: "image_deletion_request",
    targetId: id,
    targetLabel: image.asset_id ?? image.title,
    before: request as unknown as Record<string, unknown>,
    after: { request: data, result },
  });

  return NextResponse.json({ request: data, result });
}
