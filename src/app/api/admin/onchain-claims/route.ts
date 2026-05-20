import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

function validReviewStatus(status: string) {
  return ["pending", "approved", "rejected", "reviewed", "all"].includes(status);
}

function validClaimStatus(status: string) {
  return ["claimable", "claimed", "all"].includes(status);
}

type OneOrMany<T> = T | T[] | null;

interface ClaimImage extends Record<string, unknown> {
  storage_path_preview: string | null;
}

interface ClaimOrderItem extends Record<string, unknown> {
  image: OneOrMany<ClaimImage>;
}

interface OnchainClaimRecord extends Record<string, unknown> {
  order_item: OneOrMany<ClaimOrderItem>;
}

interface ExistingClaimRecord {
  settlement_provider: string;
  claim_status: string;
}

function firstRecord<T>(record: OneOrMany<T>) {
  return Array.isArray(record) ? record[0] ?? null : record;
}

function withPreviewUrl(claim: OnchainClaimRecord) {
  const orderItem = firstRecord(claim.order_item);
  const image = firstRecord(orderItem?.image ?? null);

  return {
    ...claim,
    order_item: orderItem
      ? {
          ...orderItem,
          image: image
            ? {
                ...image,
                storage_path_preview: previewUrl(image.storage_path_preview),
              }
            : null,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const reviewStatus = req.nextUrl.searchParams.get("review_status") ?? "pending";
  const claimStatus = req.nextUrl.searchParams.get("claim_status") ?? "all";

  if (!validReviewStatus(reviewStatus)) {
    return NextResponse.json({ error: "Invalid review_status" }, { status: 400 });
  }
  if (!validClaimStatus(claimStatus)) {
    return NextResponse.json({ error: "Invalid claim_status" }, { status: 400 });
  }

  const admin = createAdminClient();
  let query = admin
    .from("earnings_ledger")
    .select(
      `
      id, gross_krw, commission_krw, net_krw, period, created_at,
      settlement_provider, claim_status, claim_tx_hash, claimable_amount,
      claim_review_status, claim_review_note, claim_reviewed_at,
      photographer:profiles!photographer_id(id, full_name),
      reviewer:profiles!claim_reviewed_by(id, full_name),
      order_item:order_items!order_item_id(
        id, license_code, price_krw,
        order:orders!order_id(id, order_number, status, total_krw, completed_at, created_at),
        image:images!image_id(id, asset_id, title, storage_path_preview)
      )
    `
    )
    .eq("settlement_provider", "onchain_escrow")
    .in("claim_status", ["claimable", "claimed"])
    .order("created_at", { ascending: false })
    .limit(200);

  if (reviewStatus !== "all") query = query.eq("claim_review_status", reviewStatus);
  if (claimStatus !== "all") query = query.eq("claim_status", claimStatus);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const claims = ((data ?? []) as unknown as OnchainClaimRecord[]).map(withPreviewUrl);

  return NextResponse.json({ claims });
}

type ReviewAction = "approve" | "reject" | "mark_reviewed";

interface ReviewBody {
  ledger_id?: string;
  action?: ReviewAction;
  note?: string;
}

const ACTION_TO_STATUS: Record<ReviewAction, "approved" | "rejected" | "reviewed"> = {
  approve: "approved",
  reject: "rejected",
  mark_reviewed: "reviewed",
};

export async function POST(req: NextRequest) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body: ReviewBody = await req.json();
  const { ledger_id, action } = body;
  const note = body.note?.trim() || null;

  if (!ledger_id || !action) {
    return NextResponse.json({ error: "ledger_id and action are required" }, { status: 400 });
  }
  if (!Object.prototype.hasOwnProperty.call(ACTION_TO_STATUS, action)) {
    return NextResponse.json(
      { error: "action must be 'approve', 'reject', or 'mark_reviewed'" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: existing, error: fetchError } = await admin
    .from("earnings_ledger")
    .select("id, settlement_provider, claim_status")
    .eq("id", ledger_id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Claim item not found" }, { status: 404 });
  }

  const existingClaim = existing as ExistingClaimRecord;
  if (
    existingClaim.settlement_provider !== "onchain_escrow" ||
    !["claimable", "claimed"].includes(existingClaim.claim_status)
  ) {
    return NextResponse.json(
      { error: "Only onchain claimable or claimed ledger items can be reviewed" },
      { status: 400 }
    );
  }

  const { data: claim, error: updateError } = await admin
    .from("earnings_ledger")
    .update({
      claim_review_status: ACTION_TO_STATUS[action],
      claim_review_note: note,
      claim_reviewed_by: user.id,
      claim_reviewed_at: new Date().toISOString(),
    })
    .eq("id", ledger_id)
    .select(
      `
      id, gross_krw, commission_krw, net_krw, period, created_at,
      settlement_provider, claim_status, claim_tx_hash, claimable_amount,
      claim_review_status, claim_review_note, claim_reviewed_at,
      photographer:profiles!photographer_id(id, full_name),
      reviewer:profiles!claim_reviewed_by(id, full_name),
      order_item:order_items!order_item_id(
        id, license_code, price_krw,
        order:orders!order_id(id, order_number, status, total_krw, completed_at, created_at),
        image:images!image_id(id, asset_id, title, storage_path_preview)
      )
    `
    )
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    claim: withPreviewUrl(claim as unknown as OnchainClaimRecord),
  });
}
