import { describe, expect, it } from "vitest";
import { applyAdminImageDeleteTargetFilter } from "./admin-delete";

class QuerySpy {
  calls: string[] = [];

  or(filters: string) {
    this.calls.push(filters);
    return this;
  }
}

describe("admin image delete target filtering", () => {
  it("excludes images whose deletion lifecycle is already complete", () => {
    const query = new QuerySpy();

    expect(applyAdminImageDeleteTargetFilter(query)).toBe(query);
    expect(query.calls).toEqual([
      "lifecycle_status.is.null,lifecycle_status.not.in.(archived,purged)",
    ]);
  });
});
