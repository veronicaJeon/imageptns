import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface RevenueRow {
  total_krw: number | null;
}

interface ClaimableLedgerRow {
  claimable_amount: number | string | null;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  return profile?.is_admin ? user : null;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  const [
    totalImages, pendingImages, approvedImages, rejectedImages,
    totalUsers, totalOrders, revenueRes, recentUsers,
    proofNotRegistered, proofPending, proofRegistered, proofFailed,
    basePendingOrders, baseConfirmedOrders, baseFailedOrders, onchainClaimableLedger,
  ] = await Promise.all([
    admin.from("images").select("id", { count: "exact", head: true }),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "approved"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("status", "rejected"),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "completed"),
    admin.from("orders").select("total_krw").eq("status", "completed"),
    admin.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }).limit(5),
    admin.from("images").select("id", { count: "exact", head: true }).eq("proof_status", "not_registered"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("proof_status", "pending"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("proof_status", "registered"),
    admin.from("images").select("id", { count: "exact", head: true }).eq("proof_status", "failed"),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("payment_provider", "base_usdc").eq("crypto_status", "pending"),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("payment_provider", "base_usdc").eq("crypto_status", "confirmed"),
    admin.from("orders").select("id", { count: "exact", head: true }).eq("payment_provider", "base_usdc").eq("crypto_status", "failed"),
    admin
      .from("earnings_ledger")
      .select("claimable_amount")
      .eq("settlement_provider", "onchain_escrow")
      .eq("claim_status", "claimable"),
  ]);

  const totalRevenue = ((revenueRes.data ?? []) as RevenueRow[]).reduce((s, o) => s + (o.total_krw ?? 0), 0);
  const claimableRows = (onchainClaimableLedger.data ?? []) as ClaimableLedgerRow[];
  const onchainClaimableUsdc = claimableRows.reduce(
    (sum, row) => sum + (Number(row.claimable_amount) || 0),
    0,
  );

  return NextResponse.json({
    images: {
      total:    totalImages.count ?? 0,
      pending:  pendingImages.count ?? 0,
      approved: approvedImages.count ?? 0,
      rejected: rejectedImages.count ?? 0,
    },
    users:   { total: totalUsers.count ?? 0 },
    orders:  { total: totalOrders.count ?? 0, revenue: totalRevenue },
    onchain: {
      proof: {
        notRegistered: proofNotRegistered.count ?? 0,
        pending: proofPending.count ?? 0,
        registered: proofRegistered.count ?? 0,
        failed: proofFailed.count ?? 0,
      },
      payments: {
        pending: basePendingOrders.count ?? 0,
        confirmed: baseConfirmedOrders.count ?? 0,
        failed: baseFailedOrders.count ?? 0,
      },
      claims: {
        claimableRows: claimableRows.length,
        claimableUsdc: onchainClaimableUsdc,
      },
    },
    recentUsers: recentUsers.data ?? [],
  });
}
