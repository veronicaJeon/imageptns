import { describe, expect, it } from "vitest";
import { orderHistoryPreview } from "./history";

describe("order history preview", () => {
  it("never exposes current or snapshotted thumbnails for deleted images", () => {
    expect(orderHistoryPreview("archived", "current.jpg", "snapshot.jpg")).toBeNull();
    expect(orderHistoryPreview("purged", null, "snapshot.jpg")).toBeNull();
  });

  it("uses the current preview and then the snapshot for active images", () => {
    expect(orderHistoryPreview("active", "current.jpg", "snapshot.jpg")).toBe("current.jpg");
    expect(orderHistoryPreview("active", null, "snapshot.jpg")).toBe("snapshot.jpg");
  });
});
