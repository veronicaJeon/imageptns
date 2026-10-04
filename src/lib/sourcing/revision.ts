export const REVISION_REASON_LABELS: Record<string, string> = {
  wrong_location: "장소가 다름",
  wrong_season_or_time: "계절/시간대가 다름",
  wrong_composition: "구도/거리감이 다름",
  usage_terms_do_not_fit: "상업 사용 조건이 맞지 않음",
  price_does_not_fit: "가격이 맞지 않음",
  need_more_candidates: "더 많은 후보가 필요함",
  other: "기타",
};

export interface SourcingRevisionLike {
  round: number;
  created_at: string;
}

export interface SourcingAnswerLike {
  status: string;
  published_at: string | null;
}

export function revisionReasonLabels(reasons: string[] | null | undefined) {
  return (reasons ?? []).map((reason) => REVISION_REASON_LABELS[reason] ?? reason);
}

// A buyer revision is new work for operators: put the request back in the
// pending queue (and its badge count) instead of leaving it under "답변 완료".
export function reopenSourcingRequestForRevision(nowIso: string) {
  return {
    buyer_sourcing_status: "under_review",
    internal_sourcing_status: "drafting",
    request_status: "submitted",
    status: "pending",
    resolved_at: null,
    updated_at: nowIso,
  } as const;
}

export function latestRevisionRound(revisions: SourcingRevisionLike[] | null | undefined) {
  return (revisions ?? []).reduce((max, revision) => Math.max(max, revision.round), 0);
}

// Revisions the buyer sent after the most recent published answer.
export function unansweredRevisions<T extends SourcingRevisionLike>(
  revisions: T[] | null | undefined,
  answers: SourcingAnswerLike[] | null | undefined,
): T[] {
  const lastPublishedAt = Math.max(
    0,
    ...(answers ?? [])
      .filter((answer) => answer.status === "published" && answer.published_at)
      .map((answer) => new Date(String(answer.published_at)).getTime())
      .filter(Number.isFinite),
  );
  return (revisions ?? [])
    .filter((revision) => new Date(revision.created_at).getTime() > lastPublishedAt)
    .sort((a, b) => a.round - b.round);
}
