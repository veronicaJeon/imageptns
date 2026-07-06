import { NextRequest, NextResponse } from "next/server";

import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { buildPhotographerApplicationReviewUpdate } from "@/lib/photographers/admin-review";
import {
  sendPhotographerApplicationApproved,
  sendPhotographerApplicationRejected,
} from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

interface PhotographerApplicationRow {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  bio: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ProfileSummaryRow {
  id: string;
  full_name: string | null;
  organization: string | null;
  photographer_status: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
}

function authUsersById(users: Array<{ id: string; email?: string }>) {
  return new Map(users.map((user) => [user.id, user]));
}

async function enrichApplications(
  admin: ReturnType<typeof createAdminClient>,
  applications: PhotographerApplicationRow[],
) {
  const profileIds = Array.from(new Set(applications.map((application) => application.profile_id)));
  if (profileIds.length === 0) return [];

  const [{ data: profileRows }, authResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, organization, photographer_status, phone_number, primary_activity_regions")
      .in("id", profileIds),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles = new Map((profileRows ?? []).map((profile) => [profile.id, profile as ProfileSummaryRow]));
  const auth = authUsersById(authResult.data.users ?? []);

  return applications.map((application) => ({
    ...application,
    profile: profiles.get(application.profile_id) ?? null,
    email: auth.get(application.profile_id)?.email ?? "",
  }));
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const admin = createAdminClient();
  let query = admin
    .from("photographer_applications")
    .select("id, profile_id, status, applicant_name, organization, phone_number, primary_activity_regions, bio, admin_note, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (status === "pending" || status === "approved" || status === "rejected") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const applications = await enrichApplications(admin, (data ?? []) as PhotographerApplicationRow[]);
  return NextResponse.json({ applications });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    id?: unknown;
    action?: unknown;
    rejection_reason?: unknown;
    admin_note?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: before, error: loadError } = await admin
    .from("photographer_applications")
    .select("id, profile_id, status, applicant_name, organization, phone_number, primary_activity_regions, bio, admin_note, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at")
    .eq("id", id)
    .single();

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 404 });
  if (before.status !== "pending") {
    return NextResponse.json({ error: "이미 검토가 완료된 신청입니다." }, { status: 409 });
  }

  let update;
  try {
    update = buildPhotographerApplicationReviewUpdate({
      action: body?.action,
      reviewerId: adminUser.id,
      reviewedAt: new Date().toISOString(),
      rejectionReason: body?.rejection_reason,
      adminNote: body?.admin_note,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "검토 정보를 확인해주세요." },
      { status: 400 },
    );
  }

  const { data: application, error: updateError } = await admin
    .from("photographer_applications")
    .update(update)
    .eq("id", id)
    .eq("status", "pending")
    .select("id, profile_id, status, applicant_name, organization, phone_number, primary_activity_regions, bio, admin_note, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!application) return NextResponse.json({ error: "이미 검토가 완료된 신청입니다." }, { status: 409 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: `photographer_application.${update.status}`,
    targetType: "photographer_application",
    targetId: application.id,
    targetLabel: application.applicant_name,
    before: before as Record<string, unknown>,
    after: application as Record<string, unknown>,
    reason: update.rejection_reason,
  });

  (async () => {
    const authResult = await admin.auth.admin.getUserById(application.profile_id);
    const email = authResult.data.user?.email;
    if (!email) return;

    if (update.status === "approved") {
      await sendPhotographerApplicationApproved({
        photographerEmail: email,
        photographerName: application.applicant_name,
      });
    } else {
      await sendPhotographerApplicationRejected({
        photographerEmail: email,
        photographerName: application.applicant_name,
        reason: update.rejection_reason ?? "운영 확인이 필요합니다.",
      });
    }
  })().catch((error) => console.error("[admin-photographer-applications] notify failed", error));

  const [enriched] = await enrichApplications(admin, [application as PhotographerApplicationRow]);
  return NextResponse.json({ application: enriched ?? application });
}
