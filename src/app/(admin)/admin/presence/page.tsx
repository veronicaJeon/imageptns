"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminButton, AdminChip, AdminInlineMetrics, AdminListSurface } from "@/components/admin/AdminPrimitives";

interface PresenceRow {
  session_id: string;
  user_id: string | null;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  user?: {
    id: string;
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
  } | null;
}

function shortId(value: string | null | undefined) {
  if (!value) return "Guest";
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function secondsAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  return Math.floor(diff / 1000);
}

function userAgentLabel(userAgent: string | null) {
  if (!userAgent) return "Unknown device";
  if (userAgent.includes("Mobile")) return "Mobile";
  if (userAgent.includes("Macintosh")) return "macOS";
  if (userAgent.includes("Windows")) return "Windows";
  return "Desktop";
}

export default function AdminPresencePage() {
  const [rows, setRows] = useState<PresenceRow[]>([]);
  const [activeWindowSeconds, setActiveWindowSeconds] = useState(120);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const loadPresence = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/presence");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "동시접속자 목록을 불러오지 못했습니다.");
      }

      const data = await res.json() as { users?: PresenceRow[]; activeWindowSeconds?: number };
      setRows(data.users ?? []);
      setActiveWindowSeconds(data.activeWindowSeconds ?? 120);
      setLastRefreshedAt(new Date());
    } catch (error) {
      alert(error instanceof Error ? error.message : "동시접속자 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresence();
    const interval = window.setInterval(loadPresence, 15_000);
    return () => window.clearInterval(interval);
  }, [loadPresence]);

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</h1>
        <p className="text-sm">관리자 계정이 아닙니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">동시접속자</h1>
          <p className="text-sm text-outline mt-1">
            최근 {activeWindowSeconds}초 안에 활동한 세션을 표시합니다. 목록은 15초마다 갱신됩니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshedAt && (
            <span className="text-xs text-outline">갱신 {formatTime(lastRefreshedAt.toISOString())}</span>
          )}
          <AdminButton
            type="button"
            onClick={loadPresence}
            variant="primary"
            size="md"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            새로고침
          </AdminButton>
        </div>
      </div>

      <AdminListSurface className="mb-6 px-4 py-3">
        <AdminInlineMetrics
          className="text-sm"
          items={[
            { label: "Active Sessions", value: rows.length },
            { label: "Signed In", value: rows.filter((row) => row.user_id).length },
            { label: "Guests", value: rows.filter((row) => !row.user_id).length },
          ]}
        />
      </AdminListSurface>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">groups</span>
          <p className="text-base">현재 접속 중인 사용자가 없습니다.</p>
        </div>
      ) : (
        <AdminListSurface className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["사용자", "현재 위치", "기기", "마지막 활동", "세션"].map((header) => (
                  <th key={header} className="px-6 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.map((row) => (
                <tr key={row.session_id} className="align-top hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
                        {row.user?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.user.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-base">person</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-on-surface truncate">
                          {row.user?.full_name || shortId(row.user_id)}
                        </p>
                        <AdminChip tone={row.user_id ? "primary" : "neutral"} className="mt-1">
                          {row.user?.role ?? (row.user_id ? "signed in" : "guest")}
                        </AdminChip>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="max-w-[320px] truncate font-medium text-on-surface">{row.path ?? "/"}</p>
                    {row.referrer && <p className="mt-1 max-w-[320px] truncate text-xs text-outline">from {row.referrer}</p>}
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">
                    <p>{userAgentLabel(row.user_agent)}</p>
                    {row.user_agent && <p className="mt-1 max-w-[220px] truncate text-[10px] text-outline">{row.user_agent}</p>}
                  </td>
                  <td className="px-6 py-4">
                    <AdminChip tone="primary">
                      {secondsAgo(row.last_seen_at)}초 전
                    </AdminChip>
                    <p className="mt-1 text-xs text-outline">첫 접속 {formatTime(row.first_seen_at)}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-[10px] text-outline">
                    {shortId(row.session_id)}
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
