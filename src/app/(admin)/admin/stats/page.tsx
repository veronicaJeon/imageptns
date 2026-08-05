"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminChip, AdminListSurface } from "@/components/admin/AdminPrimitives";

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${color}`}>
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold uppercase tracking-widest text-outline">{label}</p>
        <p className="mt-0.5 truncate font-headline text-xl font-extrabold text-on-surface">{value}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-on-surface-variant">{sub}</p>}
      </div>
    </div>
  );
}

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

function formatUSDC(n: number) {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 6 })} USDC`;
}

interface AdminStats {
  images: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
  users: {
    total: number;
  };
  orders: {
    total: number;
    revenue: number;
  };
  onchain: {
    proof: {
      notRegistered: number;
      available: number;
      requested: number;
      pending: number;
      registered: number;
      failed: number;
    };
    payments: {
      pending: number;
      confirmed: number;
      failed: number;
    };
    claims: {
      claimableRows: number;
      claimableUsdc: number;
    };
  };
  recentUsers: RecentUser[];
}

interface RecentUser {
  id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
}

const EMPTY_IMAGES: AdminStats["images"] = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

const EMPTY_PROOF: AdminStats["onchain"]["proof"] = {
  notRegistered: 0,
  available: 0,
  requested: 0,
  pending: 0,
  registered: 0,
  failed: 0,
};

const EMPTY_PAYMENTS: AdminStats["onchain"]["payments"] = {
  pending: 0,
  confirmed: 0,
  failed: 0,
};

const EMPTY_CLAIMS: AdminStats["onchain"]["claims"] = {
  claimableRows: 0,
  claimableUsdc: 0,
};

