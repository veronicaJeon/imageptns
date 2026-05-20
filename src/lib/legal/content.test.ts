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
});
