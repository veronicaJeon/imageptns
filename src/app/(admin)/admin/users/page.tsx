"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { ProfileWithdrawalAssessment } from "@/lib/profiles/withdrawal";

interface UserSummary {
  id: string;
  full_name: string | null;
  role: "buyer" | "photographer";
  photographer_status: "none" | "pending" | "approved" | "suspended";
  avatar_url: string | null;
  is_admin: boolean;
  wallet_address: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  created_at: string;
  last_login_at: string | null;
  login_count: number | null;
  email: string;
  authLastSignInAt: string | null;
  orderCount: number;
  paymentCount: number;
  purchaseCount: number;
  totalPaidKrw: number;
  lastOrderAt: string | null;
}

interface UserDetail {
  id: string;
  full_name: string | null;
  bio: string | null;
  role: "buyer" | "photographer";
  photographer_status: "none" | "pending" | "approved" | "suspended";
  avatar_url: string | null;
  wallet_address: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
  email: string;
  authCreatedAt: string | null;
  authLastSignInAt: string | null;
}

interface UserOrderItem {
  id: string;
  license_code: string;
  price_krw: number;
  image: { id: string; asset_id: string | null; title: string | null; storage_path_preview: string | null } | null;
}

interface UserOrder {
  id: string;
  order_number: string;
  status: string;
  subtotal_krw: number;
  vat_krw: number;
  total_krw: number;
  payment_provider: string | null;
  completed_at: string | null;
  created_at: string;
  order_items: UserOrderItem[] | null;
}

interface WithdrawalRequestSummary {
  id: string;
  status: string;
  created_at: string;
}

const WITHDRAWAL_METRIC_LABELS: Record<keyof ProfileWithdrawalAssessment["impactSnapshot"], string> = {
  activeImages: "활성 이미지",
  soldImages: "판매 이미지",
  onchainImages: "온체인/Arweave",
  pendingOrders: "대기 주문",
  pendingPayouts: "대기 정산",
  claimableEarnings: "클레임 수익",
  claimableAmount: "클레임 금액",
};

const WITHDRAWAL_REASON_LABELS: Record<string, string> = {
  active_images: "활성 이미지",
  sold_images: "판매된 이미지",
  onchain_images: "온체인/Arweave 증명 이미지",
  pending_orders: "처리 중인 주문",
  pending_payouts: "처리 중인 정산",
  claimable_earnings: "클레임 가능한 수익",
};

const WITHDRAWAL_ACTION_LABELS: Record<string, string> = {
  retire_active_images: "활성 이미지 정리",
  preserve_sold_image_access: "구매자 접근 보존",
  review_onchain_records: "온체인 기록 검토",
  resolve_pending_orders: "대기 주문 처리",
  settle_pending_payouts: "대기 정산 완료",
  settle_claimable_earnings: "클레임 수익 정산",
};

const PHOTOGRAPHER_STATUS_LABELS: Record<UserSummary["photographer_status"], string> = {
  none: "미신청",
  pending: "승인대기",
  approved: "승인됨",
  suspended: "중지됨",
};

const PHOTOGRAPHER_STATUS_STYLES: Record<UserSummary["photographer_status"], string> = {
  none: "bg-surface-container-low text-outline",
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200",
  approved: "bg-primary/10 text-primary",
  suspended: "bg-error/10 text-error",
};

