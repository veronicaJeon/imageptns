"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReconciliationSummary {
  pending: number;
  stalePending: number;
  failed: number;
  claimableRows: number;
  claimableUsdc: number;
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
  itemCount: number;
  ageMinutes: number;
  stale: boolean;
}

interface ReconciliationResponse {
  summary: ReconciliationSummary;
  orders: ReconciliationOrder[];
}

const EMPTY_SUMMARY: ReconciliationSummary = {
  pending: 0,
  stalePending: 0,
  failed: 0,
  claimableRows: 0,
  claimableUsdc: 0,
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

  useEffect(() => {
    fetch("/api/admin/onchain/reconciliation")
      .then(async (res) => {
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        setData(await res.json());
      })
      .finally(() => setLoading(false));
  }, []);

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
                {["주문", "상태", "금액", "구매자", "온체인 식별자", "경과"].map((head) => (
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
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-on-surface">
                    {formatAge(order.ageMinutes)}
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
