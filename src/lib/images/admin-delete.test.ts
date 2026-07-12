import { describe, expect, it } from "vitest";
import { applyAdminImageDeleteTargetFilter } from "./admin-delete";

class QuerySpy {
  calls: Array<{ column: string; operator: string; value: string }> = [];

  not(column: string, operator: string, value: string) {
    this.calls.push({ column, operator, value });
    return this;
  }
}

describe("admin image delete target filtering", () => {
  it("excludes images whose deletion lifecycle is already complete", () => {
    const query = new QuerySpy();

    expect(applyAdminImageDeleteTargetFilter(query)).toBe(query);
    expect(query.calls).toEqual([
      { column: "lifecycle_status", operator: "in", value: "(archived,purged)" },
    ]);
  });
});
