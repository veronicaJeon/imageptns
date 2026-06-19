"use client";

import { useCallback, useEffect, useState } from "react";

interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: "buyer" | "photographer";
  roles?: Array<"buyer" | "photographer"> | null;
  is_admin: boolean;
  created_at: string;
  last_login_at: string | null;
  login_count: number | null;
}

type SortKey = "member" | "admin" | "lastLogin" | "loginCount";
type SortDirection = "asc" | "desc";

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminAccountsPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [adminOnly, setAdminOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "member", direction: "asc" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
    if (adminOnly) params.set("admin", "true");
    try {
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) throw new Error("계정 목록을 불러오지 못했습니다.");
      const data = await res.json() as { users?: AdminUserRow[] };
      setUsers(data.users ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "계정 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [adminOnly, query]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function setAdmin(user: AdminUserRow, next: boolean) {
    setSavingId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/admin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_admin: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "관리자 권한을 변경하지 못했습니다.");
      }
      await loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "관리자 권한을 변경하지 못했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  function userRoles(user: AdminUserRow) {
    const roles = Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : [user.role];
    return Array.from(new Set(roles));
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function sortIndicator(key: SortKey) {
    if (sort.key !== key) return "unfold_more";
    return sort.direction === "asc" ? "arrow_upward" : "arrow_downward";
  }

  const sortedUsers = [...users].sort((a, b) => {
    const direction = sort.direction === "asc" ? 1 : -1;
    if (sort.key === "member") {
      const left = `${a.full_name ?? ""} ${a.email ?? ""}`.trim().toLowerCase();
      const right = `${b.full_name ?? ""} ${b.email ?? ""}`.trim().toLowerCase();
      return left.localeCompare(right, "ko") * direction;
    }
    if (sort.key === "admin") {
      return (Number(a.is_admin) - Number(b.is_admin)) * direction;
    }
    if (sort.key === "lastLogin") {
      const left = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
      const right = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
      return (left - right) * direction;
    }
    return ((a.login_count ?? 0) - (b.login_count ?? 0)) * direction;
  });

  const sortableHeaders: Array<{ key: SortKey; label: string }> = [
    { key: "member", label: "회원" },
    { key: "admin", label: "관리자" },
    { key: "lastLogin", label: "최종 로그인" },
    { key: "loginCount", label: "로그인 수" },
  ];

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">관리자 계정관리</h1>
          <p className="mt-1 text-sm text-outline">가입자 중 관리자 권한을 부여하거나 회수합니다. 마지막 관리자는 보호됩니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex h-11 items-center gap-2 rounded-lg bg-surface-container-lowest px-4 text-sm ring-1 ring-outline-variant">
            <input type="checkbox" checked={adminOnly} onChange={(event) => setAdminOnly(event.target.checked)} />
            관리자만
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="이름 또는 이메일 검색"
            className="h-11 w-full rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary sm:w-72"
          />
          <button onClick={loadUsers} className="h-11 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-widest text-white">조회</button>
        </div>
      </div>

      <div className="overflow-x-auto bg-surface-container-lowest shadow-ghost">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              {sortableHeaders.map((head) => (
                <th key={head.key} className="px-5 py-4 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort(head.key)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-outline hover:text-on-surface"
                  >
                    {head.label}
                    <span className="material-symbols-outlined text-sm">{sortIndicator(head.key)}</span>
                  </button>
                </th>
              ))}
              <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">역할</th>
              <th className="px-5 py-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-outline">불러오는 중...</td></tr>
            ) : sortedUsers.map((user) => {
              const isSaving = savingId === user.id;
              return (
                <tr key={user.id} className="hover:bg-surface-container-low">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-on-surface">{user.full_name || "이름 없음"}</p>
                    <p className="text-xs text-outline">{user.email || user.id}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.is_admin ? "bg-primary/10 text-primary" : "bg-surface-container-low text-outline"}`}>
                      {user.is_admin ? "관리자" : "일반"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-on-surface-variant">{formatDate(user.last_login_at)}</td>
                  <td className="px-5 py-4 font-semibold text-on-surface">{user.login_count ?? 0}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {userRoles(user).map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-surface-container-low px-2.5 py-1 text-[11px] font-bold text-on-surface-variant"
                        >
                          {role === "photographer" ? "사진작가" : "바이어"}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setAdmin(user, !user.is_admin)}
                      disabled={isSaving}
                      className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest transition-opacity disabled:opacity-50 ${
                        user.is_admin ? "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high" : "bg-primary text-white hover:opacity-90"
                      }`}
                    >
                      {isSaving ? "저장 중" : user.is_admin ? "권한 회수" : "관리자 부여"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
