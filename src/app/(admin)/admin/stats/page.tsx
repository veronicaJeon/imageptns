"use client";

import { useState, useEffect } from "react";

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="bg-surface-container-lowest shadow-ghost p-6 flex flex-col gap-3">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </div>
      <p className="text-2xl font-headline font-extrabold text-on-surface">{value}</p>
      <p className="text-xs text-outline uppercase tracking-widest font-bold">{label}</p>
      {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
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

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight mb-8">통계</h1>

      {/* Image stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">이미지</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard icon="photo_library" label="전체 이미지"  value={img.total    ?? 0} color="bg-surface-container-high text-on-surface-variant" />
        <StatCard icon="pending"       label="검토 대기"    value={img.pending  ?? 0} color="bg-amber-50 text-amber-500 dark:bg-amber-900/20 dark:text-amber-300" />
        <StatCard icon="check_circle"  label="승인됨"       value={img.approved ?? 0} sub={`승인율 ${reviewRate}%`} color="bg-primary/10 text-primary" />
        <StatCard icon="cancel"        label="거절됨"       value={img.rejected ?? 0} color="bg-error/10 text-error" />
      </div>

      {/* User & revenue stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">유저 & 매출</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
        <StatCard icon="group"        label="전체 회원"    value={data?.users?.total ?? 0}          color="bg-blue-50 text-blue-500 dark:bg-blue-900/20" />
        <StatCard icon="receipt_long" label="완료된 주문"  value={data?.orders?.total ?? 0}         color="bg-green-50 text-green-500 dark:bg-green-900/20" />
        <StatCard icon="payments"     label="누적 매출"    value={formatKRW(data?.orders?.revenue ?? 0)} color="bg-green-50 text-green-600 dark:bg-green-900/20" />
      </div>

      {/* Onchain ops stats */}
      <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">온체인 운영</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard
          icon="verified"
          label="증명 등록 완료"
          value={proof.registered ?? 0}
          sub={`대기 ${proof.pending ?? 0} / 실패 ${proof.failed ?? 0}`}
          color="bg-primary/10 text-primary"
        />
        <StatCard
          icon="cloud_off"
          label="증명 미등록"
          value={proof.notRegistered ?? 0}
          sub="승인 전 또는 이전 데이터"
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

      {/* Image approval bar */}
      {img.total > 0 && (
        <>
          <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">이미지 상태 분포</p>
          <div className="bg-surface-container-lowest shadow-ghost p-6 mb-10">
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
          </div>
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
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
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
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      u.role === "photographer" ? "bg-primary/10 text-primary" : "bg-surface-container-high text-on-surface-variant"
                    }`}>
                      {u.role === "photographer" ? "사진작가" : "바이어"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    {new Date(u.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
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
