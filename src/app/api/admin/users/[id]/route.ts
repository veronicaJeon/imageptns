import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, authResult, { data: orders, error: ordersError }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, bio, role, avatar_url, wallet_address, is_admin, created_at, updated_at, last_login_at, login_count, deleted_at")
      .eq("id", id)
      .single(),
    admin.auth.admin.getUserById(id),
    admin
      .from("orders")
      .select(`
        id, order_number, status, subtotal_krw, vat_krw, total_krw,
        payment_provider, completed_at, created_at,
        order_items(
          id, license_code, price_krw,
          image:images!image_id(id, asset_id, title, storage_path_preview)
        )
      `)
      .eq("buyer_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 404 });
  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });
  if (ordersError) return NextResponse.json({ error: ordersError.message }, { status: 500 });

  return NextResponse.json({
    user: {
      ...profile,
      email: authResult.data.user?.email ?? "",
      authCreatedAt: authResult.data.user?.created_at ?? null,
      authLastSignInAt: authResult.data.user?.last_sign_in_at ?? null,
    },
    orders: orders ?? [],
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  if (id === adminUser.id) {
    return NextResponse.json({ error: "자기 자신의 관리자 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("id, full_name, is_admin, role")
    .eq("id", id)
    .single();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 404 });

  if (target.is_admin) {
    const { count, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("is_admin", true);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "마지막 관리자 계정은 삭제할 수 없습니다." }, { status: 409 });
    }
  }

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "user.deleted",
    targetType: "user",
    targetId: id,
    targetLabel: target.full_name ?? id,
    before: target,
  });

  const deletedAt = new Date().toISOString();
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: "탈퇴 회원",
      bio: null,
      avatar_url: null,
      wallet_address: null,
      is_admin: false,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    })
    .eq("id", id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: authError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: "876000h",
    user_metadata: { deleted_at: deletedAt },
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
