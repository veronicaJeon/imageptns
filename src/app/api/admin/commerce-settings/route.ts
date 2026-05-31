import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  normalizeCommerceSettings,
  normalizeCommerceSettingsPatch,
  type CommerceSettingsRow,
} from "@/lib/commerce/settings";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT_COLUMNS = `
  download_access_days,
  subscription_basic_downloads,
  subscription_pro_downloads,
  subscription_enterprise_downloads,
  arweave_self_funded_request_fee_krw,
  updated_at
`;

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_commerce_settings")
    .select(SELECT_COLUMNS)
    .eq("id", true)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    row: data,
    settings: normalizeCommerceSettings(data as CommerceSettingsRow | null),
  });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let patch;
  try {
    patch = normalizeCommerceSettingsPatch(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 });
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No editable fields supplied" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("platform_commerce_settings")
    .select(SELECT_COLUMNS)
    .eq("id", true)
    .maybeSingle();

  const { data, error } = await admin
    .from("platform_commerce_settings")
    .upsert({
      id: true,
      ...patch,
      updated_by: adminUser.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" })
    .select(SELECT_COLUMNS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "commerce_settings.updated",
    targetType: "platform_commerce_settings",
    targetId: "singleton",
    targetLabel: "상거래 운영 정책",
    before: { settings: before ?? null },
    after: { settings: data },
  });

  return NextResponse.json({
    row: data,
    settings: normalizeCommerceSettings(data as CommerceSettingsRow),
  });
}
