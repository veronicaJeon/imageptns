"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccount, connect, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { getAddress, type Address } from "viem";
import { useLang } from "@/lib/i18n/store";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";

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

interface PeriodEarnings {
  period: string;
  sales: number;
  gross: number;
  commission: number;
  net: number;
  paid: boolean;
}

interface LedgerEarning {
  settlement_provider?: string | null;
  claim_status?: string | null;
  claimable_amount?: number | string | null;
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

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-container-lowest shadow-ghost p-6 flex flex-col gap-2">
      <span className="material-symbols-outlined text-2xl text-primary">{icon}</span>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
      {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
    </div>
  );
}

export default function EarningsPage() {
  return (
    <WagmiProvider config={earningsWagmiConfig}>
      <QueryClientProvider client={earningsQueryClient}>
        <EarningsInner />
      </QueryClientProvider>
    </WagmiProvider>
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
  const onchainClaimable = (data?.ledger ?? [])
    .filter((row: LedgerEarning) => row.settlement_provider === "onchain_escrow" && row.claim_status === "claimable")
    .reduce((sum: number, row: LedgerEarning) => sum + (Number(row.claimable_amount) || 0), 0);

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
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">{e.title}</h1>
        {currentPeriodData && !currentPeriodData.paid && (
          <button
            onClick={() => requestPayout(currentPeriodData.period)}
            disabled={payoutLoading}
            className="flex items-center gap-2 px-5 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">payments</span>
            {e.payoutBtn}
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard icon="account_balance_wallet" label={e.statTotal}   value={formatKRW(totalNet)}   sub="All time" />
        <StatCard icon="trending_up"            label={e.statMonth}   value={formatKRW(currentPeriodData?.net ?? 0)} sub={currentPeriod} />
        <StatCard icon="pending"                label={e.statPending} value={formatKRW(pendingNet)} sub="Awaiting payout" />
      </div>

      {/* Bar chart */}
      {chartData.length > 0 && (
        <div className="bg-surface-container-lowest shadow-ghost p-6 mb-8">
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
              {onchainClaimable.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC is ready to claim on Base.
            </p>
          </div>
          <button
            type="button"
            disabled={claimingOnchain}
            onClick={claimOnchainUsdc}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            {claimingOnchain ? "Claiming..." : "Claim USDC"}
          </button>
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
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["Period", "Sales", "Gross", "Commission (20%)", "Net Payout", "Status"].map((h) => (
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
                      <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary">Paid</span>
                    ) : (
                      <button
                        onClick={() => requestPayout(row.period)}
                        disabled={payoutLoading && payoutPeriod === row.period}
                        className="text-xs font-bold px-3 py-1 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300 hover:opacity-70 transition-opacity disabled:opacity-50"
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
