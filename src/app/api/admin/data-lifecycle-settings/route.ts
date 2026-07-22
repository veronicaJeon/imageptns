import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  normalizeDataLifecycleSettings,
  normalizeDataLifecycleSettingsPatch,
  type DataLifecycleSettingsRow,
} from "@/lib/admin/data-lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

const SELECT_COLUMNS = `
  personal_data_retention_days,
  download_access_days,
  transaction_history_retention_days,
  inactive_account_retention_days,
  audit_log_retention_days,
  deletion_request_retention_days,
  rejected_image_retention_days,
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
    settings: normalizeDataLifecycleSettings(data as DataLifecycleSettingsRow | null),
  });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  let patch;
  try {
    patch = normalizeDataLifecycleSettingsPatch(body);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 });
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
    action: "data_lifecycle_settings.updated",
    targetType: "platform_commerce_settings",
    targetId: "singleton",
    targetLabel: "데이터 운영주기 정책",
    before: { settings: before ?? null },
    after: { settings: data },
  });

  return NextResponse.json({
    row: data,
    settings: normalizeDataLifecycleSettings(data as DataLifecycleSettingsRow),
  });
}
