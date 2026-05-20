import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface PhotographerProfile {
  role: string | null;
}

function normalizeDecision(value: unknown) {
  return value === "interested" || value === "declined" ? value : null;
}

const MATCH_SELECT = `
  id, contact_submission_id, photographer_id, status, score, reason, created_at, updated_at,
  request:contact_submissions!contact_submission_id(
    id, subject, message, location_label, target_regions, category, tags,
    usage_intent, license_intent, budget_min_krw, budget_max_krw, deadline_at,
    reference_url, reference_note, request_status, created_at
  )
`;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if ((profile as PhotographerProfile | null)?.role !== "photographer") {
    return NextResponse.json({ error: "Photographer only" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("photo_request_matches")
    .select(MATCH_SELECT)
    .eq("photographer_id", user.id)
    .in("status", ["candidate", "invited", "interested", "declined"])
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const status = normalizeDecision(body?.status);
  if (!id || !status) {
    return NextResponse.json({ error: "id and interested/declined status are required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if ((profile as PhotographerProfile | null)?.role !== "photographer") {
    return NextResponse.json({ error: "Photographer only" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("photo_request_matches")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("photographer_id", user.id)
    .select(MATCH_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ match: data });
}
