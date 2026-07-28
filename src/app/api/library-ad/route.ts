import { NextRequest, NextResponse } from "next/server";
import {
  localizeLibraryAdCampaign,
  type LibraryAdCampaignRow,
} from "@/lib/ads/campaigns";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang") === "en" ? "en" : "ko";
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("library_ad_campaigns")
    .select("*")
    .eq("placement", "right_rail")
    .eq("is_active", true)
    .lte("starts_at", now)
    .or(`ends_at.is.null,ends_at.gt.${now}`)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[library-ad] failed to load campaign", error.message);
    return NextResponse.json(
      { campaign: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      campaign: data
        ? localizeLibraryAdCampaign(data as LibraryAdCampaignRow, lang)
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
