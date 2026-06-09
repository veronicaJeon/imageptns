import { describe, expect, it, vi } from "vitest";
import { sendPhotoRequestInviteEmails } from "./contact";

const invite = {
  photographerEmail: "artist@example.com",
  photographerName: "김작가",
  requestId: "request-1",
  requestTitle: "제주 해변 촬영",
  locationLabel: "제주",
  deadlineAt: "2026-07-01T00:00:00.000Z",
  budgetLabel: "₩100,000 ~ ₩250,000",
};

describe("sendPhotoRequestInviteEmails", () => {
  it("sends every invite through the injected sender", async () => {
    const sender = vi.fn().mockResolvedValue(undefined);

    await sendPhotoRequestInviteEmails([invite], sender);

    expect(sender).toHaveBeenCalledWith(invite);
  });

  it("throws when any invite delivery fails", async () => {
    await expect(
      sendPhotoRequestInviteEmails([
        invite,
        { ...invite, photographerEmail: "second@example.com" },
      ], vi.fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("SMTP rejected"))),
    ).rejects.toThrow("Photo request invite email delivery failed");
  });
});
