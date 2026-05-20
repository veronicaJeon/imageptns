import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const WITHDRAWAL_STATUSES = ["pending", "approved", "rejected", "completed", "cancelled"] as const;
type WithdrawalStatus = (typeof WITHDRAWAL_STATUSES)[number];

function normalizeStatus(value: unknown): WithdrawalStatus | null {
  if (typeof value !== "string") return null;
  return WITHDRAWAL_STATUSES.includes(value as WithdrawalStatus) ? value as WithdrawalStatus : null;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const admin = createAdminClient();
  let query = admin
    .from("profile_withdrawal_requests")
    .select(`
      id, requester_id, target_profile_id, requester_role, status, impact_snapshot,
      admin_note, decided_by, decided_at, completed_at, created_at, updated_at,
      requester:profiles!profile_withdrawal_requests_requester_id_fkey(id, full_name),
      target:profiles!profile_withdrawal_requests_target_profile_id_fkey(
        id, full_name, role, avatar_url, wallet_address, phone_number, primary_activity_regions, deleted_at
      ),
      decider:profiles!profile_withdrawal_requests_decided_by_fkey(id, full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") {
    const normalized = normalizeStatus(status);
    if (!normalized) return NextResponse.json({ error: "status is not supported" }, { status: 400 });
    query = query.eq("status", normalized);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ requests: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    id?: unknown;
    status?: unknown;
    admin_note?: unknown;
  } | null;

  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const nextStatus = normalizeStatus(body?.status);
  if (!nextStatus || nextStatus === "pending") {
    return NextResponse.json({ error: "status is not supported" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("profile_withdrawal_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: now,
    admin_note: typeof body?.admin_note === "string" && body.admin_note.trim()
      ? body.admin_note.trim()
      : null,
  };

  if (nextStatus === "approved" || nextStatus === "rejected" || nextStatus === "cancelled") {
    patch.decided_by = adminUser.id;
    patch.decided_at = now;
  }
  if (nextStatus === "completed") {
    patch.completed_at = now;
  }

  const { data, error } = await admin
    .from("profile_withdrawal_requests")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "profile_withdrawal_request.updated",
    targetType: "profile_withdrawal_request",
    targetId: id,
    targetLabel: data.target_profile_id,
    before,
    after: data,
  });

  return NextResponse.json({ request: data });
}
