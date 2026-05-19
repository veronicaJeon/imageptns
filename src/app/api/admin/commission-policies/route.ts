import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const SCOPES = new Set(["default", "license", "photographer", "image"]);
type PolicyRequestBody = Record<string, unknown>;

function normalizeRate(input: unknown) {
  const rate = Number(input);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error("rate must be between 0 and 1");
  }
  return Number(rate.toFixed(4));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function policyPayload(body: PolicyRequestBody, actorId: string) {
  const scope = stringValue(body.scope);
  if (!SCOPES.has(scope)) throw new Error("Invalid scope");

  return {
    scope,
    label: stringValue(body.label) || "수수료 정책",
    rate: normalizeRate(body.rate),
    active: typeof body.active === "boolean" ? body.active : true,
    license_code: scope === "license" ? stringValue(body.license_code) : null,
    photographer_id: scope === "photographer" ? stringValue(body.photographer_id) : null,
    image_id: scope === "image" ? stringValue(body.image_id) : null,
    starts_at: stringValue(body.starts_at) || new Date().toISOString(),
    ends_at: stringValue(body.ends_at) || null,
    created_by: actorId,
  };
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "active";
  const admin = createAdminClient();
  let query = admin
    .from("commission_policies")
    .select("*")
    .order("active", { ascending: false })
    .order("scope", { ascending: true })
    .order("starts_at", { ascending: false })
    .limit(200);

  if (status === "active") query = query.eq("active", true);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ policies: data ?? [] });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  let payload;
  try {
    payload = policyPayload(await req.json(), adminUser.id);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("commission_policies")
    .insert(payload)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "commission_policy.created",
    targetType: "commission_policy",
    targetId: data.id,
    targetLabel: data.label,
    after: data,
  });

  return NextResponse.json({ policy: data }, { status: 201 });
}
