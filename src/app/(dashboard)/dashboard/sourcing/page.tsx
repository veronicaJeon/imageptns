"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buyerUsageConditions, creditLineForName } from "@/lib/licenses/creative-commons";
import { useCart } from "@/lib/store/cart";
import { revisionLimitNotice } from "@/lib/sourcing/status";

const STATUS_LABELS: Record<string, string> = {
  received: "접수됨",
  under_review: "검토 중",
  answer_ready: "후보 제안됨",
  closed: "종료",
};

const RIGHTS_LABELS: Record<string, string> = {
  usable: "사용 가능",
  conditional: "조건부 가능",
  unverified: "확인 불가",
  not_recommended: "사용 비권장",
};

const REVISION_REASONS = [
  { value: "wrong_location", label: "장소가 다름" },
  { value: "wrong_season_or_time", label: "계절/시간대가 다름" },
  { value: "wrong_composition", label: "구도/거리감이 다름" },
  { value: "usage_terms_do_not_fit", label: "상업 사용 조건이 맞지 않음" },
  { value: "price_does_not_fit", label: "가격이 맞지 않음" },
  { value: "need_more_candidates", label: "더 많은 후보가 필요함" },
  { value: "other", label: "기타" },
] as const;

interface CandidateImage {
  id: string;
  asset_id: string | null;
  title: string | null;
  category: string | null;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  photographer_id: string | null;
  photographer_name?: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
}

interface SourcingCandidate {
  id: string;
  image_id: string;
  image: CandidateImage | null;
}

interface SourcingAnswer {
  id: string;
  answer_text: string | null;
  rights_result: string | null;
  rights_explanation: string | null;
  published_at: string | null;
  candidates: SourcingCandidate[] | null;
}

interface SourcingRequest {
  id: string;
  subject: string | null;
  message: string | null;
  created_at: string;
  buyer_sourcing_status: string | null;
  answers: SourcingAnswer[] | null;
  revisions?: Array<{ id: string; round: number }> | null;
}

function latestAnswer(answers?: SourcingAnswer[] | null) {
  return [...(answers ?? [])].sort((a, b) =>
    String(b.published_at ?? "").localeCompare(String(a.published_at ?? ""))
  )[0] ?? null;
}

