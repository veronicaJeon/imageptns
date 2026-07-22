"use client";

import { useState, useEffect, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";
import { useCart } from "@/lib/store/cart";

const ONCHAIN_ENABLED = process.env.NEXT_PUBLIC_ONCHAIN_ENABLED === "true";

type MetricTone = "primary" | "neutral" | "warning" | "danger" | "blue" | "green" | "red";

interface MetricItem {
  icon: string;
  label: string;
  value: string;
  href?: string;
  tone?: MetricTone;
}

const METRIC_TONE_STYLE: Record<MetricTone, string> = {
  primary: "text-primary",
  neutral: "text-on-surface-variant",
  warning: "text-amber-500 dark:text-amber-300",
  danger: "text-error",
  blue: "text-blue-500 dark:text-blue-300",
  green: "text-green-500 dark:text-green-300",
  red: "text-red-400 dark:text-red-200",
};

function MetricStrip({ items, className = "", gridClass = "sm:grid-cols-3" }: { items: MetricItem[]; className?: string; gridClass?: string }) {
  return (
    <div className={`rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 shadow-ghost ${className}`}>
      <div className={`grid gap-4 ${gridClass}`}>
        {items.map((item) => {
          const tone = METRIC_TONE_STYLE[item.tone ?? "neutral"];
          const content = (
            <>
              <span className={`material-symbols-outlined shrink-0 text-xl ${tone}`}>{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold uppercase tracking-widest text-outline">{item.label}</span>
                <span className="mt-0.5 block truncate font-headline text-xl font-extrabold text-on-surface">{item.value}</span>
              </span>
            </>
          );

          return item.href ? (
            <Link key={`${item.label}-${item.href}`} href={item.href} className="flex min-w-0 items-center gap-3 rounded-md px-1 py-2 transition-colors hover:text-primary">
              {content}
            </Link>
          ) : (
            <div key={item.label} className="flex min-w-0 items-center gap-3 rounded-md px-1 py-2">
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ACTION_STYLE: Record<string, string> = {
  Licensed:       "border-primary/20 bg-primary/10 text-primary",
  Approved:       "border-primary/20 bg-primary/10 text-primary",
  "Under Review": "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300",
  Rejected:       "border-error/20 bg-error/10 text-error",
  Draft:          "border-outline-variant/60 bg-surface-container-low text-outline",
  Favorited:      "border-red-200/70 bg-red-50 text-red-400 dark:border-red-400/20 dark:bg-red-900/20 dark:text-red-200",
  "Base Pending": "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300",
  "Base Confirmed": "border-blue-200/70 bg-blue-50 text-blue-500 dark:border-blue-400/20 dark:bg-blue-900/20 dark:text-blue-200",
  "Base Failed": "border-error/20 bg-error/10 text-error",
};

function ActivityBadge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex h-6 max-w-[8rem] items-center truncate rounded-full border px-2.5 text-[10px] font-bold leading-none sm:max-w-none ${className}`}>
      {children}
    </span>
  );
}

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

function RecentActivityList({
  items,
  emptyIcon,
  emptyText,
  fallbackStyle = "border-outline-variant/60 bg-surface-container-low text-on-surface-variant",
}: {
  items: RecentItem[];
  emptyIcon: string;
  emptyText: string;
  fallbackStyle?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-8 text-outline shadow-ghost">
        <span className="material-symbols-outlined text-4xl">{emptyIcon}</span>
        <p className="text-sm">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-ghost">
      {items.map((item, i) => (
        <div key={`${item.title}-${item.date}-${i}`} className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3 border-b border-outline-variant/20 px-4 py-3 last:border-b-0 sm:grid-cols-[60px_minmax(0,1fr)_120px_auto] sm:gap-4 sm:px-5">
          <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-container-low">
            {item.src ? (
              <Image src={item.src} alt={item.title} width={60} height={40} className="h-full w-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-sm text-outline">image</span>
            )}
          </div>
          <p className="min-w-0 truncate text-sm font-semibold text-on-surface">{item.title}</p>
          <p className="col-start-2 text-xs text-outline sm:col-start-auto sm:text-right">{item.date}</p>
          <div className="col-start-2 flex min-w-0 flex-wrap gap-1.5 sm:col-start-auto sm:justify-end">
            <ActivityBadge className={ACTION_STYLE[item.action] ?? fallbackStyle}>{item.action}</ActivityBadge>
            {item.proofStatus && item.proofStatus !== "not_registered" && (
              <ActivityBadge className="border-outline-variant/60 bg-surface-container-low text-on-surface-variant">
                credential {item.proofStatus}
              </ActivityBadge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
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
      available: number;
      requested: number;
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
  available: 0,
  requested: 0,
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
  const { t, lang } = useLang();
  const d = t.dashboard.overview;
  const copy = lang === "ko"
    ? {
        basePending: "확인 대기",
        baseConfirmed: "완료",
        baseFailed: "실패",
        basePendingTitle: "Base 결제 확인이 필요한 주문이 있습니다",
        basePendingBody: "구매 트랜잭션이 완료됐는데 화면 확인 단계에서 멈춘 주문은 주문 내역에서 tx 상태를 확인하세요.",
        viewOrders: "주문 내역 보기",
        baseWallet: "Base 지갑",
        walletReady: "등록됨",
        walletMissing: "미등록",
        proofRegistered: "증명 등록",
        proofProgress: "등록가능/진행",
        claimReady: "Claim 대기",
        walletRequiredBody: "Base 정산을 받으려면 지갑 주소를 등록해야 합니다.",
        credentialReadyBody: (count: number) => `첫 판매가 완료된 사진 ${count}개를 Arweave 등록 요청할 수 있습니다.`,
        proofAttentionBody: "증명 등록 실패 이미지가 있어 관리자 재처리가 필요할 수 있습니다.",
        claimReadyBody: (amount: string) => `${amount}를 Base에서 claim할 수 있습니다.`,
      }
    : {
        basePending: "Pending",
        baseConfirmed: "Confirmed",
        baseFailed: "Failed",
        basePendingTitle: "Some Base payments need confirmation",
        basePendingBody: "If a purchase transaction completed but the screen stopped during confirmation, check the tx status in your order history.",
        viewOrders: "View orders",
        baseWallet: "Base wallet",
        walletReady: "Connected",
        walletMissing: "Missing",
        proofRegistered: "Proof registered",
        proofProgress: "Ready / in progress",
        claimReady: "Claim ready",
        walletRequiredBody: "Add a wallet address to receive Base settlements.",
        credentialReadyBody: (count: number) => `${count} sold image${count === 1 ? "" : "s"} can be requested for Arweave registration.`,
        proofAttentionBody: "Some proof registrations failed and may need operations review.",
        claimReadyBody: (amount: string) => `${amount} is available to claim on Base.`,
      };
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
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8 lg:p-10">

      {/* ── Greeting ── */}
      <div className="mb-8">
        <h1 className="font-headline text-2xl md:text-3xl font-extrabold text-on-surface tracking-tight">
          {greeting}
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
          <MetricStrip
            className="mb-8"
            items={[
              { icon: "favorite", label: d.statFavorites, value: String(buyerStats?.favorites_count ?? 0), tone: "red", href: "/dashboard/favorites" },
              { icon: "receipt_long", label: d.statOrders, value: String(buyerStats?.orders_count ?? 0), tone: "blue", href: "/dashboard/orders" },
              { icon: "shopping_cart", label: d.statCart, value: String(cartCount), tone: "primary", href: "/cart" },
            ]}
          />

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Base USDC Payments</p>
          <MetricStrip
            className="mb-8"
            gridClass="sm:grid-cols-2 lg:grid-cols-4"
            items={[
              { icon: "pending_actions", label: copy.basePending, value: String(buyerOnchain.pending), tone: "warning", href: "/dashboard/orders" },
              { icon: "verified", label: copy.baseConfirmed, value: String(buyerOnchain.confirmed), tone: "blue", href: "/dashboard/orders" },
              { icon: "error", label: copy.baseFailed, value: String(buyerOnchain.failed), tone: "danger", href: "/dashboard/orders" },
            ]}
          />

          {buyerOnchain.pending > 0 && (
            <div className="mb-10 bg-surface-container-lowest border border-amber-300/40 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-500 text-xl mt-0.5">hourglass_top</span>
                <div>
                  <p className="text-sm font-bold text-on-surface">{copy.basePendingTitle}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{copy.basePendingBody}</p>
                </div>
              </div>
              <Link href="/dashboard/orders" className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70">{copy.viewOrders}</Link>
            </div>
          )}

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          <RecentActivityList items={stats?.recent ?? []} emptyIcon="receipt_long" emptyText="No recent activity" />

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
          <MetricStrip
            className="mb-8"
            items={[
              { icon: "cloud_upload", label: d.statUploads, value: String(photographerStats?.uploads_count ?? 0), tone: "primary", href: "/dashboard/uploads" },
              { icon: "payments", label: d.statEarnings, value: formatKRW(photographerStats?.earnings_total ?? 0), tone: "green", href: "/dashboard/earnings" },
              { icon: "pending", label: d.statPending, value: String(photographerStats?.pending_review_count ?? 0), tone: "warning", href: "/dashboard/uploads" },
            ]}
          />

          {ONCHAIN_ENABLED && <>
          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">Onchain Settlement</p>
          <MetricStrip
            className="mb-8"
            items={[
              {
                icon: photographerWalletReady ? "account_balance_wallet" : "wallet",
                label: copy.baseWallet,
                value: photographerWalletReady ? copy.walletReady : copy.walletMissing,
                tone: photographerWalletReady ? "blue" : "danger",
                href: "/dashboard/settings",
              },
              { icon: "verified", label: copy.proofRegistered, value: String(photographerProof.registered), tone: "primary", href: "/dashboard/blockchain" },
              { icon: "sync_problem", label: copy.proofProgress, value: `${photographerProof.available}/${photographerProof.requested + photographerProof.pending}`, tone: "warning", href: "/dashboard/blockchain" },
              { icon: "savings", label: copy.claimReady, value: formatUSDC(photographerClaims.claimableUsdc), tone: "green", href: "/dashboard/earnings" },
            ]}
          />

          {(!photographerWalletReady || photographerProof.available > 0 || photographerProof.failed > 0 || photographerClaims.claimableUsdc > 0) && (
            <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-3">
              {!photographerWalletReady && (
                <Link href="/dashboard/settings" className="bg-surface-container-lowest border border-error/20 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-error">Wallet Required</p>
                  <p className="text-sm text-on-surface-variant mt-2">{copy.walletRequiredBody}</p>
                </Link>
              )}
              {photographerProof.available > 0 && (
                <Link href="/dashboard/blockchain" className="bg-surface-container-lowest border border-primary/20 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Credential Ready</p>
                  <p className="text-sm text-on-surface-variant mt-2">{copy.credentialReadyBody(photographerProof.available)}</p>
                </Link>
              )}
              {photographerProof.failed > 0 && (
                <Link href="/dashboard/blockchain" className="bg-surface-container-lowest border border-amber-300/40 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Proof Attention</p>
                  <p className="text-sm text-on-surface-variant mt-2">{copy.proofAttentionBody}</p>
                </Link>
              )}
              {photographerClaims.claimableUsdc > 0 && (
                <Link href="/dashboard/earnings" className="bg-surface-container-lowest border border-primary/20 p-4 hover:bg-surface-container-low transition-colors">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary">Claim Ready</p>
                  <p className="text-sm text-on-surface-variant mt-2">{copy.claimReadyBody(formatUSDC(photographerClaims.claimableUsdc))}</p>
                </Link>
              )}
            </div>
          )}
          </>}

          <p className="text-xs text-outline uppercase tracking-widest font-bold mb-4">{d.recentTitle}</p>
          <RecentActivityList
            items={stats?.recent ?? []}
            emptyIcon="cloud_upload"
            emptyText="No uploads yet"
            fallbackStyle="border-amber-200/70 bg-amber-50 text-amber-500 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300"
          />

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
