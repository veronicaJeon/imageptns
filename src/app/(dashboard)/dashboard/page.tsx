"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { useCart } from "@/lib/store/cart";

function StatCard({ icon, label, value, color, href }: { icon: string; label: string; value: string; color: string; href?: string }) {
  const content = (
    <div className={`bg-surface-container-lowest p-6 shadow-ghost flex flex-col gap-3 ${href ? "hover:bg-surface-container-low transition-colors cursor-pointer" : ""}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

const ACTION_STYLE: Record<string, string> = {
  Licensed:       "bg-primary/10 text-primary",
  Approved:       "bg-primary/10 text-primary",
  "Under Review": "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300",
  Rejected:       "bg-error/10 text-error",
  Draft:          "bg-surface-container-high text-outline",
  Favorited:      "bg-red-50 text-red-400 dark:bg-red-900/20 dark:text-red-200",
  "Base Pending": "bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300",
  "Base Confirmed": "bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-200",
  "Base Failed": "bg-error/10 text-error",
};

interface RecentItem {
  title: string;
  action: string;
  date: string;
  src: string;
  paymentProvider?: string | null;
  cryptoStatus?: string | null;
  cryptoAmount?: number | string | null;
  proofStatus?: string | null;
}

interface BuyerDashboardStats {
  role: "buyer";
  favorites_count: number;
  orders_count: number;
  onchain: {
    orders: {
      pending: number;
      confirmed: number;
      failed: number;
    };
  };
  recent: RecentItem[];
}

interface PhotographerDashboardStats {
  role: "photographer";
  uploads_count: number;
  earnings_total: number;
  pending_review_count: number;
  wallet_address: string | null;
  onchain: {
    proof: {
      notRegistered: number;
      pending: number;
      registered: number;
      failed: number;
    };
    claims: {
      claimableRows: number;
      claimedRows: number;
      claimableUsdc: number;
      claimedUsdc: number;
    };
    walletReady: boolean;
  };
  recent: RecentItem[];
}

type DashboardStats = BuyerDashboardStats | PhotographerDashboardStats;

const EMPTY_BUYER_ONCHAIN = {
  pending: 0,
  confirmed: 0,
  failed: 0,
};

const EMPTY_PROOF = {
  notRegistered: 0,
  pending: 0,
  registered: 0,
  failed: 0,
};

const EMPTY_CLAIMS = {
  claimableRows: 0,
  claimedRows: 0,
  claimableUsdc: 0,
  claimedUsdc: 0,
};

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

function formatUSDC(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC`;
}

function isBuyerStats(stats: DashboardStats | null): stats is BuyerDashboardStats {
  return stats?.role === "buyer";
}

function isPhotographerStats(stats: DashboardStats | null): stats is PhotographerDashboardStats {
  return stats?.role === "photographer";
}

export default function DashboardPage() {
  const { t } = useLang();
  const d = t.dashboard.overview;
  const { user, init } = useAuth();
  const cartCount = useCart((s) => s.items.length);

  const [stats, setStats]   = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const role = stats?.role ?? user?.role ?? "buyer";
  const greeting = user?.full_name ? `${d.greeting}, ${user.full_name.split(" ")[0]}` : d.greeting;
  const buyerStats = isBuyerStats(stats) ? stats : null;
  const photographerStats = isPhotographerStats(stats) ? stats : null;
  const buyerOnchain = buyerStats?.onchain.orders ?? EMPTY_BUYER_ONCHAIN;
  const photographerProof = photographerStats?.onchain.proof ?? EMPTY_PROOF;
  const photographerClaims = photographerStats?.onchain.claims ?? EMPTY_CLAIMS;
  const photographerWalletReady = photographerStats?.onchain.walletReady ?? false;

  return (
    <div className="p-6 md:p-10 max-w-6xl">

      {/* ── Greeting ── */}
      <div className="mb-10">
        <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
          {greeting} 👋
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">Image Partners Dashboard</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : role === "buyer" ? (
        /* ── BUYER VIEW ── */
        <section>
          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Buyer Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <StatCard icon="favorite"      label={d.statFavorites} value={String(buyerStats?.favorites_count ?? 0)} color="bg-red-50 text-red-400 dark:bg-red-900/20"   href="/dashboard/favorites" />
            <StatCard icon="receipt_long"  label={d.statOrders}    value={String(buyerStats?.orders_count ?? 0)}    color="bg-blue-50 text-blue-400 dark:bg-blue-900/20" href="/dashboard/orders" />
            <StatCard icon="shopping_cart" label={d.statCart}      value={String(cartCount)}                    color="bg-primary/10 text-primary"                  href="/cart" />
          </div>

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Base USDC Payments</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <StatCard icon="pending_actions" label="확인 대기" value={String(buyerOnchain.pending)} color="bg-amber-50 text-amber-500 dark:bg-amber-900/20" href="/dashboard/orders" />
            <StatCard icon="verified" label="완료" value={String(buyerOnchain.confirmed)} color="bg-blue-50 text-blue-500 dark:bg-blue-900/20" href="/dashboard/orders" />
            <StatCard icon="error" label="실패" value={String(buyerOnchain.failed)} color="bg-error/10 text-error" href="/dashboard/orders" />
          </div>

          {buyerOnchain.pending > 0 && (
            <div className="mb-10 bg-surface-container-lowest border border-amber-300/40 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">hourglass_top</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">Base 결제 확인이 필요한 주문이 있습니다</p>
                  <p className="text-xs text-on-surface-variant mt-1">구매 트랜잭션이 완료됐는데 화면 확인 단계에서 멈춘 주문은 주문 내역에서 tx 상태를 확인하세요.</p>
                </div>
              </div>
              <Link href="/dashboard/orders" className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70">주문 내역 보기</Link>
            </div>
          )}

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          {(stats?.recent ?? []).length === 0 ? (
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col items-center gap-3 text-outline">
              <span className="material-symbols-outlined text-4xl">receipt_long</span>
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
              {(stats?.recent ?? []).map((item, i, arr) => (
                <div key={i} className={`flex items-center gap-4 px-6 py-4 ${i < arr.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
                  <div className="w-15 h-10 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 60, height: 40 }}>
                    {item.src ? (
                      <Image src={item.src} alt={item.title} width={60} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-sm">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
                    <p className="text-xs text-outline">{item.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${ACTION_STYLE[item.action] ?? "bg-surface-container-high text-on-surface-variant"}`}>
                    {item.action}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Link href="/library" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-base">photo_library</span>
              {d.browseBtn}
            </Link>
          </div>
        </section>
      ) : (
        /* ── PHOTOGRAPHER VIEW ── */
        <section>
          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Photographer Overview</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            <StatCard icon="cloud_upload" label={d.statUploads}  value={String(photographerStats?.uploads_count ?? 0)}              color="bg-primary/10 text-primary" href="/dashboard/uploads" />
            <StatCard icon="payments"     label={d.statEarnings} value={formatKRW(photographerStats?.earnings_total ?? 0)}          color="bg-green-50 text-green-500 dark:bg-green-900/20" href="/dashboard/earnings" />
            <StatCard icon="pending"      label={d.statPending}  value={String(photographerStats?.pending_review_count ?? 0)}       color="bg-amber-50 text-amber-400 dark:bg-amber-900/20" href="/dashboard/uploads" />
          </div>

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Onchain Settlement</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard
              icon={photographerWalletReady ? "account_balance_wallet" : "wallet"}
              label="Base 지갑"
              value={photographerWalletReady ? "등록됨" : "미등록"}
              color={photographerWalletReady ? "bg-blue-50 text-blue-500 dark:bg-blue-900/20" : "bg-error/10 text-error"}
              href="/dashboard/settings"
            />
            <StatCard icon="verified" label="증명 등록" value={String(photographerProof.registered)} color="bg-primary/10 text-primary" href="/dashboard/uploads" />
            <StatCard icon="sync_problem" label="증명 대기/실패" value={`${photographerProof.pending}/${photographerProof.failed}`} color="bg-amber-50 text-amber-500 dark:bg-amber-900/20" href="/dashboard/uploads" />
            <StatCard icon="savings" label="Claim 대기" value={formatUSDC(photographerClaims.claimableUsdc)} color="bg-green-50 text-green-500 dark:bg-green-900/20" href="/dashboard/earnings" />
          </div>

          {(!photographerWalletReady || photographerProof.failed > 0 || photographerClaims.claimableUsdc > 0) && (
            <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {!photographerWalletReady && (
                <Link href="/dashboard/settings" className="bg-surface-container-lowest border border-error/20 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-error">Wallet Required</p>
                  <p className="text-sm text-on-surface-variant mt-2">Base 정산을 받으려면 지갑 주소를 등록해야 합니다.</p>
                </Link>
              )}
              {photographerProof.failed > 0 && (
                <Link href="/dashboard/uploads" className="bg-surface-container-lowest border border-amber-300/40 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Proof Attention</p>
                  <p className="text-sm text-on-surface-variant mt-2">증명 등록 실패 이미지가 있어 관리자 재처리가 필요할 수 있습니다.</p>
                </Link>
              )}
              {photographerClaims.claimableUsdc > 0 && (
                <Link href="/dashboard/earnings" className="bg-surface-container-lowest border border-primary/20 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Claim Ready</p>
                  <p className="text-sm text-on-surface-variant mt-2">{formatUSDC(photographerClaims.claimableUsdc)}를 Base에서 claim할 수 있습니다.</p>
                </Link>
              )}
            </div>
          )}

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          {(stats?.recent ?? []).length === 0 ? (
            <div className="bg-surface-container-lowest shadow-ghost p-8 flex flex-col items-center gap-3 text-outline">
              <span className="material-symbols-outlined text-4xl">cloud_upload</span>
              <p className="text-sm">No uploads yet</p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest shadow-ghost overflow-hidden">
              {(stats?.recent ?? []).map((item, i, arr) => (
                <div key={i} className={`flex items-center gap-4 px-6 py-4 ${i < arr.length - 1 ? "border-b border-outline-variant/20" : ""}`}>
                  <div className="bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 60, height: 40 }}>
                    {item.src ? (
                      <Image src={item.src} alt={item.title} width={60} height={40} className="w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-outline text-sm">image</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{item.title}</p>
                    <p className="text-xs text-outline">{item.date}</p>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${ACTION_STYLE[item.action] ?? "bg-amber-50 text-amber-400"}`}>
                    {item.action}
                  </span>
                  {item.proofStatus && item.proofStatus !== "not_registered" && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
                      proof {item.proofStatus}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <Link href="/dashboard/uploads" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              {d.uploadBtn}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
