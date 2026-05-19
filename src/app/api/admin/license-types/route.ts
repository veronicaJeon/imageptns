import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { normalizeLicensePrice } from "@/lib/commerce/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("license_types")
    .select("*")
    .order("id", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ licenses: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json() as {
    code?: string;
    price_krw?: unknown;
    name_ko?: string;
    name_en?: string;
    description_ko?: string | null;
    description_en?: string | null;
  };

  const code = body.code?.trim();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  let priceKrw: number | undefined;
  if (body.price_krw !== undefined) {
    try {
      priceKrw = normalizeLicensePrice(body.price_krw);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid price_krw" }, { status: 400 });
    }
  }

  const patch: Record<string, unknown> = {};
  if (priceKrw !== undefined) patch.price_krw = priceKrw;
  if (body.name_ko !== undefined) patch.name_ko = body.name_ko.trim();
  if (body.name_en !== undefined) patch.name_en = body.name_en.trim();
  if (body.description_ko !== undefined) patch.description_ko = body.description_ko?.trim() || null;
  if (body.description_en !== undefined) patch.description_en = body.description_en?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("license_types")
    .select("*")
    .eq("code", code)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const { data, error } = await admin
    .from("license_types")
    .update(patch)
    .eq("code", code)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "license_type.updated",
    targetType: "license_type",
    targetId: code,
    targetLabel: data.name_ko ?? data.name_en ?? code,
    before,
    after: data,
  });

  return NextResponse.json({ license: data });
}
