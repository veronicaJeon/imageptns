"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AdminButton,
  AdminChip,
  AdminInlineMetrics,
  AdminListSurface,
  adminStatusTone,
} from "@/components/admin/AdminPrimitives";
import type { ProfileWithdrawalAssessment } from "@/lib/profiles/withdrawal";

type PhotographerStatus = "none" | "pending" | "approved" | "suspended";

interface PhotographerApplicationSummary {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  bio: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface UserSummary {
  id: string;
  full_name: string | null;
  role: "buyer" | "photographer";
  photographer_status: PhotographerStatus;
  latest_photographer_application: PhotographerApplicationSummary | null;
  pending_photographer_application: PhotographerApplicationSummary | null;
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
  photographer_status: PhotographerStatus;
  latest_photographer_application: PhotographerApplicationSummary | null;
  pending_photographer_application: PhotographerApplicationSummary | null;
  photographer_applications: PhotographerApplicationSummary[];
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
  pending: "승인 대기",
  approved: "승인됨",
  suspended: "중지됨",
};

const APPLICATION_STATUS_LABELS: Record<PhotographerApplicationSummary["status"], string> = {
  pending: "승인 대기",
  approved: "승인됨",
  rejected: "승인되지 않음",
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
  const [photographerStatus, setPhotographerStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [suspendingPhotographer, setSuspendingPhotographer] = useState(false);
  const [reviewingPhotographerApplication, setReviewingPhotographerApplication] = useState(false);
  const [withdrawalAssessment, setWithdrawalAssessment] = useState<ProfileWithdrawalAssessment | null>(null);
  const [withdrawalRequest, setWithdrawalRequest] = useState<WithdrawalRequestSummary | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (role !== "all") params.set("role", role);
    if (photographerStatus !== "all") params.set("photographer_status", photographerStatus);
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
  }, [query, role, photographerStatus]);

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
    const reason = prompt("사진작가 권한 회수 사유를 입력하세요. 사용자에게 안내될 수 있습니다.")?.trim() ?? "";
    if (!confirm(`${detail.full_name || detail.email || detail.id} 회원의 사진작가 권한을 회수할까요?`)) return;

