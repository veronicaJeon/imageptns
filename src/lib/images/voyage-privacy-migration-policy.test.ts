import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/073_disclose_voyage_semantic_processing.sql", "utf8");

describe("Voyage production privacy notice", () => {
  it("discloses both approved catalog indexing and user search inputs", () => {
    expect(migration).toContain("승인·공개된 이미지의 미리보기");
    expect(migration).toContain("검색 문장 또는 EXIF·파일명을 제거한 검색용 사진 사본");
    expect(migration).toContain("의미·분위기 기반 이미지 검색");
  });

  it("states the opt-out retention boundary without claiming it is retroactive", () => {
    expect(migration).toContain("학습 사용 거부 설정 이후 입력은 처리 직후 삭제");
    expect(migration).not.toContain("소급");
  });

  it("is idempotent for an already disclosed provider", () => {
    expect(migration).toContain("body not like '%Voyage AI Innovations, Inc.%'");
  });
});
