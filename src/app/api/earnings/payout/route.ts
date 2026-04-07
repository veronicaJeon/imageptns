import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MIN_PAYOUT_KRW = 50_000;

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
  const { data: rows } = await supabase
    .from("earnings_ledger")
    .select("id, gross_krw, commission_krw, net_krw")
    .eq("photographer_id", user.id)
    .eq("period", period)
    .is("payout_id", null);

  if (!rows?.length) {
    return NextResponse.json({ error: "No earnings for this period" }, { status: 404 });
  }

  const totalGross      = rows.reduce((s, r: any) => s + r.gross_krw, 0);
  const totalCommission = rows.reduce((s, r: any) => s + r.commission_krw, 0);
  const totalNet        = rows.reduce((s, r: any) => s + r.net_krw, 0);

  if (totalNet < MIN_PAYOUT_KRW) {
    return NextResponse.json(
      { error: `Minimum payout is ₩${MIN_PAYOUT_KRW.toLocaleString()}. Current: ₩${totalNet.toLocaleString()}` },
      { status: 400 }
    );
  }

  // Create payout record
  const { data: payout, error: payoutError } = await supabase
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
  await supabase
    .from("earnings_ledger")
    .update({ payout_id: payout.id })
    .in("id", rows.map((r: any) => r.id));

  return NextResponse.json({ payout }, { status: 201 });
}
