import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("photographer email notification policy", () => {
  it("does not email upload completion or ordinary image approval", () => {
    const uploadPage = source("src/app/(dashboard)/dashboard/uploads/new/page.tsx");
    const uploadRoute = source("src/app/api/uploads/route.ts");
    const reviewRoute = source("src/app/api/admin/images/[id]/review/route.ts");
    const resend = source("src/lib/email/resend.ts");

    expect(uploadPage).not.toContain("opsNotification");
    expect(uploadPage).not.toContain("send_ops_notification");
    expect(uploadPage).not.toContain("/api/uploads/notify-batch");
    expect(uploadRoute).not.toContain("notifyOpsNewUpload");
    expect(uploadRoute).not.toContain("send_ops_notification");
    expect(reviewRoute).not.toContain("sendImageApproved");
    expect(resend).not.toContain("notifyOpsNewUpload");
    expect(resend).not.toContain("notifyOpsUploadBatch");
    expect(resend).not.toContain("sendImageApproved");
    expect(existsSync(join(process.cwd(), "src/app/api/uploads/notify-batch/route.ts"))).toBe(false);
  });

  it("keeps action-required photographer email paths", () => {
    const resend = source("src/lib/email/resend.ts");
    const reviewRoute = source("src/app/api/admin/images/[id]/review/route.ts");
    const applicationRoute = source("src/app/api/admin/photographer-applications/route.ts");
    const suspensionRoute = source("src/app/api/admin/users/[id]/photographer-suspension/route.ts");
    const payoutRoute = source("src/app/api/admin/payouts/route.ts");
    const supportRoute = source("src/app/api/admin/support/route.ts");

    for (const sender of [
      "sendImageRejected",
      "sendPhotographerApplicationApproved",
      "sendPhotographerApplicationRejected",
      "sendPhotographerAccessSuspended",
      "sendPayoutApproved",
      "sendPayoutRejected",
      "sendPhotoRequestInvite",
    ]) {
      expect(resend).toContain(`export async function ${sender}`);
    }

    expect(reviewRoute).toContain("sendImageRejected");
    expect(applicationRoute).toContain("sendPhotographerApplicationApproved");
    expect(applicationRoute).toContain("sendPhotographerApplicationRejected");
    expect(suspensionRoute).toContain("sendPhotographerAccessSuspended");
    expect(payoutRoute).toContain("sendPayoutApproved");
    expect(payoutRoute).toContain("sendPayoutRejected");
    expect(supportRoute).toContain("sendPhotoRequestInviteEmails");
  });
});
