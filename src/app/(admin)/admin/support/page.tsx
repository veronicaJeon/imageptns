"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type SupportStatus = "pending" | "in_progress" | "resolved";
type SupportTab = SupportStatus | "all";
type SupportPriority = "low" | "normal" | "high" | "urgent";
type SupportKind = "all" | "general" | "photo";

const TABS: { key: SupportTab; label: string; icon: string }[] = [
  { key: "pending", label: "대기 중", icon: "pending_actions" },
  { key: "in_progress", label: "검토 중", icon: "support_agent" },
  { key: "resolved", label: "답변 완료", icon: "check_circle" },
  { key: "all", label: "전체", icon: "grid_view" },
];

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  in_progress: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
  resolved: "bg-primary/10 text-primary",
  submitted: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  matching: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
  fulfilled: "bg-primary/10 text-primary",
  rejected: "bg-error/10 text-error",
  cancelled: "bg-surface-container text-outline",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "대기 중",
  in_progress: "검토 중",
  resolved: "답변 완료",
  submitted: "접수됨",
  matching: "매칭 중",
  fulfilled: "답변 완료",
  rejected: "거절",
  cancelled: "취소",
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-surface-container text-outline",
  normal: "bg-surface-container-low text-on-surface-variant",
  high: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  urgent: "bg-error/10 text-error",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "낮음",
  normal: "보통",
  high: "높음",
  urgent: "긴급",
};

const MATCH_STATUS_STYLES: Record<string, string> = {
  candidate: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  invited: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300",
  interested: "bg-primary/10 text-primary",
  declined: "bg-surface-container text-outline",
};

const MATCH_STATUS_LABELS: Record<string, string> = {
  candidate: "후보",
  invited: "초대됨",
  interested: "관심 있음",
  declined: "거절",
};

const RIGHTS_RESULT_LABELS: Record<string, string> = {
  usable: "사용 가능",
  conditional: "조건부 가능",
  unverified: "확인 불가",
  not_recommended: "사용 비권장",
};

interface PhotoMatch {
  id: string;
  photographer_id: string;
  status: string;
  score: number | null;
  reason: string | null;
}

interface SourcingCandidate {
  id: string;
  image_id: string;
  sort_order: number;
  is_visible: boolean;
  note: string | null;
  image?: {
    id: string;
    asset_id: string | null;
    title: string | null;
    storage_path_preview: string | null;
    is_published?: boolean | null;
  } | null;
}

interface SourcingAnswer {
  id: string;
  answer_text: string | null;
  rights_result: string | null;
  rights_explanation: string | null;
  status: "draft" | "published" | string;
  revision_round: number;
  published_at: string | null;
  created_at: string;
  candidates?: SourcingCandidate[] | null;
}

interface PhotoRequestDetail {
  id: string;
  title: string | null;
  brief: string | null;
  location_label: string | null;
  target_regions: string[] | null;
  category: string | null;
  tags: string[] | null;
  usage_intent: string | null;
  license_intent: string | null;
  budget_min_krw: number | null;
  budget_max_krw: number | null;
  deadline_at: string | null;
  reference_url: string | null;
  reference_note: string | null;
  non_copying_attested: boolean | null;
  requester_organization: string | null;
  requester_phone: string | null;
  usage_project: string | null;
  usage_context: string | null;
  sourcing_purposes: string[] | null;
  matches: PhotoMatch[];
  answers?: SourcingAnswer[] | null;
}

interface SupportSubmission {
  id: string;
  kind: "general" | "photo_request";
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  status_group: SupportStatus;
  priority: SupportPriority | string | null;
  admin_note: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  assignee?: { id: string; full_name: string | null } | null;
  photo_request?: PhotoRequestDetail;
}

interface PhotographerCandidate {
  id: string;
  full_name: string | null;
  organization: string | null;
  bio: string | null;
  primary_activity_regions: string[] | null;
}

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKRW(value?: number | null) {
  if (value == null) return "-";
  return "₩" + value.toLocaleString("ko-KR");
}

