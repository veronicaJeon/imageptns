import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { getBusinessDisclosure } from "@/lib/legal/disclosure-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

const TEXT_LIMITS = {
  business_name: 120,
  representative_name: 120,
  business_registration_number: 40,
  address: 300,
  public_phone: 50,
  public_email: 254,
  ecommerce_registration_number: 80,
  ecommerce_registration_authority: 120,
  refund_policy: 10_000,
  receipt_policy: 10_000,
} as const;

const BOOLEAN_FIELDS = [
  "show_business_name",
  "show_representative_name",
  "show_business_registration_number",
  "show_address",
  "show_public_phone",
  "show_public_email",
  "show_ecommerce_registration",
  "is_published",
] as const;

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  try {
    return NextResponse.json({ disclosure: await getBusinessDisclosure() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load business disclosure" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  let parsed: unknown;
  try {
    parsed = await readBoundedJson(req, 32 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid disclosure request" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Invalid disclosure request" }, { status: 400 });
  }

  const payload = parsed as Record<string, unknown>;
  const update: Record<string, string | boolean | null> = {};
  for (const [field, maxLength] of Object.entries(TEXT_LIMITS)) {
    const value = payload[field];
    if (value == null || value === "") {
      update[field] = null;
      continue;
    }
    if (typeof value !== "string" || value.length > maxLength) {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
    update[field] = value.trim();
  }
  for (const field of BOOLEAN_FIELDS) {
    if (typeof payload[field] !== "boolean") {
      return NextResponse.json({ error: `Invalid ${field}` }, { status: 400 });
    }
    update[field] = payload[field];
  }

  if (!update.business_name || !update.address || !update.public_email || !update.refund_policy || !update.receipt_policy) {
    return NextResponse.json(
      { error: "상호, 주소, 공개 이메일, 환불 정책, 증빙 정책은 비워둘 수 없습니다." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(update.public_email))) {
    return NextResponse.json({ error: "공개 이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("business_disclosures")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("business_disclosures")
    .upsert({
      id: true,
      ...update,
      published_at: update.is_published ? now : null,
      updated_by: adminUser.id,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "business_disclosure.updated",
    targetType: "business_disclosure",
    targetId: "primary",
    targetLabel: "공시사항",
    before: before ?? null,
    after: data,
  });

  return NextResponse.json({ disclosure: data });
}
