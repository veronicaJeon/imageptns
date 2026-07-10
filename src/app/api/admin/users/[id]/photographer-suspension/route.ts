import { NextRequest, NextResponse } from "next/server";

import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { sendPhotographerAccessSuspended } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

function cleanReason(value: unknown) {
  if (typeof value !== "string") return null;
  const reason = value.trim().replace(/\s+/g, " ");
  return reason || null;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  if (id === adminUser.id) {
    return NextResponse.json({ error: "자기 자신의 사진가 권한은 회수할 수 없습니다." }, { status: 400 });
  }

  const body = await req.json().catch(() => null) as { reason?: unknown } | null;
  const reason = cleanReason(body?.reason);
  const admin = createAdminClient();

  const { data: before, error: loadError } = await admin
    .from("profiles")
    .select("id, full_name, role, roles, photographer_status")
    .eq("id", id)
    .single();

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 404 });
  if (before.photographer_status === "none") {
    return NextResponse.json({ error: "사진가 신청 이력이 없는 회원입니다." }, { status: 400 });
  }
  if (before.photographer_status === "suspended") {
    return NextResponse.json({ profile: before, duplicated: true });
  }

  const suspendedAt = new Date().toISOString();
  const { data: profile, error: updateError } = await admin
    .from("profiles")
    .update({
      photographer_status: "suspended",
      updated_at: suspendedAt,
    })
    .eq("id", id)
    .select("id, full_name, role, roles, photographer_status")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "photographer_access.suspended",
    targetType: "profile",
    targetId: id,
    targetLabel: profile.full_name ?? id,
    before: before as Record<string, unknown>,
    after: profile as Record<string, unknown>,
    reason,
    metadata: { suspendedAt },
  });

  (async () => {
    const authResult = await admin.auth.admin.getUserById(id);
    const email = authResult.data.user?.email;
    if (!email) return;
    await sendPhotographerAccessSuspended({
      photographerEmail: email,
      photographerName: profile.full_name ?? "사진작가",
      reason,
    });
  })().catch((error) => console.error("[admin-users] photographer suspension notify failed", error));

  return NextResponse.json({ profile });
}