function formatBudget(request: PhotoRequestDetail) {
  if (request.budget_min_krw == null && request.budget_max_krw == null) return "-";
  if (request.budget_min_krw != null && request.budget_max_krw != null) {
    return `${formatKRW(request.budget_min_krw)} - ${formatKRW(request.budget_max_krw)}`;
  }
  return request.budget_min_krw != null
    ? `${formatKRW(request.budget_min_krw)} 이상`
    : `${formatKRW(request.budget_max_krw)} 이하`;
}

function displayList(values?: string[] | null) {
  return (values ?? []).filter(Boolean);
}

const SOURCING_PURPOSE_LABELS: Record<string, string> = {
  rights_check: "동일 사진 권리 확인",
  similar_search: "유사 사진 탐색",
  supply_check: "보유 이미지 확인",
  context_reference: "설명 참고",
  shooting_request: "신규 촬영 검토",
};

function shortId(value: string) {
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function candidateMatchIds(matches?: PhotoMatch[] | null) {
  return (matches ?? [])
    .filter((match) => match.status === "candidate")
    .map((match) => match.id);
}

function latestSourcingAnswer(answers?: SourcingAnswer[] | null) {
  return [...(answers ?? [])].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  )[0] ?? null;
}

function PhotographerCandidatePicker({
  requestId,
  disabled,
  onAdded,
}: {
  requestId: string;
  disabled: boolean;
  onAdded: () => Promise<void>;
}) {
  const [region, setRegion] = useState("");
  const [query, setQuery] = useState("");
  const [photographers, setPhotographers] = useState<PhotographerCandidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  async function searchPhotographers() {
    setSearching(true);
    try {
      const params = new URLSearchParams({ region, q: query });
      const response = await fetch(`/api/admin/photographers/search?${params}`);
      const body = await response.json().catch(() => null) as { photographers?: PhotographerCandidate[]; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "사진가 목록을 불러오지 못했습니다.");
      setPhotographers(body?.photographers ?? []);
      setSelectedIds([]);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진가 목록을 불러오지 못했습니다.");
    } finally {
      setSearching(false);
    }
  }

  async function addSelected() {
    if (selectedIds.length === 0) return;
    setAdding(true);
    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_selected_photo_request_matches",
          requestId,
          photographerIds: selectedIds,
          targetRegions: region.split(/[,\n]/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const body = await response.json().catch(() => null) as { inserted?: number; skipped?: number; error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "선택한 사진가를 후보로 추가하지 못했습니다.");
      alert(`사진가 ${body?.inserted ?? 0}명을 후보로 추가했습니다.${body?.skipped ? ` 중복/제외 ${body.skipped}명` : ""}`);
      setSelectedIds([]);
      await onAdded();
    } catch (error) {
      alert(error instanceof Error ? error.message : "선택한 사진가를 후보로 추가하지 못했습니다.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input
          value={region}
          onChange={(event) => setRegion(event.target.value)}
          placeholder="지역 조건 (예: 서울, 경기)"
          className="h-10 rounded-lg bg-surface-container-lowest px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchPhotographers(); } }}
          placeholder="이름·소속·특징 검색 (선택)"
          className="h-10 rounded-lg bg-surface-container-lowest px-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={searchPhotographers}
          disabled={disabled || searching}
          className="flex h-10 items-center justify-center gap-1.5 rounded bg-on-surface px-4 text-xs font-bold text-surface disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">search</span>
          {searching ? "검색 중" : "사진가 검색"}
        </button>
      </div>

      {photographers.length > 0 && (
        <div className="mt-3 max-h-72 divide-y divide-outline-variant/30 overflow-y-auto rounded-lg border border-outline-variant/30">
          {photographers.map((photographer) => (
            <label key={photographer.id} className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface-container-low">
              <input
                type="checkbox"
                checked={selectedIds.includes(photographer.id)}
                onChange={(event) => setSelectedIds((current) => event.target.checked
                  ? [...current, photographer.id]
                  : current.filter((id) => id !== photographer.id))}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-on-surface">
                  {photographer.full_name || "이름 미등록"}
                  {photographer.organization ? ` · ${photographer.organization}` : ""}
                </span>
                <span className="mt-0.5 block text-xs text-primary">
                  소속 지역: {(photographer.primary_activity_regions ?? []).join(", ") || "미등록"}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs text-on-surface-variant">
                  특징: {photographer.bio || "등록된 소개가 없습니다."}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {photographers.length > 0 && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-outline">{photographers.length}명 확인 · {selectedIds.length}명 선택</p>
          <button
            type="button"
            onClick={addSelected}
            disabled={disabled || adding || selectedIds.length === 0}
            className="rounded bg-primary px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {adding ? "추가 중..." : "선택 사진가를 후보로 추가"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminSupportPage() {
  const pathname = usePathname();
  const fixedKind: SupportKind = pathname.startsWith("/admin/photo-requests") ? "photo" : "general";
  const [tab, setTab] = useState<SupportTab>("pending");
  const [kind] = useState<SupportKind>(fixedKind);
  const [submissions, setSubmissions] = useState<SupportSubmission[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, {
    answerText: string;
    rightsResult: string;
    rightsExplanation: string;
    imageIds: string;
  }>>({});

  const fetchSubmissions = useCallback(async (status: SupportTab, selectedKind: SupportKind) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/support?status=${status}&kind=${selectedKind}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "문의 내역을 불러오지 못했습니다.");
      }

      const { submissions: rows } = await res.json() as { submissions?: SupportSubmission[] };
      const nextRows = rows ?? [];
      setSubmissions(nextRows);
      setNotes(Object.fromEntries(nextRows.map((row) => [row.id, row.admin_note ?? ""])));
      setAnswerDrafts(Object.fromEntries(nextRows.map((row) => {
        const latest = latestSourcingAnswer(row.photo_request?.answers);
        return [row.id, {
          answerText: latest?.answer_text ?? "",
          rightsResult: latest?.rights_result ?? "",
          rightsExplanation: latest?.rights_explanation ?? "",
          imageIds: (latest?.candidates ?? []).map((candidate) => candidate.image_id).join(", "),
        }];
      })));
    } catch (error) {
      alert(error instanceof Error ? error.message : "문의 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(tab, kind); }, [tab, kind, fetchSubmissions]);

  async function updateSubmission(
    submission: SupportSubmission,
    patch: Partial<Pick<SupportSubmission, "status" | "priority" | "admin_note" | "assigned_to">>
  ) {
    setActioning(submission.id);
    try {
      const body: Record<string, unknown> = { id: submission.id };
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.priority !== undefined) body.priority = patch.priority;
      if (patch.admin_note !== undefined) body.admin_note = patch.admin_note;
      if (patch.assigned_to !== undefined) body.assigned_to = patch.assigned_to;

      const res = await fetch("/api/admin/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? "문의 상태를 저장하지 못했습니다.");
      }

      const { submission: updated, emailDelivery } = await res.json() as {
        submission: SupportSubmission;
        emailDelivery?: "sent" | "failed" | "skipped" | "unchanged";
      };
      setNotes((prev) => ({ ...prev, [updated.id]: updated.admin_note ?? "" }));
      if (emailDelivery === "failed") {
        alert("상태는 저장되었지만 고객 알림 이메일 발송에 실패했습니다. 이메일 설정을 확인해주세요.");
      }
      await fetchSubmissions(tab, kind);
    } catch (error) {
      alert(error instanceof Error ? error.message : "문의 상태를 저장하지 못했습니다.");
    } finally {
      setActioning(null);
    }
  }

  async function createMatches(submission: SupportSubmission) {
    if (submission.kind !== "photo_request") return;
    setActioning(submission.id);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_photo_request_matches",
          requestId: submission.id,
        }),
      });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await res.json().catch(() => null) as { error?: string; inserted?: number; skipped?: number } | null;
      if (!res.ok) throw new Error(body?.error ?? "사진가 매칭에 실패했습니다.");
      alert(`사진가 ${body?.inserted ?? 0}명에게 매칭했습니다.${body?.skipped ? ` 중복 ${body.skipped}건은 제외했습니다.` : ""}`);
      await fetchSubmissions(tab, kind);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진가 매칭에 실패했습니다.");
    } finally {
      setActioning(null);
    }
  }

  async function sendInvites(submission: SupportSubmission) {
    if (submission.kind !== "photo_request") return;
    const matchIds = candidateMatchIds(submission.photo_request?.matches);
    if (matchIds.length === 0) {
      alert("초대할 후보가 없습니다. 후보를 먼저 생성하거나 이미 초대된 후보 상태를 확인하세요.");
      return;
    }

    setActioning(submission.id);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_photo_request_invites",
          requestId: submission.id,
          matchIds,
        }),
      });
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await res.json().catch(() => null) as {
        error?: string;
        sent?: number;
        invited?: number;
        skipped?: unknown[];
      } | null;
      if (!res.ok) throw new Error(body?.error ?? "사진가 초대 메일 발송에 실패했습니다.");
      alert(`초대 메일 ${body?.sent ?? 0}건을 발송했고, 후보 ${body?.invited ?? 0}명을 초대 상태로 변경했습니다.${body?.skipped?.length ? ` 스킵 ${body.skipped.length}건` : ""}`);
      await fetchSubmissions(tab, kind);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진가 초대 메일 발송에 실패했습니다.");
    } finally {
      setActioning(null);
    }
  }

  async function saveSourcingDraft(submission: SupportSubmission) {
    if (submission.kind !== "photo_request") return;
    const draft = answerDrafts[submission.id] ?? {
      answerText: "",
      rightsResult: "",
      rightsExplanation: "",
      imageIds: "",
    };

    setActioning(submission.id);
    try {
      const saveRes = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_sourcing_answer_draft",
          requestId: submission.id,
          answerText: draft.answerText,
          rightsResult: draft.rightsResult || null,
          rightsExplanation: draft.rightsExplanation || null,
        }),
      });
      const saveBody = await saveRes.json().catch(() => null) as { answer?: SourcingAnswer; error?: string } | null;
      if (!saveRes.ok || !saveBody?.answer?.id) {
        throw new Error(saveBody?.error ?? "답변 초안을 저장하지 못했습니다.");
      }

      const imageIds = draft.imageIds.split(",").map((id) => id.trim()).filter(Boolean);
      const candidateRes = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_sourcing_candidates",
          answerId: saveBody.answer.id,
          imageIds,
        }),
      });
      const candidateBody = await candidateRes.json().catch(() => null) as { error?: string } | null;
      if (!candidateRes.ok) {
        throw new Error(candidateBody?.error ?? "후보 이미지를 저장하지 못했습니다.");
      }

      await fetchSubmissions(tab, kind);
    } catch (error) {
      alert(error instanceof Error ? error.message : "답변 초안을 저장하지 못했습니다.");
    } finally {
      setActioning(null);
    }
  }

  async function publishLatestSourcingAnswer(submission: SupportSubmission) {
    if (submission.kind !== "photo_request") return;
    const latest = latestSourcingAnswer(submission.photo_request?.answers);
    if (!latest || latest.status !== "draft") {
      alert("발송할 답변 초안이 없습니다. 먼저 초안을 저장해주세요.");
      return;
    }

    setActioning(submission.id);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "publish_sourcing_answer",
          answerId: latest.id,
        }),
      });
      const body = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "답변을 발송하지 못했습니다.");
      await fetchSubmissions(tab, kind);
    } catch (error) {
      alert(error instanceof Error ? error.message : "답변을 발송하지 못했습니다.");
    } finally {
      setActioning(null);
    }
  }

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
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
          {fixedKind === "photo" ? "사진 문의 운영" : "일반 문의"}
        </h1>
        <p className="text-sm text-outline mt-1">
          {!loading && `${submissions.length}건의 항목이 표시됩니다`}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex gap-1 bg-surface-container-lowest p-1 rounded-xl w-fit shadow-ghost overflow-x-auto max-w-full">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap",
                tab === key
                  ? "bg-primary text-white shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">support_agent</span>
          <p className="text-base">
            {tab === "pending" ? "대기 중인 문의가 없습니다." : "문의 내역이 없습니다."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {submissions.map((submission) => {
            const isBusy = actioning === submission.id;
            const noteValue = notes[submission.id] ?? "";
            const isPhotoRequest = submission.kind === "photo_request";
            const photoRequest = submission.photo_request;
            const matchCount = photoRequest?.matches?.length ?? 0;
            const candidateCount = candidateMatchIds(photoRequest?.matches).length;

            return (
              <div
                key={submission.id}
                className={cn(
                  "bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden border",
                  isPhotoRequest ? "border-primary/30 border-l-4" : "border-transparent"
                )}
              >
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn("material-symbols-outlined text-base", isPhotoRequest ? "text-primary" : "text-on-surface-variant")}>
                          {isPhotoRequest ? "add_photo_alternate" : "person"}
                        </span>
                        <h2 className="font-headline font-bold text-base text-on-surface truncate">
                          {submission.name || "Unknown"}
                        </h2>
                        {submission.email ? (
                          <a
                            href={`mailto:${submission.email}`}
                            className="text-xs text-outline hover:text-primary transition-colors truncate"
                          >
                            {submission.email}
                          </a>
                        ) : (
                          <span className="text-xs text-outline">로그인 바이어</span>
                        )}
                      </div>
                      <p className="text-xs text-outline mt-1">접수일 {formatDate(submission.created_at)}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className={cn(
                        "text-[10px] font-bold px-3 py-1 rounded-full",
                        isPhotoRequest ? "bg-primary/10 text-primary" : "bg-surface-container text-on-surface-variant"
                      )}>
                        {isPhotoRequest ? "사진 의뢰" : "일반 문의"}
                      </span>
                      <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full", PRIORITY_STYLES[submission.priority ?? "normal"] ?? PRIORITY_STYLES.normal)}>
                        {PRIORITY_LABELS[submission.priority ?? "normal"] ?? submission.priority}
                      </span>
                      <span className={cn("text-[10px] font-bold px-3 py-1 rounded-full", STATUS_STYLES[submission.status] ?? STATUS_STYLES[submission.status_group] ?? "bg-surface-container text-outline")}>
                        {STATUS_LABELS[submission.status] ?? submission.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {isPhotoRequest && (
                      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Photo Request Ops</p>
                    )}
                    <p className="font-semibold text-on-surface">{submission.subject || "제목 없음"}</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                      {submission.message || "내용 없음"}
                    </p>
                  </div>

                  {isPhotoRequest && photoRequest && (
                    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">의뢰 운영 정보</p>
                          <p className="mt-1 text-xs text-on-surface-variant">request_status: {submission.status}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", STATUS_STYLES[submission.status] ?? "bg-surface-container text-outline")}>
                            {STATUS_LABELS[submission.status] ?? submission.status}
                          </span>
                          <span className="rounded-full bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
                            후보 {matchCount}명
                          </span>
                          {candidateCount > 0 && (
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:bg-amber-900/20 dark:text-amber-300">
                              초대 가능 {candidateCount}명
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">요청자 소속</p>
                        <p className="mt-1 text-on-surface">{photoRequest.requester_organization ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">휴대전화번호</p>
                        <p className="mt-1 text-on-surface">{photoRequest.requester_phone ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">사용 프로젝트</p>
                        <p className="mt-1 text-on-surface">{photoRequest.usage_project ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">희망 회신일</p>
                        <p className="mt-1 text-on-surface">{formatDate(photoRequest.deadline_at)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">활용 방식</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {displayList(photoRequest.sourcing_purposes).length > 0 ? displayList(photoRequest.sourcing_purposes).map((purpose) => (
                            <span key={purpose} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                              {SOURCING_PURPOSE_LABELS[purpose] ?? purpose}
                            </span>
                          )) : <span className="text-xs text-outline">-</span>}
                        </div>
                      </div>
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">사용 맥락</p>
                        <p className="mt-1 whitespace-pre-wrap text-on-surface">{photoRequest.usage_context ?? "-"}</p>
                      </div>
                      {(photoRequest.reference_url || photoRequest.reference_note) ? (
                        <div className="md:col-span-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">참고 URL/설명</p>
                          {photoRequest.reference_url && (
                            <a href={photoRequest.reference_url} target="_blank" rel="noreferrer" className="mt-1 block break-all text-primary hover:underline">
                              {photoRequest.reference_url}
                            </a>
                          )}
                          {photoRequest.reference_note && (
                            <p className="mt-1 text-on-surface-variant whitespace-pre-wrap">{photoRequest.reference_note}</p>
                          )}
                        </div>
                      ) : (
                        <div className="md:col-span-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">참고 URL/설명</p>
                          <p className="mt-1 text-xs text-outline">-</p>
                        </div>
                      )}
                      {(photoRequest.location_label || photoRequest.category || photoRequest.usage_intent || photoRequest.license_intent || formatBudget(photoRequest) !== "-" || displayList(photoRequest.target_regions).length > 0 || displayList(photoRequest.tags).length > 0) && (
                        <div className="md:col-span-4 rounded-lg bg-surface-container-lowest p-3">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline">기존 보조정보</p>
                          <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                            위치 {photoRequest.location_label ?? "-"} · 카테고리 {photoRequest.category ?? "-"} · 예산 {formatBudget(photoRequest)} · 사용/라이선스 {[photoRequest.usage_intent, photoRequest.license_intent].filter(Boolean).join(" / ") || "-"}
                          </p>
                          {(displayList(photoRequest.target_regions).length > 0 || displayList(photoRequest.tags).length > 0) && (
                            <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                              지역 {displayList(photoRequest.target_regions).join(", ") || "-"} · 태그 {displayList(photoRequest.tags).join(", ") || "-"}
                            </p>
                          )}
                        </div>
                      )}
                      </div>
                    </div>
                  )}

                  {isPhotoRequest && photoRequest && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">구매자 답변 초안</p>
                          <p className="mt-1 text-xs text-on-surface-variant">
                            후보 이미지는 등록 완료된 이미지 ID를 쉼표로 입력합니다. 답변 발송 전까지 구매자에게 공개되지 않습니다.
                          </p>
                        </div>
                        {latestSourcingAnswer(photoRequest.answers) && (
                          <span className="rounded-full bg-surface-container-lowest px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
                            최근 답변 {latestSourcingAnswer(photoRequest.answers)?.status === "published" ? "발송됨" : "초안"}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-outline">답변 내용</label>
                          <textarea
                            value={answerDrafts[submission.id]?.answerText ?? ""}
                            onChange={(event) => setAnswerDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                answerText: event.target.value,
                                rightsResult: prev[submission.id]?.rightsResult ?? "",
                                rightsExplanation: prev[submission.id]?.rightsExplanation ?? "",
                                imageIds: prev[submission.id]?.imageIds ?? "",
                              },
                            }))}
                            rows={4}
                            placeholder="구매자에게 전달할 답변을 입력하세요."
                            className="mt-2 w-full rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-outline">권리 확인 결과</label>
                          <select
                            value={answerDrafts[submission.id]?.rightsResult ?? ""}
                            onChange={(event) => setAnswerDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                answerText: prev[submission.id]?.answerText ?? "",
                                rightsResult: event.target.value,
                                rightsExplanation: prev[submission.id]?.rightsExplanation ?? "",
                                imageIds: prev[submission.id]?.imageIds ?? "",
                              },
                            }))}
                            className="mt-2 h-10 w-full rounded-lg bg-surface-container-lowest px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                          >
                            <option value="">권리 확인 결과 없음</option>
                            {Object.entries(RIGHTS_RESULT_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-widest text-outline">후보 이미지 ID</label>
                          <input
                            value={answerDrafts[submission.id]?.imageIds ?? ""}
                            onChange={(event) => setAnswerDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                answerText: prev[submission.id]?.answerText ?? "",
                                rightsResult: prev[submission.id]?.rightsResult ?? "",
                                rightsExplanation: prev[submission.id]?.rightsExplanation ?? "",
                                imageIds: event.target.value,
                              },
                            }))}
                            placeholder="uuid-1, uuid-2"
                            className="mt-2 h-10 w-full rounded-lg bg-surface-container-lowest px-3 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-outline">권리 확인 설명</label>
                          <textarea
                            value={answerDrafts[submission.id]?.rightsExplanation ?? ""}
                            onChange={(event) => setAnswerDrafts((prev) => ({
                              ...prev,
                              [submission.id]: {
                                answerText: prev[submission.id]?.answerText ?? "",
                                rightsResult: prev[submission.id]?.rightsResult ?? "",
                                rightsExplanation: event.target.value,
                                imageIds: prev[submission.id]?.imageIds ?? "",
                              },
                            }))}
                            rows={2}
                            placeholder="조건부 사용 가능 사유, 출처 표기 조건, 추가 허가 필요 여부 등을 입력하세요."
                            className="mt-2 w-full rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => saveSourcingDraft(submission)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 rounded border border-primary/40 bg-surface-container-lowest px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">save</span>
                          초안 저장
                        </button>
                        <button
                          type="button"
                          onClick={() => publishLatestSourcingAnswer(submission)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 rounded bg-primary px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">send</span>
                          답변 발송
                        </button>
                      </div>
                    </div>
                  )}

                  {isPhotoRequest && photoRequest && (
                    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">후보 사진가 매칭</p>
                        <button
                          onClick={() => createMatches(submission)}
                          disabled={isBusy}
                          className="flex items-center gap-1.5 rounded border border-primary/40 bg-surface-container-lowest px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <span className="material-symbols-outlined text-sm">hub</span>
                          )}
                          {matchCount > 0 ? "후보 재생성" : "후보 생성"}
                        </button>
                        {candidateCount > 0 && (
                          <button
                            onClick={() => sendInvites(submission)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            {isBusy ? (
                              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-sm">outgoing_mail</span>
                            )}
                            후보 초대 메일 발송
                          </button>
                        )}
                      </div>

                      <PhotographerCandidatePicker
                        requestId={submission.id}
                        disabled={isBusy}
                        onAdded={() => fetchSubmissions(tab, kind)}
                      />

                      {matchCount === 0 ? (
                        <p className="text-sm text-outline">아직 생성된 후보가 없습니다. 대상 지역 기반으로 후보를 생성하세요.</p>
                      ) : (
                        <div className="divide-y divide-outline-variant/30 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
                          {photoRequest.matches.map((match) => (
                            <div key={match.id} className="grid grid-cols-1 gap-2 p-3 text-sm md:grid-cols-[minmax(0,1fr)_88px_minmax(0,2fr)] md:items-start">
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-outline">photographer_id</p>
                                <p className="mt-1 font-mono text-xs text-on-surface" title={match.photographer_id}>
                                  {shortId(match.photographer_id)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-outline">점수</p>
                                <p className="mt-1 font-bold text-on-surface">{match.score ?? "-"}</p>
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", MATCH_STATUS_STYLES[match.status] ?? "bg-surface-container text-outline")}>
                                    {MATCH_STATUS_LABELS[match.status] ?? match.status}
                                  </span>
                                  <p className="min-w-0 text-on-surface-variant">{match.reason || "매칭 사유 없음"}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">schedule</span>
                      수정일 {formatDate(submission.updated_at)}
                    </span>
                    {submission.resolved_at && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">task_alt</span>
                        해결일 {formatDate(submission.resolved_at)}
                      </span>
                    )}
                    {submission.assignee?.full_name && (
                      <span className="bg-surface-container-low text-on-surface-variant px-2.5 py-1 rounded-full flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">assignment_ind</span>
                        {submission.assignee.full_name}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-outline">관리자 메모</label>
                    <textarea
                      value={noteValue}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [submission.id]: e.target.value }))}
                      rows={3}
                      placeholder="처리 내용, 후속 조치, 내부 공유 메모를 입력하세요"
                      className="bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline outline-none resize-y min-h-24"
                    />
                    <div className="flex justify-end">
                      <button
                        onClick={() => updateSubmission(submission, { admin_note: noteValue })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-4 py-2 bg-surface-container-lowest border border-outline-variant text-xs font-bold text-on-surface-variant rounded hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        메모 저장
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {submission.status_group !== "in_progress" && (
                      <button
                        onClick={() => updateSubmission(submission, { status: "in_progress" })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-5 py-2.5 border border-blue-500/40 text-blue-600 text-xs font-bold uppercase tracking-widest rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">support_agent</span>
                        )}
                        검토 시작
                      </button>
                    )}
                    {submission.status_group !== "resolved" && (
                      <button
                        onClick={() => updateSubmission(submission, { status: "resolved" })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                        )}
                        답변 완료
                      </button>
                    )}
                    {isPhotoRequest && submission.status_group !== "pending" && (
                      <button
                        onClick={() => updateSubmission(submission, { status: "pending" })}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 px-5 py-2.5 border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest rounded hover:border-amber-500 hover:text-amber-600 transition-colors disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="w-3.5 h-3.5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">undo</span>
                        )}
                        접수로 되돌림
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