export default function BuyerSourcingPage() {
  const [requests, setRequests] = useState<SourcingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartAdded, setCartAdded] = useState<string | null>(null);
  const [revisionDrafts, setRevisionDrafts] = useState<Record<string, { reasons: string[]; message: string }>>({});
  const [submittingRevisionId, setSubmittingRevisionId] = useState<string | null>(null);
  const addItem = useCart((state) => state.addItem);

  const loadRequests = useCallback(() => {
    let mounted = true;
    fetch("/api/sourcing/requests")
      .then(async (res) => {
        const body = await res.json().catch(() => null) as { requests?: SourcingRequest[]; error?: string } | null;
        if (!res.ok) throw new Error(body?.error ?? "소싱 요청을 불러오지 못했습니다.");
        if (mounted) setRequests(body?.requests ?? []);
      })
      .catch((fetchError) => {
        if (mounted) setError(fetchError instanceof Error ? fetchError.message : "소싱 요청을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  useEffect(() => loadRequests(), [loadRequests]);

  const requestCount = useMemo(() => requests.length, [requests]);

  function addCandidateToCart(image: CandidateImage) {
    const usageConditions = buyerUsageConditions({
      copyrightLicense: image.copyright_license,
      freeUsagePolicy: image.free_usage_policy,
    });
    addItem({
      id: image.id,
      assetId: image.asset_id ?? undefined,
      title: image.title ?? "Untitled",
      photographer: image.photographer_name ?? "",
      src: image.storage_path_preview ?? "",
      category: image.category ?? "",
      license: "editorial",
      creditLine: creditLineForName(image.photographer_name),
      usageConditions: usageConditions.map((condition) => condition.label),
    });
    setCartAdded(image.id);
    window.setTimeout(() => setCartAdded(null), 1400);
  }

  function toggleRevisionReason(requestId: string, reason: string, checked: boolean) {
    setRevisionDrafts((prev) => {
      const current = prev[requestId] ?? { reasons: [], message: "" };
      const reasons = checked
        ? Array.from(new Set([...current.reasons, reason]))
        : current.reasons.filter((value) => value !== reason);
      return { ...prev, [requestId]: { ...current, reasons } };
    });
  }

  async function submitRevision(request: SourcingRequest) {
    const draft = revisionDrafts[request.id] ?? { reasons: [], message: "" };
    setSubmittingRevisionId(request.id);
    try {
      const res = await fetch(`/api/sourcing/requests/${request.id}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "수정요청을 보내지 못했습니다.");
      setRevisionDrafts((prev) => ({ ...prev, [request.id]: { reasons: [], message: "" } }));
      setLoading(true);
      loadRequests();
    } catch (submitError) {
      alert(submitError instanceof Error ? submitError.message : "수정요청을 보내지 못했습니다.");
    } finally {
      setSubmittingRevisionId(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">내 소싱 요청</h1>
        <p className="mt-1 text-sm text-outline">
          Image Partners에 접수한 이미지 소싱 요청과 답변을 확인합니다.
          {!loading && ` 총 ${requestCount.toLocaleString("ko-KR")}건`}
        </p>
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-error/20 bg-error/10 p-5 text-sm text-error">{error}</div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-container-lowest px-6 py-24 text-center shadow-ghost">
          <span className="material-symbols-outlined text-6xl text-outline">travel_explore</span>
          <p className="font-semibold text-on-surface">아직 소싱 요청이 없습니다.</p>
          <Link href="/contact?mode=photo" className="rounded-lg bg-primary px-5 py-3 text-xs font-bold uppercase tracking-widest text-white">
            이미지 소싱 요청하기
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {requests.map((request) => {
            const answer = latestAnswer(request.answers);
            const candidates = answer?.candidates?.filter((candidate) => candidate.image) ?? [];
            const status = request.buyer_sourcing_status ?? "received";
            const revisionCount = request.revisions?.length ?? 0;
            const revisionDraft = revisionDrafts[request.id] ?? { reasons: [], message: "" };
            const canRevise = !!answer && status === "answer_ready" && revisionCount < 3;
            return (
              <article key={request.id} className="rounded-xl bg-surface-container-lowest p-5 shadow-ghost">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="font-headline text-lg font-bold text-on-surface">{request.subject ?? "제목 없음"}</h2>
                    <p className="mt-1 text-xs text-outline">접수일 {new Date(request.created_at).toLocaleString("ko-KR")}</p>
                  </div>
                  <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
                  {request.message ?? "요청 내용 없음"}
                </p>

                {answer ? (
                  <section className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                    <p className="font-bold text-on-surface">Image Partners 답변</p>
                    {answer.rights_result && (
                      <p className="mt-2 text-xs font-bold text-primary">
                        권리 확인 결과: {RIGHTS_LABELS[answer.rights_result] ?? answer.rights_result}
                      </p>
                    )}
                    {answer.answer_text && (
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">{answer.answer_text}</p>
                    )}
                    {answer.rights_explanation && (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-outline">{answer.rights_explanation}</p>
                    )}
                  </section>
                ) : (
                  <p className="mt-5 rounded-lg bg-surface-container-low p-4 text-sm text-outline">
                    담당자가 요청을 검토 중입니다. 답변이 준비되면 이 화면에 표시됩니다.
                  </p>
                )}

                {candidates.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                    {candidates.map((candidate) => {
                      const image = candidate.image!;
                      return (
                        <div key={candidate.id} className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface">
                          <div className="relative aspect-[4/3] bg-surface-container-low">
                            {image.storage_path_preview ? (
                              <Image
                                src={image.storage_path_preview}
                                alt={image.title ?? ""}
                                fill
                                sizes="(min-width: 768px) 30vw, 100vw"
                                className="object-cover"
                                unoptimized
                              />
                            ) : (
                              <span className="material-symbols-outlined absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-outline">image</span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="truncate font-semibold text-on-surface">{image.title ?? "Untitled"}</p>
                            <p className="mt-1 text-[10px] text-outline">{image.asset_id ?? image.id}</p>
                            <div className="mt-3 flex gap-2">
                              <Link
                                href={`/library/${image.id}`}
                                className="flex-1 rounded border border-outline-variant px-3 py-2 text-center text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                              >
                                상세 보기
                              </Link>
                              <button
                                type="button"
                                onClick={() => addCandidateToCart(image)}
                                className="flex-1 rounded bg-primary px-3 py-2 text-[10px] font-bold text-white"
                              >
                                {cartAdded === image.id ? "담김" : "장바구니"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
                  <p className="text-xs text-outline">{revisionLimitNotice}</p>
                  {canRevise ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        {REVISION_REASONS.map((reason) => (
                          <label key={reason.value} className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-2 text-[10px] font-bold text-on-surface-variant">
                            <input
                              type="checkbox"
                              checked={revisionDraft.reasons.includes(reason.value)}
                              onChange={(event) => toggleRevisionReason(request.id, reason.value, event.target.checked)}
                              className="h-3.5 w-3.5 accent-primary"
                            />
                            {reason.label}
                          </label>
                        ))}
                      </div>
                      <textarea
                        value={revisionDraft.message}
                        onChange={(event) => setRevisionDrafts((prev) => ({
                          ...prev,
                          [request.id]: { reasons: revisionDraft.reasons, message: event.target.value },
                        }))}
                        rows={3}
                        placeholder="원하는 수정 방향을 적어주세요."
                        className="rounded-lg bg-surface-container-lowest px-3 py-2 text-sm text-on-surface outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => submitRevision(request)}
                          disabled={submittingRevisionId === request.id}
                          className="rounded bg-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-white disabled:opacity-50"
                        >
                          {submittingRevisionId === request.id ? "전송 중" : `수정요청 보내기 (${revisionCount}/3)`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-outline">
                      현재 수정요청을 보낼 수 없습니다. 답변 공개 전이거나 수정요청 한도에 도달했습니다.
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
