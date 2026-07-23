"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccount, connect, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { getAddress, type Address } from "viem";
import { useLang } from "@/lib/i18n/store";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { filterOnchainEarnings, sumClaimableUsdc, type OnchainClaimFilter } from "@/lib/onchain/earnings";
import { PhotographerApprovalGate } from "@/components/dashboard/PhotographerStatusNotice";

const earningsWagmiConfig = createConfig({
  chains: [base, baseSepolia],
  connectors: [injected()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

const earningsQueryClient = new QueryClient();

type BaseChainId = typeof base.id | typeof baseSepolia.id;

const CHIP_CLASS = "inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-bold leading-none";

interface PeriodEarnings {
  period: string;
  sales: number;
  gross: number;
  commission: number;
  net: number;
  paid: boolean;
}

interface LedgerEarning {
  id?: string;
  gross_krw?: number | null;
  commission_krw?: number | null;
  net_krw?: number | null;
  settlement_provider?: string | null;
  claim_status?: string | null;
  claim_review_status?: string | null;
  claimable_amount?: number | string | null;
  claim_tx_hash?: string | null;
  created_at?: string | null;
  order_item?: {
    license_code?: string | null;
    image?: { title?: string | null; asset_id?: string | null } | { title?: string | null; asset_id?: string | null }[] | null;
  } | {
    license_code?: string | null;
    image?: { title?: string | null; asset_id?: string | null } | { title?: string | null; asset_id?: string | null }[] | null;
  }[] | null;
}

interface EarningsResponse {
  periods: PeriodEarnings[];
  totalNet: number;
  pendingNet: number;
  ledger: LedgerEarning[];
}

function configuredBaseChainId(): BaseChainId {
  const chainId = Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID ?? baseSepolia.id);
  if (chainId === base.id || chainId === baseSepolia.id) return chainId;
  throw new Error("Unsupported Base network configuration.");
}

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

function formatUSDC(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC`;
}

function formatRate(gross?: number | null, commission?: number | null) {
  if (!gross || gross <= 0 || commission == null) return "정책 적용";
  return `${((commission / gross) * 100).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}%`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

function ledgerOrderItem(row: LedgerEarning) {
  return Array.isArray(row.order_item) ? row.order_item[0] : row.order_item;
}

function ledgerImage(row: LedgerEarning) {
  const image = ledgerOrderItem(row)?.image;
  return Array.isArray(image) ? image[0] : image;
}

interface SummaryMetric {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "primary" | "green" | "warning";
}

interface DetailMetric {
  label: string;
  value: string;
  note?: string;
}

const METRIC_TONE_CLASS: Record<NonNullable<SummaryMetric["tone"]>, string> = {
  primary: "text-primary",
  green: "text-green-500 dark:text-green-300",
  warning: "text-amber-500 dark:text-amber-300",
};

function SummaryMetricGrid({ items }: { items: SummaryMetric[] }) {
  return (
    <div className="mb-8 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-4 shadow-ghost">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex min-w-0 items-center gap-3">
            <span className={`material-symbols-outlined shrink-0 text-xl ${METRIC_TONE_CLASS[item.tone ?? "primary"]}`}>{item.icon}</span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold uppercase tracking-widest text-outline">{item.label}</p>
              <p className="mt-0.5 truncate font-headline text-xl font-extrabold text-on-surface">{item.value}</p>
              {item.sub && <p className="mt-0.5 truncate text-xs text-on-surface-variant">{item.sub}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailMetricList({ items }: { items: DetailMetric[] }) {
  return (
    <div className="mb-8 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-ghost">
      {items.map((item) => (
        <div key={item.label} className="grid gap-1 border-b border-outline-variant/20 px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold uppercase tracking-widest text-outline">{item.label}</p>
            {item.note && <p className="mt-1 text-xs text-on-surface-variant">{item.note}</p>}
          </div>
          <p className="font-headline text-lg font-extrabold text-on-surface sm:text-right">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <PhotographerApprovalGate>
      <WagmiProvider config={earningsWagmiConfig}>
        <QueryClientProvider client={earningsQueryClient}>
          <EarningsInner />
        </QueryClientProvider>
      </WagmiProvider>
    </PhotographerApprovalGate>
  );
}

function EarningsInner() {
  const { t } = useLang();
  const e = t.dashboard.earnings;

  const [data, setData]       = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [payoutPeriod, setPayoutPeriod] = useState<string | null>(null);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [claimingOnchain, setClaimingOnchain] = useState(false);
  const [claimFilter, setClaimFilter] = useState<OnchainClaimFilter>("claimable");

  useEffect(() => {
    fetch("/api/earnings")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  async function requestPayout(period: string) {
    setPayoutLoading(true);
    setPayoutPeriod(period);
    try {
      const res = await fetch("/api/earnings/payout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error); return; }
      // Refresh data
      const fresh = await fetch("/api/earnings").then((r) => r.json());
      setData(fresh);
    } finally {
      setPayoutLoading(false);
      setPayoutPeriod(null);
    }
  }

  async function refreshEarnings() {
    const fresh = await fetch("/api/earnings").then((r) => r.json());
    setData(fresh);
  }

  async function readApiError(response: Response, fallback: string) {
    try {
      const body = await response.json();
      return typeof body?.error === "string" ? body.error : fallback;
    } catch {
      return fallback;
    }
  }

  function currentWalletOrThrow(expectedWalletAddress: Address) {
    const currentAddress = getAccount(earningsWagmiConfig).address;
    if (!currentAddress) throw new Error("Wallet connection was interrupted. Please connect again.");
    if (getAddress(currentAddress) !== expectedWalletAddress) {
      throw new Error("Wallet account changed during claim. Please retry with the same wallet.");
    }
    return getAddress(currentAddress);
  }

  async function claimOnchainUsdc() {
    setClaimingOnchain(true);
    try {
      if (typeof window === "undefined" || !("ethereum" in window)) {
        throw new Error("No browser wallet found. Please install MetaMask or a Base-compatible wallet.");
      }

      const connector = earningsWagmiConfig.connectors[0];
      if (!connector) throw new Error("No wallet connector is available.");

      let account = getAccount(earningsWagmiConfig);
      if (!account.address) {
        await connect(earningsWagmiConfig, { connector });
        account = getAccount(earningsWagmiConfig);
      }

      if (!account.address) throw new Error("Please finish connecting your wallet.");
      const walletAddress = getAddress(account.address);
      const targetChainId = configuredBaseChainId();

      if (account.chainId !== targetChainId) {
        await switchChain(earningsWagmiConfig, { chainId: targetChainId });
      }

      const escrowAddress = process.env.NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS;
      if (!escrowAddress) throw new Error("Escrow contract is not configured.");

      const claimAccount = currentWalletOrThrow(walletAddress);
      const claimHash = await writeContract(earningsWagmiConfig, {
        address: getAddress(escrowAddress),
        abi: IMAGE_PARTNERS_ESCROW_ABI,
        functionName: "claim",
        args: [],
        account: claimAccount,
        chainId: targetChainId,
      });

      const claimReceipt = await waitForTransactionReceipt(earningsWagmiConfig, {
        hash: claimHash,
        chainId: targetChainId,
      });
      if (claimReceipt.status !== "success") {
        throw new Error("USDC claim transaction failed. Please check your wallet and try again.");
      }

      currentWalletOrThrow(walletAddress);

      const res = await fetch("/api/onchain/claim/confirm", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          txHash: claimReceipt.transactionHash,
          walletAddress,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "USDC claim confirmation failed"));

      await refreshEarnings();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "USDC claim failed.");
    } finally {
      setClaimingOnchain(false);
    }
  }

  const periods         = data?.periods ?? [];
  const totalNet        = data?.totalNet   ?? 0;
  const pendingNet      = data?.pendingNet ?? 0;
  const currentPeriod   = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const currentPeriodData = periods[0];
  const ledger = data?.ledger ?? [];
  const onchainRows = filterOnchainEarnings(ledger, "all");
  const filteredOnchainRows = filterOnchainEarnings(ledger, claimFilter);
  const onchainClaimableRows = filterOnchainEarnings(ledger, "claimable");
  const approvedOnchainClaimableRows = onchainClaimableRows.filter((row) => row.claim_review_status === "approved");
  const onchainClaimable = sumClaimableUsdc(onchainClaimableRows);
  const approvedOnchainClaimable = sumClaimableUsdc(approvedOnchainClaimableRows);
  const hasPendingClaimReview = onchainClaimableRows.some((row) => row.claim_review_status !== "approved");
  const totalGross = ledger.reduce((sum, row) => sum + (row.gross_krw ?? 0), 0);
  const totalCommission = ledger.reduce((sum, row) => sum + (row.commission_krw ?? 0), 0);

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const maxNet = Math.max(...periods.map((p) => p.net), 1);
  const chartData = [...periods].reverse().slice(-5);

  return (
    <div className="mx-auto w-full max-w-6xl p-4 md:p-8 lg:p-10">
      <div className="flex items-center justify-between gap-3 mb-6 md:mb-8">
        <h1 className="font-headline text-xl font-extrabold text-on-surface tracking-tight md:text-2xl">{e.title}</h1>
        {currentPeriodData && !currentPeriodData.paid && (
          <button
            onClick={() => requestPayout(currentPeriodData.period)}
            disabled={payoutLoading}
            className="flex shrink-0 items-center gap-1.5 rounded bg-primary px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50 md:gap-2 md:px-5 md:py-3 md:text-xs"
          >
            <span className="material-symbols-outlined text-base">payments</span>
            {e.payoutBtn}
          </button>
        )}
      </div>

      <SummaryMetricGrid
        items={[
          { icon: "account_balance_wallet", label: e.statTotal, value: formatKRW(totalNet), sub: "All time", tone: "primary" },
          { icon: "trending_up", label: e.statMonth, value: formatKRW(currentPeriodData?.net ?? 0), sub: currentPeriod, tone: "green" },
          { icon: "pending", label: e.statPending, value: formatKRW(pendingNet), sub: `평균 수수료 ${formatRate(totalGross, totalCommission)}`, tone: "warning" },
        ]}
      />

      <DetailMetricList
        items={[
          { label: "Gross Sales", value: formatKRW(totalGross) },
          { label: "Platform Commission", value: formatKRW(totalCommission), note: "판매 시점에 적용된 정책 기준" },
          { label: "Onchain Claimable", value: formatUSDC(onchainClaimable), note: "Base USDC escrow 기준" },
        ]}
      />

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="mb-8 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-ghost">
          <p className="text-xs font-bold text-outline uppercase tracking-widest mb-6">Monthly Net (Last {chartData.length} months)</p>
          <div className="flex items-end gap-3 h-32">
            {chartData.map((row) => {
              const pct = Math.round((row.net / maxNet) * 100);
              return (
                <div key={row.period} className="flex-1 flex flex-col items-center gap-2">
                  <div
                    className="w-full bg-primary/20 hover:bg-primary/30 transition-colors rounded-t relative group"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  >
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] font-bold text-on-surface opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      {formatKRW(row.net)}
                    </div>
                  </div>
                  <p className="text-[10px] text-outline text-center leading-tight">{row.period.slice(5)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {onchainClaimable > 0 && (
        <div className="mb-8 p-5 bg-surface-container-lowest border border-primary/20 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Base USDC Claim</p>
            <p className="text-sm text-on-surface-variant mt-1">
              {hasPendingClaimReview
                ? `${formatUSDC(onchainClaimable)} is waiting for admin review.`
                : `${formatUSDC(approvedOnchainClaimable)} is approved to claim on Base.`}
            </p>
          </div>
          <button
            type="button"
            disabled={claimingOnchain || hasPendingClaimReview || approvedOnchainClaimable <= 0}
            onClick={claimOnchainUsdc}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            {claimingOnchain ? "Claiming..." : hasPendingClaimReview ? "Admin review required" : "Claim USDC"}
          </button>
        </div>
      )}

      {onchainRows.length > 0 && (
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest">Base USDC Settlement</p>
              <p className="text-sm text-on-surface-variant mt-1">온체인 escrow로 정산되는 판매 항목입니다.</p>
            </div>
            <div className="flex w-fit gap-1 rounded-lg bg-surface-container-lowest p-1 shadow-ghost">
              {(["claimable", "claimed", "all"] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setClaimFilter(filter)}
                  className={`px-3 py-2 text-xs font-bold uppercase tracking-widest rounded transition-colors ${
                    claimFilter === filter ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="-mx-4 overflow-x-auto border border-outline-variant/30 bg-surface-container-lowest shadow-ghost md:mx-0 md:rounded-lg">
            <table className="min-w-[920px] w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  {["Status", "Review", "Image", "Gross / Commission / Net", "Claimable", "Claim Tx", "Created"].map((h) => (
                    <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {filteredOnchainRows.map((row, index) => {
                  const image = ledgerImage(row);
                  return (
                    <tr key={row.id ?? index} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4">
                        <span className={`${CHIP_CLASS} ${
                          row.claim_status === "claimed"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300"
                        }`}>
                          {row.claim_status ?? "unknown"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${CHIP_CLASS} ${
                          row.claim_review_status === "approved"
                            ? "border-primary/20 bg-primary/10 text-primary"
                            : row.claim_review_status === "rejected"
                            ? "border-error/20 bg-error/10 text-error"
                            : "border-outline-variant/60 bg-surface-container-low text-on-surface-variant"
                        }`}>
                          {row.claim_review_status ?? "not_required"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-on-surface">{image?.title ?? "Untitled"}</p>
                        <p className="text-xs text-outline mt-1">
                          {image?.asset_id ?? "No asset"} · {ledgerOrderItem(row)?.license_code ?? "license"}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">
                        <p>Gross {formatKRW(row.gross_krw ?? 0)}</p>
                        <p className="text-xs text-outline">Commission {formatKRW(row.commission_krw ?? 0)} · {formatRate(row.gross_krw, row.commission_krw)}</p>
                        <p className="text-xs text-primary">Net {formatKRW(row.net_krw ?? 0)}</p>
                      </td>
                      <td className="px-6 py-4 font-semibold text-on-surface">
                        {formatUSDC(Number(row.claimable_amount) || 0)}
                      </td>
                      <td className="px-6 py-4">
                        {row.claim_tx_hash ? (
                          <span className="block max-w-[220px] truncate font-mono text-[10px] text-primary">{row.claim_tx_hash}</span>
                        ) : (
                          <span className="text-xs text-outline">Not claimed</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant">{formatDate(row.created_at)}</td>
                    </tr>
                  );
                })}
                {filteredOnchainRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-outline">No Base USDC rows for this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History table */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">{e.historyTitle}</p>
      {periods.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4 text-outline">
          <span className="material-symbols-outlined text-5xl">payments</span>
          <p>No earnings yet</p>
        </div>
      ) : (
        <div className="-mx-4 overflow-x-auto border border-outline-variant/30 bg-surface-container-lowest shadow-ghost md:mx-0 md:rounded-lg">
          <table className="min-w-[720px] w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["Period", "Sales", "Gross", "Commission", "Net Payout", "Status"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {periods.map((row) => (
                <tr key={row.period} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-medium text-on-surface">{row.period}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{row.sales}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{formatKRW(row.gross)}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{formatKRW(row.commission)}</td>
                  <td className="px-6 py-4 font-semibold text-on-surface">{formatKRW(row.net)}</td>
                  <td className="px-6 py-4">
                    {row.paid ? (
                      <span className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary`}>Paid</span>
                    ) : (
                      <button
                        onClick={() => requestPayout(row.period)}
                        disabled={payoutLoading && payoutPeriod === row.period}
                        className={`${CHIP_CLASS} border-amber-200/70 bg-amber-50 text-amber-600 transition-opacity hover:opacity-70 disabled:opacity-50 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-300`}
                      >
                        Request Payout
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
