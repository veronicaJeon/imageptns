import { describe, expect, it } from "vitest";
import type { ImageFingerprint } from "./fingerprint";
import { rankVisualMatches, type VisualSearchCandidate } from "./visual-search";

const query: ImageFingerprint = {
  originalSha256: "a".repeat(64),
  phash: "0".repeat(64),
  dhash: "0".repeat(64),
  width: 1600,
  height: 1000,
  algorithmVersion: "phash-dhash-v1",
};

function candidate(overrides: Partial<VisualSearchCandidate> = {}): VisualSearchCandidate {
  return {
    imageId: "image-close",
    originalSha256: "b".repeat(64),
    phash: `${"1".repeat(4)}${"0".repeat(60)}`,
    dhash: `${"1".repeat(2)}${"0".repeat(62)}`,
    width: 1600,
    height: 1000,
    algorithmVersion: "phash-dhash-v1",
    ...overrides,
  };
}

describe("photo fingerprint search ranking", () => {
  it("ranks exact bytes before a close visual match", () => {
    const result = rankVisualMatches(query, [
      candidate(),
      candidate({ imageId: "image-exact", originalSha256: query.originalSha256, phash: "1".repeat(64), dhash: "1".repeat(64) }),
    ]);

    expect(result).toEqual([
      { imageId: "image-exact", matchKind: "exact", score: 0 },
      expect.objectContaining({ imageId: "image-close", matchKind: "close" }),
    ]);
  });

  it("excludes visually distant and differently shaped candidates", () => {
    const result = rankVisualMatches(query, [
      candidate({ imageId: "phash-far", phash: `${"1".repeat(19)}${"0".repeat(45)}` }),
      candidate({ imageId: "dhash-far", dhash: `${"1".repeat(11)}${"0".repeat(53)}` }),
      candidate({ imageId: "ratio-far", width: 1000, height: 1000 }),
    ]);

    expect(result).toEqual([]);
  });

  it("ignores incompatible or malformed stored fingerprints", () => {
    expect(rankVisualMatches(query, [
      candidate({ algorithmVersion: "future-v2" }),
      candidate({ imageId: "malformed", phash: "not-a-hash" }),
    ])).toEqual([]);
  });

  it("keeps results stable and enforces the result limit", () => {
    const candidates = Array.from({ length: 25 }, (_, index) => candidate({ imageId: `image-${String(index).padStart(2, "0")}` }));
    const result = rankVisualMatches(query, candidates, 50);

    expect(result).toHaveLength(20);
    expect(result[0].imageId).toBe("image-00");
    expect(result[19].imageId).toBe("image-19");
  });
});
