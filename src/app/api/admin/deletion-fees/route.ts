import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  DELETION_FEE_SETTING_CODES,
  normalizeDeletionFeeConfig,
  type DeletionFeeSettingRow,
} from "@/lib/images/deletion-fees";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_LABELS = {
  [DELETION_FEE_SETTING_CODES.simple]: "단순 삭제 요청 수수료",
  [DELETION_FEE_SETTING_CODES.complex]: "판매/온체인 이력 삭제 요청 수수료",
} as const;

type DeletionFeeCode = keyof typeof CODE_LABELS;
const ALLOWED_CODES = new Set<DeletionFeeCode>(Object.values(DELETION_FEE_SETTING_CODES));

function isDeletionFeeCode(value: string): value is DeletionFeeCode {
  return ALLOWED_CODES.has(value as DeletionFeeCode);
}

function normalizeAmount(value: unknown) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0 || amount > 10_000_000) {
    throw new Error("amount_krw must be an integer between 0 and 10000000");
  }
  return amount;
}

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_fee_settings")
    .select("code, label, amount_krw, active, updated_at")
    .in("code", Object.values(DELETION_FEE_SETTING_CODES))
    .order("code", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    settings: data ?? [],
    config: normalizeDeletionFeeConfig(data as DeletionFeeSettingRow[]),
  });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    settings?: Array<{ code?: unknown; amount_krw?: unknown; active?: unknown }>;
  } | null;

  const settings = body?.settings;
  if (!Array.isArray(settings) || settings.length === 0) {
    return NextResponse.json({ error: "settings array required" }, { status: 400 });
  }

  let rows;
  try {
    rows = settings.map((setting) => {
      const code = typeof setting.code === "string" ? setting.code : "";
      if (!isDeletionFeeCode(code)) throw new Error("Invalid fee setting code");
      return {
        code,
        label: CODE_LABELS[code],
        amount_krw: normalizeAmount(setting.amount_krw),
        active: typeof setting.active === "boolean" ? setting.active : true,
        updated_by: adminUser.id,
        updated_at: new Date().toISOString(),
      };
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("platform_fee_settings")
    .select("*")
    .in("code", rows.map((row) => row.code));

  const { data, error } = await admin
    .from("platform_fee_settings")
    .upsert(rows, { onConflict: "code" })
    .select("code, label, amount_krw, active, updated_at")
    .order("code", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "deletion_fee_settings.updated",
    targetType: "platform_fee_settings",
    targetId: "image_deletion_fees",
    targetLabel: "이미지 삭제 요청 수수료",
    before: { settings: before ?? [] },
    after: { settings: data ?? [] },
  });

  return NextResponse.json({
    settings: data ?? [],
    config: normalizeDeletionFeeConfig(data as DeletionFeeSettingRow[]),
  });
}
