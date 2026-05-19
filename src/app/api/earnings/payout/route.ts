import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const MIN_PAYOUT_KRW = 50_000;

interface PayoutLedgerRow {
  id: string;
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { period } = await req.json();
  if (!period) return NextResponse.json({ error: "period required (YYYY-MM)" }, { status: 400 });

  // Check if payout already requested for this period
  const { data: existing } = await supabase
    .from("payouts")
    .select("id, status")
    .eq("photographer_id", user.id)
    .eq("period", period)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Payout already requested for this period" }, { status: 409 });
  }

  // Aggregate unpaid earnings for the period
  const { data: rowsData } = await supabase
    .from("earnings_ledger")
    .select("id, gross_krw, commission_krw, net_krw")
    .eq("photographer_id", user.id)
    .eq("period", period)
    .eq("settlement_provider", "offchain")
    .is("payout_id", null);

  const rows = (rowsData ?? []) as PayoutLedgerRow[];
  if (!rows.length) {
    return NextResponse.json({ error: "No earnings for this period" }, { status: 404 });
  }

  const totalGross      = rows.reduce((s, r) => s + r.gross_krw, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commission_krw, 0);
  const totalNet        = rows.reduce((s, r) => s + r.net_krw, 0);

  if (totalNet < MIN_PAYOUT_KRW) {
    return NextResponse.json(
      { error: `Minimum payout is ₩${MIN_PAYOUT_KRW.toLocaleString()}. Current: ₩${totalNet.toLocaleString()}` },
      { status: 400 }
    );
  }

  // Create payout record (admin client bypasses RLS — no insert policy exists for photographers)
  const admin = createAdminClient();
  const { data: payout, error: payoutError } = await admin
    .from("payouts")
    .insert({
      photographer_id:  user.id,
      period,
      total_gross_krw:  totalGross,
      total_commission: totalCommission,
      total_net_krw:    totalNet,
      status:           "pending",
      payout_method:    "bank_transfer",
    })
    .select()
    .single();

  if (payoutError) return NextResponse.json({ error: payoutError.message }, { status: 500 });

  // Link earnings rows to payout
  await admin
    .from("earnings_ledger")
    .update({ payout_id: payout.id })
    .eq("settlement_provider", "offchain")
    .in("id", rows.map((r) => r.id));

  return NextResponse.json({ payout }, { status: 201 });
}