    setSuspendingPhotographer(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.id}/photographer-suspension`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = await res.json().catch(() => null) as { profile?: UserDetail; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "사진작가 권한을 회수하지 못했습니다.");

      setDetail((current) => current ? { ...current, photographer_status: "suspended" } : current);
      setUsers((current) =>
        current.map((user) =>
          user.id === detail.id ? { ...user, photographer_status: "suspended" } : user,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진작가 권한을 회수하지 못했습니다.");
    } finally {
      setSuspendingPhotographer(false);
    }
  }

  async function reviewPhotographerApplication(action: "approve" | "reject") {
    if (!detail?.pending_photographer_application) return;

    const application = detail.pending_photographer_application;
    const adminNote = prompt("관리자 메모를 입력하세요. 신청자에게는 공개되지 않습니다.")?.trim() ?? "";
    const rejectionReason = action === "reject"
      ? prompt("승인하지 않는 사유를 입력하세요. 신청자에게 안내됩니다.")?.trim() ?? ""
      : "";

    if (action === "reject" && !rejectionReason) return;
    if (!confirm(`${application.applicant_name}님의 사진작가 신청을 ${action === "approve" ? "승인" : "승인하지 않음"} 처리할까요?`)) return;

    setReviewingPhotographerApplication(true);
    try {
      const res = await fetch("/api/admin/photographer-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: application.id,
          action,
          admin_note: adminNote,
          rejection_reason: rejectionReason,
        }),
      });
      const body = await res.json().catch(() => null) as {
        application?: PhotographerApplicationSummary;
        error?: string;
      } | null;
      if (!res.ok || !body?.application) {
        throw new Error(body?.error ?? "사진작가 신청 검토 결과를 저장하지 못했습니다.");
      }

      const reviewedApplication = body.application;
      const nextPhotographerStatus: PhotographerStatus = action === "approve" ? "approved" : "suspended";
      setDetail((current) => {
        if (!current) return current;
        const applications = current.photographer_applications.length > 0
          ? current.photographer_applications.map((row) => row.id === reviewedApplication.id ? reviewedApplication : row)
          : [reviewedApplication];
        return {
          ...current,
          role: action === "approve" ? "photographer" : current.role,
          photographer_status: nextPhotographerStatus,
          latest_photographer_application: reviewedApplication,
          pending_photographer_application: null,
          photographer_applications: applications,
        };
      });
      setUsers((current) =>
        current.map((user) =>
          user.id === reviewedApplication.profile_id
            ? {
              ...user,
              role: action === "approve" ? "photographer" : user.role,
              photographer_status: nextPhotographerStatus,
              latest_photographer_application: reviewedApplication,
              pending_photographer_application: null,
            }
            : user,
        ),
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진작가 신청 검토 결과를 저장하지 못했습니다.");
    } finally {
      setReviewingPhotographerApplication(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
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
            <option value="buyer">구매자</option>
            <option value="photographer">사진작가</option>
          </select>
          <select
            value={photographerStatus}
            onChange={(event) => setPhotographerStatus(event.target.value)}
            className="h-11 rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
          >
            <option value="all">전체 사진작가 상태</option>
            <option value="pending">승인대기</option>
            <option value="approved">승인됨</option>
            <option value="suspended">중지됨</option>
            <option value="none">미신청</option>
          </select>
          <AdminButton onClick={loadUsers} variant="primary" size="md" className="h-11">조회</AdminButton>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <AdminListSurface>
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
                      <AdminChip tone="neutral">
                        {user.role === "photographer" ? "사진작가" : "구매자"}
                      </AdminChip>
                      {user.photographer_status !== "none" && (
                        <AdminChip tone={adminStatusTone(user.photographer_status)}>
                          {PHOTOGRAPHER_STATUS_LABELS[user.photographer_status]}
                        </AdminChip>
                      )}
                      {user.pending_photographer_application && (
                        <AdminChip tone="warning">
                          신청서 대기
                        </AdminChip>
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
        </AdminListSurface>

        <aside className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-ghost">
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
                    <AdminChip tone={adminStatusTone(detail.photographer_status)}>
                      사진작가 {PHOTOGRAPHER_STATUS_LABELS[detail.photographer_status]}
                    </AdminChip>
                    {detail.photographer_status === "approved" && (
                      <AdminButton
                        type="button"
                        onClick={suspendPhotographerAccess}
                        disabled={suspendingPhotographer}
                        variant="danger"
                      >
                        {suspendingPhotographer ? "처리 중" : "사진작가 권한 회수"}
                      </AdminButton>
                    )}
                  </div>
                )}
                {detail.latest_photographer_application && (
                  <div className="mt-4 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">사진작가 신청</p>
                        <p className="mt-1 text-sm font-semibold text-on-surface">
                          {detail.latest_photographer_application.applicant_name}
                        </p>
                        <p className="mt-1 text-xs text-outline">
                          접수 {formatDate(detail.latest_photographer_application.created_at)}
                          {detail.latest_photographer_application.reviewed_at
                            ? ` · 검토 ${formatDate(detail.latest_photographer_application.reviewed_at)}`
                            : ""}
                        </p>
                      </div>
                      <AdminChip tone={adminStatusTone(detail.latest_photographer_application.status)} className="shrink-0">
                        {APPLICATION_STATUS_LABELS[detail.latest_photographer_application.status]}
                      </AdminChip>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-on-surface-variant">
                      <p>소속: {detail.latest_photographer_application.organization ?? detail.full_name ?? "-"}</p>
                      <p>연락처: {detail.latest_photographer_application.phone_number ?? detail.phone_number ?? "-"}</p>
                      {(detail.latest_photographer_application.primary_activity_regions?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {detail.latest_photographer_application.primary_activity_regions?.map((region) => (
                            <AdminChip key={region} tone="neutral">
                              {region}
                            </AdminChip>
                          ))}
                        </div>
                      )}
                      {detail.latest_photographer_application.bio && (
                        <p className="leading-relaxed">소개: {detail.latest_photographer_application.bio}</p>
                      )}
                      {detail.latest_photographer_application.rejection_reason && (
                        <p className="text-error">승인하지 않는 사유: {detail.latest_photographer_application.rejection_reason}</p>
                      )}
                      {detail.latest_photographer_application.admin_note && (
                        <p className="text-outline">관리자 메모: {detail.latest_photographer_application.admin_note}</p>
                      )}
                    </div>

                    {detail.pending_photographer_application && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <AdminButton
                          type="button"
                          onClick={() => reviewPhotographerApplication("approve")}
                          disabled={reviewingPhotographerApplication}
                          variant="primary"
                          size="md"
                        >
                          {reviewingPhotographerApplication ? "처리 중" : "사진작가 승인"}
                        </AdminButton>
                        <AdminButton
                          type="button"
                          onClick={() => reviewPhotographerApplication("reject")}
                          disabled={reviewingPhotographerApplication}
                          variant="danger"
                          size="md"
                        >
                          승인하지 않음
                        </AdminButton>
                      </div>
                    )}
                  </div>
                )}
                <AdminInlineMetrics
                  className="mt-4"
                  items={[
                    { label: "최종 로그인", value: formatDate(detail.last_login_at ?? detail.authLastSignInAt) },
                    { label: "총 로그인", value: `${detail.login_count ?? 0}회` },
                    { label: "결제 수", value: `${selectedSummary?.paymentCount ?? 0}회` },
                    { label: "누적 결제", value: formatKRW(selectedSummary?.totalPaidKrw ?? 0) },
                  ]}
                />
                {detail.wallet_address && <p className="mt-3 truncate text-xs text-outline">지갑 {detail.wallet_address}</p>}
                {detail.phone_number && <p className="mt-2 truncate text-xs text-outline">전화 {detail.phone_number}</p>}
                {(detail.primary_activity_regions?.length ?? 0) > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {detail.primary_activity_regions?.map((region) => (
                      <AdminChip key={region} tone="neutral">
                        {region}
                      </AdminChip>
                    ))}
                  </div>
                )}
                <AdminButton
                  onClick={deleteUser}
                  disabled={deleting}
                  variant="danger"
                  size="md"
                  className="mt-5 h-11 w-full"
                >
                  {deleteActionLabel}
                </AdminButton>
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
                        <AdminChip tone={adminStatusTone(withdrawalRequest.status)} className="shrink-0">
                          {withdrawalRequest.status}
                        </AdminChip>
                      )}
                    </div>
                    {withdrawalRequest && (
                      <p className="mt-2 text-xs text-outline">
                        요청 {withdrawalRequest.id.slice(0, 8)} · {formatDate(withdrawalRequest.created_at)}
                      </p>
                    )}
                    <AdminInlineMetrics
                      className="mt-3"
                      items={(Object.entries(withdrawalAssessment.impactSnapshot) as Array<[
                        keyof ProfileWithdrawalAssessment["impactSnapshot"],
                        number,
                      ]>).map(([key, value]) => ({
                        label: WITHDRAWAL_METRIC_LABELS[key],
                        value: formatWithdrawalMetric(key, value),
                      }))}
                    />
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
                        <AdminChip key={action.code} tone="neutral">
                          {WITHDRAWAL_ACTION_LABELS[action.code] ?? action.label}
                        </AdminChip>
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
                        <AdminChip tone={adminStatusTone(order.status)}>{order.status}</AdminChip>
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
