import { NextResponse } from "next/server";
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface EarningsLedgerRow {
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
  period: string;
  settlement_provider: string;
  payout?: { status: string | null } | null;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response;

  const { data: ledger, error } = await supabase
    .from("earnings_ledger")
    .select(`
      id, gross_krw, commission_krw, net_krw, period, created_at,
      settlement_provider, claim_status, claim_tx_hash, claimable_amount, claim_review_status,
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
  const bankLedgerRows = ledgerRows.filter((row) => row.settlement_provider !== "onchain_escrow");
  for (const r of bankLedgerRows) {
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
  const pendingNet = bankLedgerRows
    .filter((r) => !r.payout || r.payout.status !== "paid")
    .reduce((s, r) => s + r.net_krw, 0);

  return NextResponse.json({
    periods: Object.values(byPeriod).sort((a, b) => b.period.localeCompare(a.period)),
    totalNet,
    pendingNet,
    ledger: ledger ?? [],
  });
}
