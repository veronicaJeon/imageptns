"use client";

import { useCallback, useEffect, useState } from "react";

type ApplicationStatusFilter = "pending" | "approved" | "rejected" | "all";

interface PhotographerApplication {
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
  email: string;
  profile: {
    full_name: string | null;
    organization: string | null;
    photographer_status: "none" | "pending" | "approved" | "suspended";
    phone_number: string | null;
    primary_activity_regions: string[] | null;
  } | null;
}

const STATUS_LABELS: Record<PhotographerApplication["status"], string> = {
  pending: "승인대기",
  approved: "승인됨",
  rejected: "거절됨",
};

const STATUS_STYLES: Record<PhotographerApplication["status"], string> = {
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-200",
  approved: "bg-primary/10 text-primary",
  rejected: "bg-error/10 text-error",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminPhotographerApplicationsPage() {
  const [applications, setApplications] = useState<PhotographerApplication[]>([]);
  const [status, setStatus] = useState<ApplicationStatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/photographer-applications?${params.toString()}`);
      const body = await res.json().catch(() => null) as { applications?: PhotographerApplication[]; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "사진작가 신청 목록을 불러오지 못했습니다.");
      setApplications(body?.applications ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진작가 신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  async function reviewApplication(application: PhotographerApplication, action: "approve" | "reject") {
    const adminNote = prompt("관리자 메모를 입력하세요. 신청자에게는 공개되지 않습니다.")?.trim() ?? "";
    const rejectionReason = action === "reject"
      ? prompt("거절 사유를 입력하세요. 신청자에게 안내됩니다.")?.trim() ?? ""
      : "";

    if (action === "reject" && !rejectionReason) return;
    if (!confirm(`${application.applicant_name} 신청을 ${action === "approve" ? "승인" : "거절"}할까요?`)) return;

    setReviewingId(application.id);
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
      const body = await res.json().catch(() => null) as { application?: PhotographerApplication; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "검토 결과를 저장하지 못했습니다.");

      if (status === "pending") {
        setApplications((current) => current.filter((row) => row.id !== application.id));
      } else if (body?.application) {
        setApplications((current) => current.map((row) => row.id === application.id ? body.application! : row));
      } else {
        await loadApplications();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "검토 결과를 저장하지 못했습니다.");
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">사진작가 승인</h1>
          <p className="mt-1 text-sm text-outline">사진작가 가입과 재신청을 검토하고 승인 또는 거절합니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["pending", "approved", "rejected", "all"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              className={[
                "rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors",
                status === value ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low",
              ].join(" ")}
            >
              {value === "all" ? "전체" : STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-outline-variant/20">
              {["신청자", "연락/지역", "소개", "상태", "처리"].map((head) => (
                <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {loading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-outline">불러오는 중...</td></tr>
            ) : applications.length === 0 ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-outline">신청 내역이 없습니다.</td></tr>
            ) : applications.map((application) => (
              <tr key={application.id} className="align-top">
                <td className="px-5 py-4">
                  <p className="font-semibold text-on-surface">{application.applicant_name}</p>
                  <p className="mt-1 truncate text-xs text-outline">{application.email || application.profile_id}</p>
                  <p className="mt-2 text-xs text-on-surface-variant">{application.organization ?? application.profile?.organization ?? "소속 없음"}</p>
                  <p className="mt-2 text-[10px] text-outline">접수 {formatDate(application.created_at)}</p>
                </td>
                <td className="px-5 py-4">
                  <p className="text-sm text-on-surface">{application.phone_number ?? application.profile?.phone_number ?? "연락처 없음"}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(application.primary_activity_regions?.length
                      ? application.primary_activity_regions
                      : application.profile?.primary_activity_regions ?? []
                    ).map((region) => (
                      <span key={region} className="rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-bold text-on-surface-variant">
                        {region}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="line-clamp-4 text-xs leading-relaxed text-on-surface-variant">{application.bio || "소개 없음"}</p>
                  {application.rejection_reason && (
                    <p className="mt-2 text-xs text-error">거절 사유: {application.rejection_reason}</p>
                  )}
                  {application.admin_note && (
                    <p className="mt-2 text-xs text-outline">관리자 메모: {application.admin_note}</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[application.status]}`}>
                    {STATUS_LABELS[application.status]}
                  </span>
                  {application.reviewed_at && (
                    <p className="mt-2 text-[10px] text-outline">검토 {formatDate(application.reviewed_at)}</p>
                  )}
                </td>
                <td className="px-5 py-4">
                  {application.status === "pending" ? (
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => reviewApplication(application, "approve")}
                        disabled={reviewingId === application.id}
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewApplication(application, "reject")}
                        disabled={reviewingId === application.id}
                        className="rounded-lg border border-error/30 px-3 py-2 text-xs font-bold uppercase tracking-widest text-error hover:bg-error/10 disabled:opacity-50"
                      >
                        거절
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-outline">처리 완료</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
