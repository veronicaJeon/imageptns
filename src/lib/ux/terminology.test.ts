import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  IMAGE_REVIEW_STATUS_LABELS,
  KO_SERVICE_TERMS,
  PHOTOGRAPHER_APPLICATION_STATUS_LABELS,
} from "./terminology";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("Korean service terminology", () => {
  it("publishes the canonical customer-facing labels", () => {
    expect(KO_SERVICE_TERMS).toMatchObject({
      asset: "이미지",
      contributor: "사진작가",
      customer: "구매자",
      imageRequest: "이미지 요청",
      license: "라이선스",
      paidLicenseAction: "사용권 구매",
      freeLicenseAction: "무료 사용권 확정",
      bankTransfer: "계좌이체",
      permanentDeletion: "완전삭제",
      arweaveProof: "Arweave 원본 증명",
    });
    expect(IMAGE_REVIEW_STATUS_LABELS).toMatchObject({
      pending: "검토 대기",
      approved: "승인됨",
      rejected: "반려됨",
    });
    expect(PHOTOGRAPHER_APPLICATION_STATUS_LABELS).toMatchObject({
      pending: "승인 대기",
      approved: "승인됨",
      rejected: "승인되지 않음",
    });
  });

  it("does not reintroduce deprecated customer-facing terms", () => {
    const source = sourceFiles(join(process.cwd(), "src"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");

    const deprecated = [
      /바이어/u,
      /계좌결제/u,
      /라이센스/u,
      /무료 구매/u,
      /구매확정/u,
      /영구삭제/u,
      /삭제·비공개/u,
      /(?<!사진)작가명/u,
      /작가수익/u,
    ];

    for (const pattern of deprecated) {
      expect(source, `${pattern} must use the service glossary equivalent`).not.toMatch(pattern);
    }
  });

  it("keeps image review status labels consistent on review surfaces", () => {
    const reviewFiles = [
      "src/app/(admin)/admin/page.tsx",
      "src/app/(admin)/admin/images/page.tsx",
      "src/app/(admin)/admin/image-cleanup/page.tsx",
      "src/app/(dashboard)/dashboard/uploads/page.tsx",
    ];
    const source = reviewFiles
      .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
      .join("\n");

    expect(source).not.toMatch(/["'`]검토 중["'`]/u);
    expect(source).not.toMatch(/거절/u);
  });
});
