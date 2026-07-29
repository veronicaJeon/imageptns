import { describe, expect, it } from "vitest";
import {
  applyAdminImageListLifecycleFilter,
  applyAdminReviewableLifecycleFilter,
  isVisibleInAdminImageList,
} from "./admin-list";

class QuerySpy {
  calls: string[] = [];

  or(filters: string) {
    this.calls.push(filters);
    return this;
  }
}

describe("admin image list lifecycle filtering", () => {
  it("keeps active review states while hiding completed deletions", () => {
    expect(isVisibleInAdminImageList("active")).toBe(true);
    expect(isVisibleInAdminImageList("deletion_requested")).toBe(true);
    expect(isVisibleInAdminImageList("legal_hold")).toBe(true);
    expect(isVisibleInAdminImageList(null)).toBe(true);

    expect(isVisibleInAdminImageList("archived")).toBe(false);
    expect(isVisibleInAdminImageList("purged")).toBe(false);
  });

  it("adds an exclusion filter for completed deletion lifecycle states", () => {
    const query = new QuerySpy();

    expect(applyAdminImageListLifecycleFilter(query)).toBe(query);
    expect(query.calls).toEqual([
      "lifecycle_status.is.null,lifecycle_status.not.in.(archived,purged)",
    ]);
  });

  it("restricts review queues to active and legacy-null lifecycle rows", () => {
    const query = new QuerySpy();

    expect(applyAdminReviewableLifecycleFilter(query)).toBe(query);
    expect(query.calls).toEqual([
      "lifecycle_status.is.null,lifecycle_status.eq.active",
    ]);
  });
});
