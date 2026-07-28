import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { parseLibraryAdCampaignInput } from "@/lib/ads/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const metricsSince = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const [campaignResult, eventResult] = await Promise.all([
    admin
      .from("library_ad_campaigns")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("user_events")
      .select("event_type, metadata")
      .in("event_type", ["ad_impression", "ad_click"])
      .gte("created_at", metricsSince)
      .limit(10_000),
  ]);

  if (campaignResult.error) {
    return NextResponse.json({ error: campaignResult.error.message }, { status: 500 });
  }

  const metrics = new Map<string, { impressions: number; clicks: number }>();
  for (const event of eventResult.data ?? []) {
    const metadata = event.metadata && typeof event.metadata === "object"
      ? event.metadata as Record<string, unknown>
      : null;
    const campaignId = typeof metadata?.campaignId === "string" ? metadata.campaignId : null;
    if (!campaignId) continue;
    const current = metrics.get(campaignId) ?? { impressions: 0, clicks: 0 };
    if (event.event_type === "ad_impression") current.impressions += 1;
    if (event.event_type === "ad_click") current.clicks += 1;
    metrics.set(campaignId, current);
  }

  return NextResponse.json({
    campaigns: (campaignResult.data ?? []).map((campaign) => {
      const result = metrics.get(campaign.id) ?? { impressions: 0, clicks: 0 };
      return {
        ...campaign,
        metrics: {
          ...result,
          ctr: result.impressions > 0
            ? Math.round((result.clicks / result.impressions) * 10_000) / 100
            : 0,
        },
      };
    }),
    metricsWindowDays: 90,
    metricsTruncated: (eventResult.data?.length ?? 0) >= 10_000,
  });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

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
  const { data, error } = await admin
    .from("library_ad_campaigns")
    .insert({
      ...input,
      created_by: adminUser.id,
      updated_by: adminUser.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "library_ad.created",
    targetType: "library_ad_campaign",
    targetId: data.id,
    targetLabel: data.name,
    after: data as Record<string, unknown>,
  });

  return NextResponse.json({ campaign: data }, { status: 201 });
}
