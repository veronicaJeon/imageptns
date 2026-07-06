import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

interface ProfileRow {
  role: string | null;
  photographer_status: string | null;
  wallet_address: string | null;
}

interface RecentImage {
  title: string | null;
  storage_path_preview: string | null;
}

interface RecentOrderItem {
  image: RecentImage | RecentImage[] | null;
}

interface RecentOrder {
  created_at: string;
  payment_provider: string | null;
  crypto_status: string | null;
  payment_tx_hash: string | null;
  crypto_amount: number | string | null;
  order_items: RecentOrderItem[] | null;
}

interface RecentFavorite {
  created_at: string;
  image: RecentImage | RecentImage[] | null;
}

interface EarningRow {
  net_krw: number | null;
  settlement_provider: string | null;
  claim_status: string | null;
  claimable_amount: number | string | null;
}

interface RecentUpload {
  id: string;
  title: string | null;
  status: string;
  proof_status: string | null;
  storage_path_preview: string | null;
  created_at: string;
}

function joinedImage(image: RecentImage | RecentImage[] | null) {
  return Array.isArray(image) ? image[0] : image;
}

function actionForOrder(order: RecentOrder) {
  if (order.payment_provider !== "base_usdc") return "Licensed";
  if (order.crypto_status === "confirmed") return "Base Confirmed";
  if (order.crypto_status === "failed") return "Base Failed";
  return "Base Pending";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, photographer_status, wallet_address")
    .eq("id", user.id)
    .single();

  const profileRow = profile as ProfileRow | null;
  const role = profileRow?.photographer_status === "approved" ? "photographer" : "buyer";

  if (role === "buyer") {
    const [favRes, ordRes, basePendingRes, baseConfirmedRes, baseFailedRes] = await Promise.all([
      supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("status", "completed"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("payment_provider", "base_usdc").eq("crypto_status", "pending"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("payment_provider", "base_usdc").eq("crypto_status", "confirmed"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("payment_provider", "base_usdc").eq("crypto_status", "failed"),
    ]);

    const [recentOrders, recentFavs] = await Promise.all([
      supabase
        .from("orders")
        .select(`
          id, created_at, payment_provider, crypto_status, payment_tx_hash, crypto_amount,
          order_items(image:images!image_id(title, storage_path_preview))
        `)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("favorites")
        .select(`id, created_at, image:images!image_id(title, storage_path_preview)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const orderActivity = ((recentOrders.data ?? []) as unknown as RecentOrder[]).flatMap((o) =>
      (o.order_items ?? []).map((item) => {
        const image = joinedImage(item.image);
        return {
          title:  image?.title ?? "",
          action: actionForOrder(o),
          date:   new Date(o.created_at).getTime(),
          dateStr: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          src:    previewUrl(image?.storage_path_preview),
          paymentProvider: o.payment_provider,
          cryptoStatus: o.crypto_status,
          paymentTxHash: o.payment_tx_hash,
          cryptoAmount: o.crypto_amount,
        };
      })
    );
    const favActivity = ((recentFavs.data ?? []) as unknown as RecentFavorite[]).map((f) => {
      const image = joinedImage(f.image);
      return {
        title:  image?.title ?? "",
        action: "Favorited",
        date:   new Date(f.created_at).getTime(),
        dateStr: new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        src:    previewUrl(image?.storage_path_preview),
        paymentProvider: null,
        cryptoStatus: null,
        paymentTxHash: null,
        cryptoAmount: null,
      };
    });

    const recent = [...orderActivity, ...favActivity]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map((activity) => ({
        title: activity.title,
        action: activity.action,
        date: activity.dateStr,
        src: activity.src,
        paymentProvider: activity.paymentProvider,
        cryptoStatus: activity.cryptoStatus,
        paymentTxHash: activity.paymentTxHash,
        cryptoAmount: activity.cryptoAmount,
      }));

    return NextResponse.json({
      role,
      favorites_count: favRes.count ?? 0,
      orders_count:    ordRes.count ?? 0,
      onchain: {
        orders: {
          pending: basePendingRes.count ?? 0,
          confirmed: baseConfirmedRes.count ?? 0,
          failed: baseFailedRes.count ?? 0,
        },
      },
      recent,
    });
  }

  // Photographer
  const [
    uploadRes, pendingRes,
    proofNotRegisteredRes, proofAvailableRes, proofRequestedRes, proofPendingRes, proofRegisteredRes, proofFailedRes,
    earningsRes,
  ] = await Promise.all([
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("status", "pending"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "not_registered"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "available"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "requested"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "pending"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "registered"),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("proof_status", "failed"),
    supabase
      .from("earnings_ledger")
      .select("net_krw, settlement_provider, claim_status, claimable_amount")
      .eq("photographer_id", user.id),
  ]);

  const earningsRows = (earningsRes.data ?? []) as EarningRow[];
  const earningsTotal = earningsRows.reduce((s, r) => s + (r.net_krw ?? 0), 0);
  const onchainRows = earningsRows.filter((row) => row.settlement_provider === "onchain_escrow");
  const claimableRows = onchainRows.filter((row) => row.claim_status === "claimable");
  const claimedRows = onchainRows.filter((row) => row.claim_status === "claimed");
  const claimableUsdc = claimableRows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0);
  const claimedUsdc = claimedRows.reduce((sum, row) => sum + (Number(row.claimable_amount) || 0), 0);

  const { data: recentUploads } = await supabase
    .from("images")
    .select("id, title, status, proof_status, storage_path_preview, created_at")
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const statusLabel: Record<string, string> = {
    approved: "Approved",
    pending:  "Under Review",
    rejected: "Rejected",
    draft:    "Draft",
  };

  return NextResponse.json({
    role,
    uploads_count:       uploadRes.count ?? 0,
    earnings_total:      earningsTotal,
    pending_review_count: pendingRes.count ?? 0,
    wallet_address: profileRow?.wallet_address ?? null,
    onchain: {
      proof: {
        notRegistered: proofNotRegisteredRes.count ?? 0,
        available: proofAvailableRes.count ?? 0,
        requested: proofRequestedRes.count ?? 0,
        pending: proofPendingRes.count ?? 0,
        registered: proofRegisteredRes.count ?? 0,
        failed: proofFailedRes.count ?? 0,
      },
      claims: {
        claimableRows: claimableRows.length,
        claimedRows: claimedRows.length,
        claimableUsdc,
        claimedUsdc,
      },
      walletReady: Boolean(profileRow?.wallet_address),
    },
    recent: ((recentUploads ?? []) as RecentUpload[]).map((img) => ({
      id:     img.id,
      title:  img.title,
      action: statusLabel[img.status] ?? img.status,
      proofStatus: img.proof_status,
      date:   new Date(img.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      src:    previewUrl(img.storage_path_preview),
    })),
  });
}
