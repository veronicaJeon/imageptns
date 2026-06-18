"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { useLang } from "@/lib/i18n/store";

type MatchDecision = "interested" | "declined";

interface ContactPhotoRequest {
  id: string;
  subject: string | null;
  message: string | null;
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
  requester_organization: string | null;
  usage_project: string | null;
  usage_context: string | null;
  request_status: string;
  created_at: string;
}

interface PhotoRequestMatch {
  id: string;
  contact_submission_id: string;
  photographer_id: string;
  status: "candidate" | "invited" | "interested" | "declined" | string;
  score: number | null;
  reason: string | null;
  created_at: string;
  updated_at: string | null;
  request: ContactPhotoRequest | ContactPhotoRequest[] | null;
}

const STATUS_STYLES: Record<string, string> = {
  candidate: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  invited: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300",
  interested: "bg-primary/10 text-primary",
  declined: "bg-surface-container text-outline",
};

const PHOTOGRAPHER_REQUESTS_COPY = {
  ko: {
    locale: "ko-KR",
    statuses: { candidate: "검토 대기", invited: "확인 요청", interested: "가능", declined: "불가" },
    fetchError: "운영팀 요청을 불러오지 못했습니다.",
    saveError: "응답을 저장하지 못했습니다.",
    onlyPhotographerTitle: "사진가 전용 메뉴입니다",
    onlyPhotographerBody: "운영팀 요청은 사진가 계정에서 확인할 수 있습니다.",
    title: "운영팀 요청",
    intro: "Image Partners 운영팀이 이미지 보유 여부나 촬영 가능성을 확인하기 위해 보낸 요청입니다. 구매자와 직접 연결되는 매칭이 아닙니다.",
    empty: "운영팀 요청이 없습니다.",
    fallbackTitle: "운영팀 요청",
    noBrief: "상세 브리프 없음",
    fitScore: "지역 적합도",
    organization: "요청자 소속",
    project: "사용 프로젝트",
    deadline: "희망 회신일",
    context: "사용 맥락",
    legacyInfo: "기존 보조정보",
    location: "위치",
    category: "카테고리",
    budget: "예산",
    region: "지역",
    tags: "태그",
    reference: "참고 자료",
    interested: "가능",
    declined: "불가",
    minBudget: (value: string) => `${value} 이상`,
    maxBudget: (value: string) => `${value} 이하`,
  },
  en: {
    locale: "en-US",
    statuses: { candidate: "Pending review", invited: "Response requested", interested: "Available", declined: "Unavailable" },
    fetchError: "Could not load team requests.",
    saveError: "Could not save your response.",
    onlyPhotographerTitle: "Photographer-only menu",
    onlyPhotographerBody: "Team requests are available only to photographer accounts.",
    title: "Team requests",
    intro: "Requests from the Image Partners operations team to check whether you may have relevant images or shooting availability. This is an internal process, not a direct buyer match.",
    empty: "No team requests.",
    fallbackTitle: "Team request",
    noBrief: "No detailed brief",
    fitScore: "Region fit score",
    organization: "Requester organization",
    project: "Usage project",
    deadline: "Preferred response date",
    context: "Usage context",
    legacyInfo: "Additional legacy info",
    location: "Location",
    category: "Category",
    budget: "Budget",
    region: "Regions",
    tags: "Tags",
    reference: "Reference material",
    interested: "Available",
    declined: "Unavailable",
    minBudget: (value: string) => `${value} or more`,
    maxBudget: (value: string) => `${value} or less`,
  },
} as const;

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatDate(iso: string | null | undefined, locale: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatKRW(value: number | null | undefined, locale: string) {
  if (value == null) return "-";
  return "₩" + value.toLocaleString(locale);
}

function formatBudget(request: ContactPhotoRequest, locale: string, copy: typeof PHOTOGRAPHER_REQUESTS_COPY.ko | typeof PHOTOGRAPHER_REQUESTS_COPY.en) {
  if (request.budget_min_krw == null && request.budget_max_krw == null) return "-";
  if (request.budget_min_krw != null && request.budget_max_krw != null) {
    return `${formatKRW(request.budget_min_krw, locale)} - ${formatKRW(request.budget_max_krw, locale)}`;
  }
  return request.budget_min_krw != null
    ? copy.minBudget(formatKRW(request.budget_min_krw, locale))
    : copy.maxBudget(formatKRW(request.budget_max_krw, locale));
}

export default function DashboardRequestsPage() {
  const { lang } = useLang();
  const copy = PHOTOGRAPHER_REQUESTS_COPY[lang];
  const [matches, setMatches] = useState<PhotoRequestMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/contact/matches");
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const body = await res.json().catch(() => null) as { matches?: PhotoRequestMatch[]; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? copy.fetchError);
      setMatches(body?.matches ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : copy.fetchError);
    } finally {
      setLoading(false);
    }
  }, [copy.fetchError]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  async function respond(match: PhotoRequestMatch, status: MatchDecision) {
    setActioning(match.id);
    try {
      const res = await fetch("/api/contact/matches", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: match.id, status }),
      });
      const body = await res.json().catch(() => null) as { match?: PhotoRequestMatch; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? copy.saveError);
      if (body?.match) {
        setMatches((prev) => prev.map((row) => row.id === match.id ? body.match! : row));
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : copy.saveError);
    } finally {
      setActioning(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-6 md:p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <h1 className="font-headline text-xl font-extrabold text-on-surface">{copy.onlyPhotographerTitle}</h1>
        <p className="text-sm">{copy.onlyPhotographerBody}</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl">
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">Image Partners Ops</p>
        <h1 className="mt-2 font-headline text-2xl font-extrabold tracking-tight text-on-surface">{copy.title}</h1>
        <p className="mt-2 text-sm text-outline">
          {copy.intro}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline bg-surface-container-lowest shadow-ghost">
          <span className="material-symbols-outlined text-6xl">assignment</span>
          <p className="text-base">{copy.empty}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {matches.map((match) => {
            const request = first(match.request);
            const isBusy = actioning === match.id;
            if (!request) return null;

            return (
              <article key={match.id} className="bg-surface-container-lowest shadow-ghost rounded-xl overflow-hidden">
                <div className="p-5 flex flex-col gap-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-xl">add_photo_alternate</span>
                        <h2 className="font-headline text-lg font-bold text-on-surface">{request.subject ?? copy.fallbackTitle}</h2>
                        <span className={cn("rounded-full px-3 py-1 text-[10px] font-bold", STATUS_STYLES[match.status] ?? "bg-surface-container text-outline")}>
                          {copy.statuses[match.status as keyof typeof copy.statuses] ?? match.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-on-surface-variant whitespace-pre-wrap">
                        {request.message ?? copy.noBrief}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-lg bg-surface-container-low px-4 py-3 text-xs text-on-surface-variant">
                      <p className="font-bold text-on-surface">{copy.fitScore} {match.score ?? "-"}</p>
                      {match.reason && <p className="mt-1 max-w-56">{match.reason}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4 text-sm md:grid-cols-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.organization}</p>
                      <p className="mt-1 text-on-surface">{request.requester_organization ?? "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.project}</p>
                      <p className="mt-1 text-on-surface">{request.usage_project ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.deadline}</p>
                      <p className="mt-1 text-on-surface">{formatDate(request.deadline_at, copy.locale)}</p>
                    </div>
                    <div className="md:col-span-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.context}</p>
                      <p className="mt-1 text-on-surface-variant">
                        {request.usage_context ?? "-"}
                      </p>
                    </div>
                    {(request.location_label || request.category || formatBudget(request, copy.locale, copy) !== "-" || (request.target_regions ?? []).length > 0 || (request.tags ?? []).length > 0) && (
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.legacyInfo}</p>
                        <p className="mt-1 text-on-surface-variant">
                          {copy.location} {request.location_label ?? "-"} · {copy.category} {request.category ?? "-"} · {copy.budget} {formatBudget(request, copy.locale, copy)}
                        </p>
                        {((request.target_regions ?? []).length > 0 || (request.tags ?? []).length > 0) && (
                          <p className="mt-1 text-on-surface-variant">
                            {copy.region} {request.target_regions?.join(", ") || "-"} · {copy.tags} {request.tags?.join(", ") || "-"}
                          </p>
                        )}
                      </div>
                    )}
                    {(request.reference_url || request.reference_note) && (
                      <div className="md:col-span-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{copy.reference}</p>
                        {request.reference_url && (
                          <a href={request.reference_url} target="_blank" rel="noreferrer" className="mt-1 block text-primary hover:underline">
                            {request.reference_url}
                          </a>
                        )}
                        {request.reference_note && (
                          <p className="mt-1 text-on-surface-variant">{request.reference_note}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {match.status !== "interested" && (
                      <button
                        onClick={() => respond(match, "interested")}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 rounded bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                        )}
                        {copy.interested}
                      </button>
                    )}
                    {match.status !== "declined" && (
                      <button
                        onClick={() => respond(match, "declined")}
                        disabled={isBusy}
                        className="flex items-center gap-1.5 rounded border border-outline-variant px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-error hover:text-error disabled:opacity-50"
                      >
                        {isBusy ? (
                          <span className="h-3.5 w-3.5 rounded-full border-2 border-outline border-t-transparent animate-spin" />
                        ) : (
                          <span className="material-symbols-outlined text-sm">cancel</span>
                        )}
                        {copy.declined}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
