import { describe, expect, it } from "vitest";

import {
  buildArweaveCredentialMetadata,
  canAdminRegisterImage,
  canRequestFreeRegistration,
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

  it("marks unsold approved images as self-funded requestable", () => {
    expect(
      getBlockchainRegistrationState({
        imageStatus: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
      })
    ).toBe("self_funded_available");
  });

  it("preserves requested, pending, registered, and failed proof states", () => {
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "requested" })).toBe("requested");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "pending" })).toBe("pending");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "registered" })).toBe("registered");
    expect(getBlockchainRegistrationState({ imageStatus: "approved", salesCount: 2, proofStatus: "failed" })).toBe("failed");
  });

  it("marks unsold images with a pending fee payment as payment pending", () => {
    expect(
      getBlockchainRegistrationState({
        imageStatus: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
        proofRequestKind: "self_funded",
        proofRequestPaymentStatus: "pending",
      })
    ).toBe("self_funded_payment_pending");
  });

  it("returns to self-funded available after a refund", () => {
    expect(
      getBlockchainRegistrationState({
        imageStatus: "approved",
        salesCount: 0,
        proofStatus: "not_registered",
        proofRequestKind: "self_funded",
        proofRequestPaymentStatus: "refunded",
      })
    ).toBe("self_funded_available");
  });
});

describe("canRequestFreeRegistration", () => {
  it("allows post-sale available and failed images", () => {
    expect(canRequestFreeRegistration({ imageStatus: "approved", salesCount: 3, proofStatus: "not_registered" })).toBe(true);
    expect(canRequestFreeRegistration({ imageStatus: "approved", salesCount: 3, proofStatus: "failed" })).toBe(true);
  });

  it("rejects pre-sale self-funded images (they must pay the fee)", () => {
    expect(canRequestFreeRegistration({ imageStatus: "approved", salesCount: 0, proofStatus: "not_registered" })).toBe(false);
  });
});

describe("canAdminRegisterImage", () => {
  it("allows platform-funded post-sale requests without payment", () => {
    expect(canAdminRegisterImage({ proofStatus: "requested", proofRequestKind: "post_sale", proofRequestPaymentStatus: "none" })).toBe(true);
    expect(canAdminRegisterImage({ proofStatus: "available", proofRequestKind: "post_sale" })).toBe(true);
  });

  it("blocks self-funded requests until the fee is paid", () => {
    expect(canAdminRegisterImage({ proofStatus: "requested", proofRequestKind: "self_funded", proofRequestPaymentStatus: "pending" })).toBe(false);
    expect(canAdminRegisterImage({ proofStatus: "requested", proofRequestKind: "self_funded", proofRequestPaymentStatus: "none" })).toBe(false);
    expect(canAdminRegisterImage({ proofStatus: "requested", proofRequestKind: "self_funded", proofRequestPaymentStatus: "paid" })).toBe(true);
  });

  it("rejects non-registerable proof states", () => {
    expect(canAdminRegisterImage({ proofStatus: "pending", proofRequestKind: "post_sale" })).toBe(false);
    expect(canAdminRegisterImage({ proofStatus: "registered", proofRequestKind: "self_funded", proofRequestPaymentStatus: "paid" })).toBe(false);
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
      onchainAssetId: "0xabc",
      ledgerKey: "0xabc",
      createdAt: "2026-05-20T00:00:00.000Z",
    });

    expect(metadata).toMatchObject({
      schema: "imagepartners.photo-credential.v1",
      assetId: "IMG-000001",
      originalFileSha256: "a".repeat(64),
      authorshipDeclaration: "human_original",
      arweaveOriginalTxId: "abc123",
      ledgerKey: "0xabc",
    });
  });
});
