import { NextRequest, NextResponse } from "next/server";
import { canRequestRevision, revisionLimitNotice } from "@/lib/sourcing/status";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REASONS = new Set([
  "wrong_location",
  "wrong_season_or_time",
  "wrong_composition",
  "usage_terms_do_not_fit",
  "price_does_not_fit",
  "need_more_candidates",
  "other",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { reasons?: unknown; message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const reasons = Array.isArray(body?.reasons)
    ? body.reasons.filter((reason): reason is string => typeof reason === "string" && ALLOWED_REASONS.has(reason))
    : [];

  if (!message) return NextResponse.json({ error: "수정요청 내용을 입력해주세요." }, { status: 400 });
  if (reasons.length === 0) return NextResponse.json({ error: "수정요청 사유를 하나 이상 선택해주세요." }, { status: 400 });

  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
    .from("contact_submissions")
    .select("id, email, buyer_id, buyer_sourcing_status")
    .eq("id", id)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestRow || (requestRow.buyer_id !== user.id && requestRow.email !== user.email)) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (requestRow.buyer_sourcing_status !== "answer_ready") {
    return NextResponse.json({ error: "답변 공개 후 수정요청을 보낼 수 있습니다." }, { status: 409 });
  }

  const { count, error: countError } = await admin
    .from("sourcing_request_revisions")
    .select("id", { count: "exact", head: true })
    .eq("contact_submission_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  const revisionCount = count ?? 0;
  if (!canRequestRevision(revisionCount)) {
    return NextResponse.json({ error: revisionLimitNotice }, { status: 409 });
  }

  const { data, error } = await admin
    .from("sourcing_request_revisions")
    .insert({
      contact_submission_id: id,
      buyer_id: user.id,
      round: revisionCount + 1,
      reasons,
      message,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("contact_submissions")
    .update({
      buyer_sourcing_status: "under_review",
      internal_sourcing_status: "drafting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ revision: data }, { status: 201 });
}
