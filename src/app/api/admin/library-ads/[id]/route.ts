import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { parseLibraryAdCampaignInput } from "@/lib/ads/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();
  const { id } = await context.params;

  let input;
  try {
    input = parseLibraryAdCampaignInput(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "캠페인 입력값을 확인해주세요." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("library_ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await admin
    .from("library_ad_campaigns")
    .update({
      ...input,
      updated_by: adminUser.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "library_ad.updated",
    targetType: "library_ad_campaign",
    targetId: id,
    targetLabel: data.name,
    before: before as Record<string, unknown>,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json({ campaign: data });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();
  const { id } = await context.params;
  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("library_ad_campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
  if (!before) return NextResponse.json({ error: "캠페인을 찾을 수 없습니다." }, { status: 404 });

  const { error } = await admin.from("library_ad_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "library_ad.deleted",
    targetType: "library_ad_campaign",
    targetId: id,
    targetLabel: before.name,
    before: before as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
