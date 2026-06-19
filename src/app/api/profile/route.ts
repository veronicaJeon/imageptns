import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { normalizePhoneNumber, normalizePrimaryActivityRegions } from "@/lib/profile/contact";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, organization, bio, avatar_url, role, roles, wallet_address, phone_number, primary_activity_regions, notif_sales, notif_reviews, notif_newsletter, created_at")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: { ...data, email: user.email } });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  if ("full_name" in body) allowed.full_name = body.full_name;
  if ("organization" in body) {
    const organization = typeof body.organization === "string" ? body.organization.trim().replace(/\s+/g, " ") : "";
    allowed.organization = organization || null;
  }
  if ("bio"       in body) allowed.bio       = body.bio;
  try {
    if ("phone_number" in body) allowed.phone_number = normalizePhoneNumber(body.phone_number);
    if ("primary_activity_regions" in body) {
      allowed.primary_activity_regions = normalizePrimaryActivityRegions(body.primary_activity_regions);
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid profile contact fields" },
      { status: 400 },
    );
  }
  if ("wallet_address" in body) {
    const rawWallet = typeof body.wallet_address === "string" ? body.wallet_address.trim() : "";
    if (rawWallet) {
      try {
        allowed.wallet_address = getAddress(rawWallet);
      } catch {
        return NextResponse.json({ error: "wallet_address must be a valid EVM address" }, { status: 400 });
      }
    } else {
      allowed.wallet_address = null;
    }
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update(allowed)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
