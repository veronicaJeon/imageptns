import { describe, expect, it } from "vitest";
import {
  canSubmitUploadBatch,
  dedupeUploadFiles,
  filterAcceptedUploadFiles,
  initialDraftIdForFiles,
  MAX_UPLOAD_BATCH_FILES,
  takeAvailableUploadSlots,
  uploadFileClientId,
} from "./batch-client";

function imageFile(name: string, type = "image/jpeg", sizeMb = 1, lastModified = 1) {
  return { name, type, size: sizeMb * 1024 * 1024, lastModified } as File;
}

describe("batch upload client helpers", () => {
  it("keeps only the first copy of the same browser file", () => {
    const first = imageFile("a.jpg", "image/jpeg", 1, 10);
    const duplicate = imageFile("a.jpg", "image/jpeg", 1, 10);
    const second = imageFile("b.jpg", "image/jpeg", 1, 10);

    expect(dedupeUploadFiles([first, duplicate, second])).toEqual([first, second]);
  });

  it("filters unsupported or oversized files", () => {
    const result = filterAcceptedUploadFiles([
      imageFile("ok.jpg"),
      imageFile("bad.gif", "image/gif"),
      imageFile("big.jpg", "image/jpeg", 501),
    ]);

    expect(result.accepted.map((file) => file.name)).toEqual(["ok.jpg"]);
    expect(result.rejected).toEqual([
      { file: imageFile("bad.gif", "image/gif"), reason: "unsupported-type" },
      { file: imageFile("big.jpg", "image/jpeg", 501), reason: "too-large" },
    ]);
  });

  it("uses the first valid file as the initial active draft", () => {
    expect(initialDraftIdForFiles([imageFile("a.jpg", "image/jpeg", 1, 20), imageFile("b.jpg", "image/jpeg", 1, 30)]))
      .toBe("a.jpg:1048576:20");
  });

  it("hard-limits a batch to 20 files including files already queued", () => {
    const files = Array.from({ length: 5 }, (_, index) => imageFile(`${index}.jpg`));
    const result = takeAvailableUploadSlots(files, 18);

    expect(MAX_UPLOAD_BATCH_FILES).toBe(20);
    expect(result.accepted.map((file) => file.name)).toEqual(["0.jpg", "1.jpg"]);
    expect(result.overflow.map((file) => file.name)).toEqual(["2.jpg", "3.jpg", "4.jpg"]);
    expect(takeAvailableUploadSlots(files, 20).accepted).toEqual([]);
  });

  it("builds stable ids from browser file identity fields", () => {
    expect(uploadFileClientId(imageFile("sample.webp", "image/webp", 2, 123))).toBe("sample.webp:2097152:123");
  });

  it("requires valid per-file fields and common attestations before submit", () => {
    expect(canSubmitUploadBatch({
      drafts: [{
        id: "a",
        title: "Title",
        description: "Description",
        categoryCodes: ["nature"],
        tags: "tag",
        takenAt: "unknown",
        location: "unknown",
        uploadStatus: "idle",
      }],
      authorshipDeclaration: "human_original",
      factualityAgreed: true,
      busy: false,
    })).toBe(true);

    expect(canSubmitUploadBatch({
      drafts: [{
        id: "a",
        title: "",
        description: "Description",
        categoryCodes: ["nature"],
        tags: "tag",
        takenAt: "unknown",
        location: "unknown",
        uploadStatus: "idle",
      }],
      authorshipDeclaration: "human_original",
      factualityAgreed: true,
      busy: false,
    })).toBe(false);
  });
});
