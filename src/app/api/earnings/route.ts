import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface EarningsLedgerRow {
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
  period: string;
  payout?: { status: string | null } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "photographer") {
    return NextResponse.json({ error: "Photographer only" }, { status: 403 });
  }

  const { data: ledger, error } = await supabase
    .from("earnings_ledger")
    .select(`
      id, gross_krw, commission_krw, net_krw, period, created_at,
      settlement_provider, claim_status, claim_tx_hash, claimable_amount,
      payout:payouts!payout_id(id, status, paid_at),
      order_item:order_items!order_item_id(
        license_code,
        image:images!image_id(title, asset_id, storage_path_preview)
      )
    `)
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by period
  const byPeriod: Record<string, { period: string; sales: number; gross: number; commission: number; net: number; paid: boolean }> = {};
  const ledgerRows = (ledger ?? []) as unknown as EarningsLedgerRow[];
  for (const r of ledgerRows) {
    if (!byPeriod[r.period]) {
      byPeriod[r.period] = { period: r.period, sales: 0, gross: 0, commission: 0, net: 0, paid: false };
    }
    byPeriod[r.period].sales      += 1;
    byPeriod[r.period].gross      += r.gross_krw;
    byPeriod[r.period].commission += r.commission_krw;
    byPeriod[r.period].net        += r.net_krw;
    if (r.payout?.status === "paid") byPeriod[r.period].paid = true;
  }

  const totalNet = ledgerRows.reduce((s, r) => s + r.net_krw, 0);
  const pendingNet = ledgerRows
    .filter((r) => !r.payout || r.payout.status !== "paid")
    .reduce((s, r) => s + r.net_krw, 0);

  return NextResponse.json({
    periods: Object.values(byPeriod).sort((a, b) => b.period.localeCompare(a.period)),
    totalNet,
    pendingNet,
    ledger: ledger ?? [],
  });
}
