import { describe, expect, it } from "vitest";
import {
  initialSelectedDownloadIds,
  toggleDownloadId,
  toggleDownloadSelectionAll,
} from "./success-downloads";

describe("checkout success download selection", () => {
  it("selects every purchased item by default", () => {
    expect(initialSelectedDownloadIds([{ id: "a" }, { id: "b" }])).toEqual(["a", "b"]);
  });

  it("toggles a single item id without duplicating ids", () => {
    expect(toggleDownloadId(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleDownloadId(["a", "b"], "a")).toEqual(["b"]);
  });

  it("selects all ids when not all are selected and clears when all are selected", () => {
    const ids = ["a", "b", "c"];
    expect(toggleDownloadSelectionAll(["a"], ids)).toEqual(ids);
    expect(toggleDownloadSelectionAll(ids, ids)).toEqual([]);
  });
});
