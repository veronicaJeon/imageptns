import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const { is_admin: nextIsAdmin } = await req.json() as { is_admin?: boolean };
  if (typeof nextIsAdmin !== "boolean") {
    return NextResponse.json({ error: "is_admin must be boolean" }, { status: 400 });
  }

  if (id === adminUser.id && !nextIsAdmin) {
    return NextResponse.json({ error: "자기 자신의 관리자 권한은 회수할 수 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("profiles")
    .select("id, full_name, role, is_admin")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  if (before.is_admin && !nextIsAdmin) {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "마지막 관리자 권한은 회수할 수 없습니다." }, { status: 409 });
    }
  }

  const { data: user, error } = await admin
    .from("profiles")
    .update({ is_admin: nextIsAdmin, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, full_name, role, is_admin, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: nextIsAdmin ? "admin.granted" : "admin.revoked",
    targetType: "user",
    targetId: id,
    targetLabel: user.full_name ?? id,
    before,
    after: user,
  });

  return NextResponse.json({ user });
}

