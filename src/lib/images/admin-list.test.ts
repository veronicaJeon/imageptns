import { describe, expect, it } from "vitest";
import {
  applyAdminImageListLifecycleFilter,
  isVisibleInAdminImageList,
} from "./admin-list";

class QuerySpy {
  calls: Array<{ column: string; operator: string; value: string }> = [];

  not(column: string, operator: string, value: string) {
    this.calls.push({ column, operator, value });
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
      { column: "lifecycle_status", operator: "in", value: "(archived,purged)" },
    ]);
  });
});
