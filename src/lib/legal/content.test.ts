import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGAL_DOCUMENTS,
  isLegalDocumentSlug,
  normalizeLegalDocument,
} from "./content";

describe("legal content helpers", () => {
  it("knows the public legal document slugs admins can edit", () => {
    expect(isLegalDocumentSlug("privacy")).toBe(true);
    expect(isLegalDocumentSlug("terms")).toBe(true);
    expect(isLegalDocumentSlug("license_guide")).toBe(true);
    expect(isLegalDocumentSlug("cookie")).toBe(true);
    expect(isLegalDocumentSlug("unknown")).toBe(false);
  });

  it("normalizes empty admin input back to safe defaults", () => {
    const doc = normalizeLegalDocument("privacy", { title: "", body: "" });

    expect(doc.title).toBe(DEFAULT_LEGAL_DOCUMENTS.privacy.title);
    expect(doc.body).toBe(DEFAULT_LEGAL_DOCUMENTS.privacy.body);
  });

  it("publishes the active processors and domestic operator details", () => {
    const privacy = DEFAULT_LEGAL_DOCUMENTS.privacy.body;
    const terms = DEFAULT_LEGAL_DOCUMENTS.terms.body;

    expect(privacy).toContain("명칭: 이미지파트너스");
    expect(privacy).toContain("Supabase, Inc.");
    expect(privacy).toContain("Mistral AI SAS");
    expect(privacy).not.toContain("Groq, Inc.");
    expect(privacy).not.toContain("Gemini AI");
    expect(privacy).not.toContain("Resend");
    expect(terms).toContain("별도 사업자정보 화면");
    expect(terms).not.toContain("대표자");
    expect(terms).not.toContain("사업자등록번호");
  });
});
