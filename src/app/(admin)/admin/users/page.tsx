"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

interface UserSummary {
  id: string;
  full_name: string | null;
  role: "buyer" | "photographer";
  avatar_url: string | null;
  is_admin: boolean;
  wallet_address: string | null;
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
  avatar_url: string | null;
  wallet_address: string | null;
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

function formatKRW(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
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

  async function deleteUser() {
    if (!detail) return;
    const label = detail.email || detail.full_name || detail.id;
    if (!confirm(`${label} 회원을 탈퇴 처리할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${detail.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "회원 탈퇴 처리에 실패했습니다.");
      }
      setDetail(null);
      setOrders([]);
      setSelectedId(null);
      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "회원 탈퇴 처리에 실패했습니다.");
    } finally {
      setDeleting(false);
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
            placeholder="이름, 이메일, 지갑주소 검색"
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
        <div className="overflow-x-auto bg-surface-container-lowest shadow-ghost">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["회원", "역할", "최종 로그인", "로그인 수", "결제 수", "구매 이미지", "누적 결제"].map((head) => (
                  <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-outline">불러오는 중...</td></tr>
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
                  <td className="px-5 py-4 text-on-surface-variant">{user.role === "photographer" ? "사진작가" : "바이어"}</td>
                  <td className="px-5 py-4 text-on-surface-variant">{formatDate(user.last_login_at ?? user.authLastSignInAt)}</td>
                  <td className="px-5 py-4 font-semibold text-on-surface">{user.login_count ?? 0}</td>
                  <td className="px-5 py-4 font-semibold text-on-surface">{user.paymentCount}</td>
                  <td className="px-5 py-4 font-semibold text-on-surface">{user.purchaseCount}</td>
                  <td className="px-5 py-4 font-semibold text-primary">{formatKRW(user.totalPaidKrw)}</td>
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
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">최종 로그인</p><p className="mt-1 font-semibold">{formatDate(detail.last_login_at ?? detail.authLastSignInAt)}</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">총 로그인</p><p className="mt-1 font-semibold">{detail.login_count ?? 0}회</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">결제 수</p><p className="mt-1 font-semibold">{selectedSummary?.paymentCount ?? 0}회</p></div>
                  <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-outline">누적 결제</p><p className="mt-1 font-semibold">{formatKRW(selectedSummary?.totalPaidKrw ?? 0)}</p></div>
                </div>
                {detail.wallet_address && <p className="mt-3 truncate text-xs text-outline">지갑 {detail.wallet_address}</p>}
                <button
                  onClick={deleteUser}
                  disabled={deleting}
                  className="mt-5 w-full rounded-lg border border-error/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  {deleting ? "처리 중..." : "회원 탈퇴 처리"}
                </button>
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

