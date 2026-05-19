import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type PatchBody = Record<string, unknown>;

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function allowedPatch(body: PatchBody) {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.label !== undefined) patch.label = stringValue(body.label);
  if (body.rate !== undefined) {
    const rate = Number(body.rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error("rate must be between 0 and 1");
    patch.rate = Number(rate.toFixed(4));
  }
  if (body.active !== undefined) patch.active = Boolean(body.active);
  if (body.ends_at !== undefined) patch.ends_at = stringValue(body.ends_at) || null;
  if (body.starts_at !== undefined) patch.starts_at = stringValue(body.starts_at) || new Date().toISOString();
  return patch;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<unknown> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params as { id: string };
  let patch;
  try {
    patch = allowedPatch(await req.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid body" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("commission_policies")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const { data, error } = await admin
    .from("commission_policies")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "commission_policy.updated",
    targetType: "commission_policy",
    targetId: id,
    targetLabel: data.label,
    before,
    after: data,
  });

  return NextResponse.json({ policy: data });
}
