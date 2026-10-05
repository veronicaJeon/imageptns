import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("sourcing revision and inquiry reply wiring", () => {
  it("reopens revised requests and alerts operations", () => {
    const revisionRoute = source("src/app/api/sourcing/requests/[id]/revision/route.ts");
    expect(revisionRoute).toContain("reopenSourcingRequestForRevision(");
    expect(revisionRoute).toContain("notifyOpsSourcingRevision(");
  });

  it("shows revisions and general replies on the admin support page", () => {
    const supportRoute = source("src/app/api/admin/support/route.ts");
    const supportPage = source("src/app/(admin)/admin/support/page.tsx");
    expect(supportRoute).toContain('.from("sourcing_request_revisions")');
    expect(supportRoute).toContain('"reply_general_inquiry"');
    expect(supportRoute).toContain("sendGeneralInquiryReply(");
    expect(supportPage).toContain("unansweredRevisions(");
    expect(supportPage).toContain("reply_general_inquiry");
  });
});