function formatKRW(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

function formatWithdrawalMetric(
  key: keyof ProfileWithdrawalAssessment["impactSnapshot"],
  value: number,
) {
  if (key === "claimableAmount") {
    return value.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
  }
  return `${value.toLocaleString("ko-KR")}건`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suspendingPhotographer, setSuspendingPhotographer] = useState(false);
  const [withdrawalAssessment, setWithdrawalAssessment] = useState<ProfileWithdrawalAssessment | null>(null);
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequestSummary | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (role !== "all") params.set("role", role);
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("회원 목록을 불러오지 못했습니다.");
      const data = await res.json() as { users?: UserSummary[] };
      setUsers(data.users ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query, role]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setSelectedId(id);
    setWithdrawalAssessment(null);
    setWithdrawalRequest(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      if (!res.ok) throw new Error("회원 상세를 불러오지 못했습니다.");
      const data = await res.json() as { user: UserDetail; orders?: UserOrder[] };
      setDetail(data.user);
      setOrders(data.orders ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "회원 상세를 불러오지 못했습니다.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const selectedSummary = useMemo(
    () => users.find((user) => user.id === selectedId) ?? null,
    [selectedId, users],
  );

  const deleteActionLabel = useMemo(() => {
    if (deleting) return "처리 중...";
    if (withdrawalAssessment && !withdrawalAssessment.canDeleteImmediately) return "탈퇴 검토 요청 생성됨";
    return "회원 탈퇴 처리";
  }, [deleting, withdrawalAssessment]);

  async function deleteUser() {
    if (!detail) return;
    const label = detail.email || detail.full_name || detail.id;
    if (!confirm(`${label} 회원을 탈퇴 처리할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.id}`, { method: "DELETE" });
      const body = await res.json().catch(() => null) as {
        error?: string;
        assessment?: ProfileWithdrawalAssessment;
        withdrawalRequest?: WithdrawalRequestSummary;
      } | null;
      if (!res.ok) {
        if (res.status === 409 && body?.assessment) {
          setWithdrawalAssessment(body.assessment);
          setWithdrawalRequest(body.withdrawalRequest ?? null);
          return;
        }
        throw new Error(body?.error ?? "회원 탈퇴 처리에 실패했습니다.");
      }
      setDetail(null);
      setOrders([]);
      setSelectedId(null);
      setWithdrawalAssessment(null);
      setWithdrawalRequest(null);
      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "회원 탈퇴 처리에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function suspendPhotographerAccess() {
    if (!detail) return;
    const reason = prompt("사진가 권한 회수 사유를 입력하세요. 사용자에게 안내될 수 있습니다.")?.trim() ?? "";
    if (!confirm(`${detail.full_name || detail.email || detail.id} 회원의 사진가 권한을 회수할까요?`)) return;

    setSuspendingPhotographer(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.id}/photographer-suspension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => null) as { profile?: UserDetail; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "사진가 권한을 회수하지 못했습니다.");

      setDetail((current) => current ? { ...current, photographer_status: "suspended" } : current);
      setUsers((current) =>
        current.map((user) =>
          user.id === detail.id ? { ...user, photographer_status: "suspended" } : user,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진가 권한을 회수하지 못했습니다.");
    } finally {
      setSuspendingPhotographer(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">회원관리</h1>
          <p className="mt-1 text-sm text-outline">회원 프로필, 구매이력, 로그인 통계, 결제 횟수를 확인하고 탈퇴 처리합니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름, 이메일, 지갑, 전화, 지역 검색"
            className="h-11 w-full rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary sm:w-72"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            <option value="all">전체 역할</option>
            <option value="buyer">바이어</option>
            <option value="photographer">사진작가</option>
          </select>
          <button onClick={loadUsers} className="h-11 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-widest text-white">조회</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["회원", "역할", "최근 활동", "거래 요약"].map((head) => (
                  <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-outline">불러오는 중...</td></tr>
              ) : users.map((user) => (
                <tr
                  key={user.id}
                  onClick={() => loadDetail(user.id)}
                  className={`cursor-pointer transition-colors hover:bg-surface-container-low ${selectedId === user.id ? "bg-primary/5" : ""}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-container-low">
                        {user.avatar_url ? <Image src={user.avatar_url} alt="" width={40} height={40} className="h-full w-full object-cover" /> : <span className="material-symbols-outlined text-outline">person</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-on-surface">{user.full_name || "이름 없음"} {user.is_admin && <span className="text-primary">Admin</span>}</p>
                        <p className="truncate text-xs text-outline">{user.email || user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-surface-container-low px-2.5 py-1 text-xs font-bold text-on-surface-variant">
                        {user.role === "photographer" ? "사진작가" : "바이어"}
                      </span>
                      {user.photographer_status !== "none" && (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PHOTOGRAPHER_STATUS_STYLES[user.photographer_status]}`}>
                          {PHOTOGRAPHER_STATUS_LABELS[user.photographer_status]}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">
                    <p className="text-xs">{formatDate(user.last_login_at ?? user.authLastSignInAt)}</p>
                    <p className="mt-1 text-[10px] text-outline">로그인 {user.login_count ?? 0}회</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-primary">{formatKRW(user.totalPaidKrw)}</p>
                    <p className="mt-1 text-[10px] text-outline">결제 {user.paymentCount}회 · 이미지 {user.purchaseCount}개</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="bg-surface-container-lowest p-5 shadow-ghost">
          {!selectedSummary && !detailLoading ? (
            <div className="flex min-h-96 flex-col items-center justify-center gap-3 text-center text-outline">
              <span className="material-symbols-outlined text-5xl">manage_accounts</span>
              <p className="text-sm">회원을 선택하면 프로필과 구매이력이 표시됩니다.</p>
            </div>
          ) : detailLoading ? (
            <div className="flex min-h-96 items-center justify-center">
              <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : detail && (
            <div>
              <div className="border-b border-outline-variant/20 pb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{detail.role}</p>
                <h2 className="mt-1 font-headline text-xl font-extrabold text-on-surface">{detail.full_name || "이름 없음"}</h2>
                <p className="mt-1 text-sm text-outline">{detail.email || detail.id}</p>
                {detail.photographer_status !== "none" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PHOTOGRAPHER_STATUS_STYLES[detail.photographer_status]}`}>
                      사진가 {PHOTOGRAPHER_STATUS_LABELS[detail.photographer_status]}
                    </span>
                    {detail.photographer_status === "approved" && (
                      <button
                        type="button"
                        onClick={suspendPhotographerAccess}
                        disabled={suspendingPhotographer}
                        className="rounded-full border border-error/30 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                      >
                        {suspendingPhotographer ? "처리 중" : "사진가 권한 회수"}
                      </button>
                    )}
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">최종 로그인</p><p className="mt-1 font-semibold">{formatDate(detail.last_login_at ?? detail.authLastSignInAt)}</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">총 로그인</p><p className="mt-1 font-semibold">{detail.login_count ?? 0}회</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">결제 수</p><p className="mt-1 font-semibold">{selectedSummary?.paymentCount ?? 0}회</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">누적 결제</p><p className="mt-1 font-semibold">{formatKRW(selectedSummary?.totalPaidKrw ?? 0)}</p></div>
                </div>
                {detail.wallet_address && <p className="mt-3 truncate text-xs text-outline">지갑 {detail.wallet_address}</p>}
                {detail.phone_number && <p className="mt-2 truncate text-xs text-outline">전화 {detail.phone_number}</p>}
                {(detail.primary_activity_regions?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.primary_activity_regions?.map((region) => (
                      <span key={region} className="rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
                        {region}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={deleteUser}
                  disabled={deleting}
                  className="mt-5 w-full rounded-lg border border-error/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  {deleteActionLabel}
                </button>
                {withdrawalAssessment && !withdrawalAssessment.canDeleteImmediately && (
                  <div className="mt-4 rounded-lg border border-error/30 bg-error/5 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-error">탈퇴 검토 요청</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">
                          즉시 탈퇴 대신 관리자 검토가 필요합니다.
                        </p>
                      </div>
                      {withdrawalRequest && (
                        <span className="shrink-0 rounded-full bg-surface-container-lowest px-2 py-1 text-[10px] font-bold text-error">
                          {withdrawalRequest.status}
                        </span>
                      )}
                    </div>
                    {withdrawalRequest && (
                      <p className="mt-2 text-xs text-outline">
                        요청 {withdrawalRequest.id.slice(0, 8)} · {formatDate(withdrawalRequest.created_at)}
                      </p>
                    )}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {(Object.entries(withdrawalAssessment.impactSnapshot) as Array<[
                        keyof ProfileWithdrawalAssessment["impactSnapshot"],
                        number,
                      ]>).map(([key, value]) => (
                        <div key={key} className="rounded-lg bg-surface-container-lowest p-2">
                          <p className="text-[10px] font-bold text-outline">{WITHDRAWAL_METRIC_LABELS[key]}</p>
                          <p className="mt-1 text-xs font-semibold text-on-surface">{formatWithdrawalMetric(key, value)}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {withdrawalAssessment.blockingReasons.map((reason) => (
                        <div key={reason.code} className="text-xs text-on-surface-variant">
                          <span className="font-semibold text-error">{WITHDRAWAL_REASON_LABELS[reason.code] ?? reason.label}</span>
                          <span className="text-outline"> · {reason.count.toLocaleString("ko-KR")}건</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {withdrawalAssessment.requiredActions.map((action) => (
                        <span key={action.code} className="rounded-full bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
                          {WITHDRAWAL_ACTION_LABELS[action.code] ?? action.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-outline">구매이력</h3>
                <div className="mt-3 flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
                  {orders.length === 0 ? (
                    <p className="rounded-lg bg-surface-container-low p-4 text-sm text-outline">구매이력이 없습니다.</p>
                  ) : orders.map((order) => (
                    <div key={order.id} className="rounded-lg bg-surface-container-low p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-bold text-on-surface">{order.order_number}</p>
                          <p className="mt-1 text-xs text-outline">{formatDate(order.completed_at ?? order.created_at)} · {order.payment_provider ?? "toss"}</p>
                        </div>
                        <span className="rounded-full bg-surface-container-lowest px-2 py-1 text-[10px] font-bold text-on-surface-variant">{order.status}</span>
                      </div>
                      <p className="mt-3 font-bold text-primary">{formatKRW(order.total_krw)}</p>
                      <div className="mt-3 space-y-2">
                        {(order.order_items ?? []).map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                            <span className="truncate text-on-surface-variant">{item.image?.asset_id ?? item.image?.id} · {item.image?.title ?? "삭제된 이미지"}</span>
                            <span className="shrink-0 font-semibold">{formatKRW(item.price_krw)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
