import { describe, expect, it } from "vitest";

import {
  buildArweaveCredentialMetadata,
  getBlockchainRegistrationState,
  summarizeRegistrationSelection,
} from "./registration";

describe("getBlockchainRegistrationState", () => {
  it("marks approved sold images without proof as available", () => {
    expect(
      getBlockchainRegistrationState({
        imageStatus: "approved",
        salesCount: 1,
        proofStatus: "not_registered",
      })
    ).toBe("available");
  });

  it("does not allow unsold approved images to be requested", () => {
    expect(
      getBlockchainRegistrationState({
        imageStatus: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
      })
    ).toBe("waiting_first_sale");
  });

  it("preserves requested, pending, registered, and failed proof states", () => {
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "requested" })).toBe("requested");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "pending" })).toBe("pending");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "registered" })).toBe("registered");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "failed" })).toBe("failed");
  });
});

describe("summarizeRegistrationSelection", () => {
  it("counts selected images and sums byte sizes", () => {
    expect(
      summarizeRegistrationSelection([
        { id: "a", fileSizeMb: 1.5 },
        { id: "b", fileSizeMb: 2 },
      ])
    ).toEqual({ count: 2, totalBytes: 3_670_016, totalMb: 3.5 });
  });
});

describe("buildArweaveCredentialMetadata", () => {
  it("creates canonical metadata with original hash and authorship declaration", () => {
    const metadata = buildArweaveCredentialMetadata({
      appName: "Image Partners",
      assetId: "IMG-000001",
      imageId: "image-id",
      photographerId: "photographer-id",
      title: "Morning",
      originalFilename: "morning.tif",
      originalFileSha256: "a".repeat(64),
      fileSizeBytes: 123,
      contentType: "image/tiff",
      storagePathOriginal: "photographer/image.tif",
      copyrightLicense: "standard",
      freeUsagePolicy: "none",
      authorshipDeclaration: "human_original",
      arweaveOriginalTxId: "abc123",
      createdAt: "2026-05-20T00:00:00.000Z",
    });

    expect(metadata).toMatchObject({
      schema: "imagepartners.photo-credential.v1",
      assetId: "IMG-000001",
      originalFileSha256: "a".repeat(64),
      authorshipDeclaration: "human_original",
      arweaveOriginalTxId: "abc123",
    });
  });
});