export default function AdminStatsPage() {
  const [data, setData]       = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(async (res) => {
        if (res.status === 403) { setForbidden(true); return; }
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

  const img = data?.images ?? EMPTY_IMAGES;
  const proof = data?.onchain?.proof ?? EMPTY_PROOF;
  const payments = data?.onchain?.payments ?? EMPTY_PAYMENTS;
  const claims = data?.onchain?.claims ?? EMPTY_CLAIMS;
  const reviewRate = img.total > 0 ? Math.round((img.approved / img.total) * 100) : 0;
  const attentionItems = [
    {
      icon: "sync_problem",
      label: "증명 등록 실패",
      value: proof.failed,
      detail: "Arweave 업로드 또는 GraphQL 확인에 실패했습니다.",
      href: "/admin/onchain-registrations",
      tone: "text-error bg-error/10",
    },
    {
      icon: "hourglass_top",
      label: "증명 등록 진행 중",
      value: proof.pending,
      detail: "장시간 pending이면 GraphQL 재검증 또는 재처리가 필요합니다.",
      href: "/admin/onchain-registrations",
      tone: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      icon: "verified",
      label: "사진작가 등록 요청",
      value: proof.requested,
      detail: "사진작가가 Arweave 자격증명 등록을 요청한 이미지입니다.",
      href: "/admin/onchain-registrations",
      tone: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      icon: "pending_actions",
      label: "Base 결제 확인 대기",
      value: payments.pending,
      detail: "구매자가 confirm 단계에서 이탈했거나 RPC 확인이 지연됐을 수 있습니다.",
      href: "/admin/onchain",
      tone: "text-amber-600 bg-amber-50 dark:bg-amber-900/20",
    },
    {
      icon: "error",
      label: "Base 결제 실패",
      value: payments.failed,
      detail: "실패 주문의 재시도/정리 여부를 확인해야 합니다.",
      href: "/admin/onchain",
      tone: "text-error bg-error/10",
    },
    {
      icon: "savings",
      label: "사진작가 Claim 대기",
      value: claims.claimableRows,
      detail: `${formatUSDC(claims.claimableUsdc ?? 0)}가 아직 claim되지 않았습니다.`,
      href: "/admin/payouts",
      tone: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight mb-8">통계</h1>

      {/* Image stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">이미지</p>
      <AdminListSurface className="mb-8 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon="photo_library" label="전체 이미지"  value={img.total    ?? 0} color="bg-surface-container-high text-on-surface-variant" />
        <StatCard icon="pending"       label="검토 대기"    value={img.pending  ?? 0} color="bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300" />
        <StatCard icon="check_circle"  label="승인됨"       value={img.approved ?? 0} sub={`승인율 ${reviewRate}%`} color="bg-primary/10 text-primary" />
        <StatCard icon="cancel"        label="거절됨"       value={img.rejected ?? 0} color="bg-error/10 text-error" />
        </div>
      </AdminListSurface>

      {/* User & revenue stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">유저 & 매출</p>
      <AdminListSurface className="mb-8 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon="group"        label="전체 회원"    value={data?.users?.total ?? 0}          color="bg-blue-50 text-blue-500 dark:bg-blue-900/20" />
        <StatCard icon="receipt_long" label="완료된 주문"  value={data?.orders?.total ?? 0}         color="bg-green-50 text-green-500 dark:bg-green-900/20" />
        <StatCard icon="payments"     label="누적 매출"    value={formatKRW(data?.orders?.revenue ?? 0)} color="bg-green-50 text-green-600 dark:bg-green-900/20" />
        </div>
      </AdminListSurface>

      {/* Onchain ops stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">온체인 운영</p>
      <AdminListSurface className="mb-8 p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon="verified"
          label="증명 등록 완료"
          value={proof.registered ?? 0}
          sub={`요청 ${proof.requested ?? 0} / 진행 ${proof.pending ?? 0} / 실패 ${proof.failed ?? 0}`}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon="cloud_off"
          label="등록가능"
          value={proof.available ?? 0}
          sub={`미등록 ${proof.notRegistered ?? 0}`}
          color="bg-surface-container-high text-on-surface-variant"
        />
        <StatCard
          icon="currency_exchange"
          label="Base 결제"
          value={payments.confirmed ?? 0}
          sub={`대기 ${payments.pending ?? 0} / 실패 ${payments.failed ?? 0}`}
          color="bg-green-50 text-green-600 dark:bg-green-900/20"
        />
        <StatCard
          icon="account_balance_wallet"
          label="Claim 대기"
          value={formatUSDC(claims.claimableUsdc ?? 0)}
          sub={`${claims.claimableRows ?? 0}개 정산 항목`}
          color="bg-blue-50 text-blue-500 dark:bg-blue-900/20"
        />
        </div>
      </AdminListSurface>

      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">운영 주의 항목</p>
      <AdminListSurface className="mb-8">
        {attentionItems.length === 0 ? (
          <div className="px-6 py-8 flex items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-primary">verified</span>
            <p className="text-sm">현재 온체인 운영 주의 항목이 없습니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/20">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-6 py-4 flex items-center gap-4 hover:bg-surface-container-low transition-colors"
              >
                <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.tone}`}>
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-on-surface">{item.label}</p>
                  <p className="text-xs text-on-surface-variant mt-1">{item.detail}</p>
                </div>
                <span className="text-xl font-headline font-extrabold text-on-surface">{item.value}</span>
              </Link>
            ))}
          </div>
        )}
      </AdminListSurface>

      {/* Image approval bar */}
      {img.total > 0 && (
        <>
          <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">이미지 상태 분포</p>
          <AdminListSurface className="mb-8 p-5">
            <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
              {img.approved > 0 && (
                <div className="bg-primary transition-all" style={{ width: `${(img.approved / img.total) * 100}%` }} title={`승인: ${img.approved}`} />
              )}
              {img.pending > 0 && (
                <div className="bg-amber-400 transition-all" style={{ width: `${(img.pending / img.total) * 100}%` }} title={`대기: ${img.pending}`} />
              )}
              {img.rejected > 0 && (
                <div className="bg-error/60 transition-all" style={{ width: `${(img.rejected / img.total) * 100}%` }} title={`거절: ${img.rejected}`} />
              )}
            </div>
            <div className="flex gap-6 mt-3 text-xs text-outline">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />승인 {img.approved}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />대기 {img.pending}</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-error/60 inline-block" />거절 {img.rejected}</span>
            </div>
          </AdminListSurface>
        </>
      )}

      {/* Recent users */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">최근 가입 회원</p>
      {(data?.recentUsers ?? []).length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-3 text-outline">
          <span className="material-symbols-outlined text-4xl">group</span>
          <p className="text-sm">가입 회원이 없습니다</p>
        </div>
      ) : (
        <AdminListSurface className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["이름", "역할", "가입일"].map((h) => (
                  <th key={h} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {(data?.recentUsers ?? []).map((u) => (
                <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4 font-medium text-on-surface">{u.full_name || "—"}</td>
                  <td className="px-6 py-4">
                    <AdminChip tone={u.role === "photographer" ? "primary" : "neutral"}>
                      {u.role === "photographer" ? "사진작가" : "바이어"}
                    </AdminChip>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {new Date(u.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminListSurface>
      )}
    </div>
  );
}
