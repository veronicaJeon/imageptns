import { describe, expect, it } from "vitest";
import {
  latestRevisionRound,
  reopenSourcingRequestForRevision,
  revisionReasonLabels,
  unansweredRevisions,
} from "./revision";

describe("sourcing revision helpers", () => {
  it("returns a revised request to the operator pending queue", () => {
    const now = "2026-10-04T12:00:00.000Z";
    expect(reopenSourcingRequestForRevision(now)).toEqual({
      buyer_sourcing_status: "under_review",
      internal_sourcing_status: "drafting",
      request_status: "submitted",
      status: "pending",
      resolved_at: null,
      updated_at: now,
    });
  });

  it("lists only revisions sent after the latest published answer", () => {
    const revisions = [
      { id: "r2", round: 2, created_at: "2026-10-03T00:00:00+00:00" },
      { id: "r1", round: 1, created_at: "2026-10-01T00:00:00+00:00" },
    ];
    const answers = [
      { status: "published", published_at: "2026-09-30T00:00:00+00:00" },
      { status: "published", published_at: "2026-10-02T00:00:00+00:00" },
      { status: "draft", published_at: null },
    ];

    expect(unansweredRevisions(revisions, answers).map((revision) => revision.id)).toEqual(["r2"]);
    expect(unansweredRevisions(revisions, []).map((revision) => revision.id)).toEqual(["r1", "r2"]);
    expect(latestRevisionRound(revisions)).toBe(2);
    expect(latestRevisionRound(null)).toBe(0);
  });

  it("labels revision reasons in Korean and keeps unknown codes", () => {
    expect(revisionReasonLabels(["wrong_location", "custom"])).toEqual(["장소가 다름", "custom"]);
  });
});
