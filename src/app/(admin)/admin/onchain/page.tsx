"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ReconciliationSummary {
  pending: number;
  stalePending: number;
  failed: number;
  claimableRows: number;
  claimableUsdc: number;
  claimableMismatches: number;
  claimableMissingWallets: number;
  claimableReadErrors: number;
  contractReconciliationConfigured: boolean;
}

interface ReconciliationOrder {
  id: string;
  orderNumber: string | null;
  createdAt: string;
  billingEmail: string | null;
  totalKrw: number;
  chainId: number | null;
  paymentToken: string | null;
  paymentTxHash: string | null;
  contractOrderId: string | null;
  cryptoAmount: number | string | null;
  cryptoStatus: string;
  buyerWalletAddress: string | null;
  confirmAttempts: number;
  confirmBackoffUntil: string | null;
  quoteUsdcPerKrw: number | string | null;
  quoteSource: string | null;
  quoteExpiresAt: string | null;
  itemCount: number;
  ageMinutes: number;
  stale: boolean;
}

interface ClaimReconciliationRow {
  photographerId: string;
  walletAddress: string | null;
  rowCount: number;
  dbClaimableUsdc: string;
  contractClaimableUsdc: string | null;
  deltaUsdc: string | null;
  status: "matched" | "mismatch" | "missing_wallet" | "read_error" | "not_checked";
  error?: string;
}

interface ReconciliationResponse {
  summary: ReconciliationSummary;
  orders: ReconciliationOrder[];
  claimReconciliation: ClaimReconciliationRow[];
  contractReconciliationError: string | null;
}

const EMPTY_SUMMARY: ReconciliationSummary = {
  pending: 0,
  stalePending: 0,
  failed: 0,
  claimableRows: 0,
  claimableUsdc: 0,
  claimableMismatches: 0,
  claimableMissingWallets: 0,
  claimableReadErrors: 0,
  contractReconciliationConfigured: false,
};

function formatKRW(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatUSDC(amount: number) {
  return `${amount.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC`;
}

function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function StatTile({ icon, label, value, tone }: { icon: string; label: string; value: string | number; tone: string }) {
  return (
    <div className="bg-surface-container-lowest shadow-ghost p-5 flex flex-col gap-3">
      <span className={`w-10 h-10 rounded-full flex items-center justify-center ${tone}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
    </div>
  );
}

export default function AdminOnchainPage() {
  const [data, setData] = useState<ReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [txInputs, setTxInputs] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/onchain/reconciliation");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refresh]);

  async function confirmOrder(orderId: string) {
    const txHash = txInputs[orderId]?.trim();
    if (!txHash) {
      alert("재확인할 Base purchase tx hash를 입력해주세요.");
      return;
    }

    setConfirming((prev) => ({ ...prev, [orderId]: true }));
    try {
      const res = await fetch("/api/onchain/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderDbId: orderId, txHash }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string; retryAfterSeconds?: number } | null;
        const retry = body?.retryAfterSeconds ? ` (${body.retryAfterSeconds}초 후 재시도)` : "";
        throw new Error(`${body?.error ?? "Base tx 재확인에 실패했습니다."}${retry}`);
      }

      setTxInputs((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
      await refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Base tx 재확인에 실패했습니다.");
    } finally {
      setConfirming((prev) => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }
  }

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <p className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const orders = data?.orders ?? [];
  const claimReconciliation = data?.claimReconciliation ?? [];

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">온체인 운영</h1>
        <p className="text-sm text-on-surface-variant">
          Base USDC 주문 중 확인 대기, 장기 pending, 실패 상태를 점검합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatTile icon="pending_actions" label="확인 대기" value={summary.pending} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/20" />
        <StatTile icon="hourglass_top" label="30분 초과" value={summary.stalePending} tone="bg-error/10 text-error" />
        <StatTile icon="error" label="실패 주문" value={summary.failed} tone="bg-error/10 text-error" />
        <StatTile icon="savings" label="Claim 대기" value={formatUSDC(summary.claimableUsdc)} tone="bg-blue-50 text-blue-600 dark:bg-blue-900/20" />
      </div>

      <div className="mb-10 bg-surface-container-lowest shadow-ghost p-5">
        <div className="flex flex-col gap-1 mb-4">
          <p className="text-xs font-bold text-outline uppercase tracking-widest">DB / Contract Claimable 대조</p>
          <p className="text-sm text-on-surface-variant">
            사진가별 DB claimable USDC와 escrow contract의 claimable(address)를 비교합니다.
          </p>
          {!summary.contractReconciliationConfigured && (
            <p className="text-xs text-error mt-1">{data?.contractReconciliationError ?? "온체인 설정이 없어 contract 값을 읽지 못했습니다."}</p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
          <div className="bg-surface-container-low px-3 py-2">
            <p className="font-bold text-on-surface">{summary.claimableMismatches}</p>
            <p className="text-outline mt-1">불일치</p>
          </div>
          <div className="bg-surface-container-low px-3 py-2">
            <p className="font-bold text-on-surface">{summary.claimableMissingWallets}</p>
            <p className="text-outline mt-1">지갑 없음</p>
          </div>
          <div className="bg-surface-container-low px-3 py-2">
            <p className="font-bold text-on-surface">{summary.claimableReadErrors}</p>
            <p className="text-outline mt-1">RPC 오류</p>
          </div>
        </div>
        {claimReconciliation.length === 0 ? (
          <p className="text-sm text-outline">claimable onchain ledger가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  {["사진가", "DB", "Contract", "차이", "상태"].map((head) => (
                    <th key={head} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-3 py-2">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {claimReconciliation.map((row) => (
                  <tr key={row.photographerId}>
                    <td className="px-3 py-2">
                      <p className="font-mono text-[10px] text-on-surface max-w-[180px] truncate">{row.photographerId}</p>
                      <p className="font-mono text-[10px] text-outline max-w-[180px] truncate">{row.walletAddress ?? "No wallet"}</p>
                    </td>
                    <td className="px-3 py-2 text-on-surface">{row.dbClaimableUsdc} USDC</td>
                    <td className="px-3 py-2 text-on-surface">{row.contractClaimableUsdc ? `${row.contractClaimableUsdc} USDC` : "-"}</td>
                    <td className="px-3 py-2 text-on-surface">{row.deltaUsdc ? `${row.deltaUsdc} USDC` : "-"}</td>
                    <td className="px-3 py-2">
                      <span className={`font-bold ${
                        row.status === "matched" ? "text-primary" :
                        row.status === "mismatch" ? "text-error" :
                        "text-amber-600"
                      }`}>
                        {row.status}
                      </span>
                      {row.error && <p className="text-[10px] text-outline mt-1 max-w-[220px] truncate">{row.error}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-outline uppercase tracking-widest">Base 주문 점검</p>
          <p className="text-sm text-on-surface-variant mt-1">최근 100개의 pending/failed Base USDC 주문입니다.</p>
        </div>
        <Link href="/admin/stats" className="text-xs font-bold uppercase tracking-widest text-primary hover:opacity-70">
          통계로 돌아가기
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-surface-container-lowest shadow-ghost px-6 py-12 flex flex-col items-center gap-3 text-outline">
          <span className="material-symbols-outlined text-5xl">verified</span>
          <p className="text-sm">확인 필요한 Base 주문이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["주문", "상태", "금액", "구매자", "온체인 식별자", "경과", "재확인"].map((head) => (
                  <th key={head} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-surface-container-low transition-colors align-top">
                  <td className="px-6 py-4">
                    <p className="font-bold text-on-surface">{order.orderNumber ?? order.id}</p>
                    <p className="text-xs text-outline mt-1">{new Date(order.createdAt).toLocaleString("ko-KR")}</p>
                    <p className="text-xs text-on-surface-variant mt-1">{order.itemCount} items</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      order.cryptoStatus === "failed" ? "bg-error/10 text-error" : "bg-amber-50 text-amber-600 dark:bg-amber-900/20"
                    }`}>
                      {order.cryptoStatus}
                    </span>
                    {order.stale && (
                      <p className="text-xs text-error font-bold mt-2">stale pending</p>
                    )}
                    {order.confirmBackoffUntil && (
                      <p className="text-[10px] text-outline mt-2">
                        backoff {new Date(order.confirmBackoffUntil).toLocaleTimeString("ko-KR")}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-on-surface">{formatKRW(order.totalKrw)}</p>
                    {order.cryptoAmount && <p className="text-xs text-outline mt-1">{order.cryptoAmount} USDC</p>}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-on-surface-variant">{order.billingEmail ?? "No email"}</p>
                    {order.buyerWalletAddress && (
                      <p className="text-[10px] font-mono text-outline mt-1 max-w-[180px] truncate">{order.buyerWalletAddress}</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 text-[10px] font-mono text-outline max-w-[240px]">
                      {order.contractOrderId && <span className="truncate">order {order.contractOrderId}</span>}
                      {order.paymentToken && <span className="truncate">token {order.paymentToken}</span>}
                      {order.paymentTxHash && <span className="truncate">tx {order.paymentTxHash}</span>}
                      {order.chainId && <span>chain {order.chainId}</span>}
                      {order.quoteUsdcPerKrw && <span className="truncate">quote {order.quoteUsdcPerKrw} / {order.quoteSource ?? "unknown"}</span>}
                      {order.quoteExpiresAt && <span className="truncate">expires {new Date(order.quoteExpiresAt).toLocaleString("ko-KR")}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-on-surface">
                    {formatAge(order.ageMinutes)}
                  </td>
                  <td className="px-6 py-4">
                    {order.cryptoStatus === "pending" ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void confirmOrder(order.id);
                        }}
                        className="flex min-w-[260px] items-center gap-2"
                      >
                        <input
                          value={txInputs[order.id] ?? ""}
                          onChange={(event) => setTxInputs((prev) => ({ ...prev, [order.id]: event.target.value }))}
                          placeholder="purchase tx hash"
                          disabled={Boolean(confirming[order.id])}
                          className="min-w-0 flex-1 rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface outline-none placeholder:text-outline focus:border-primary disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={Boolean(confirming[order.id])}
                          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          {confirming[order.id] ? "확인 중" : "확인"}
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-outline">-</span>
                    )}
                    {order.confirmAttempts > 0 && (
                      <p className="text-[10px] text-outline mt-2">{order.confirmAttempts} attempts</p>
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
