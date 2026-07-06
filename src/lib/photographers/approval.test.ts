import { describe, expect, it } from "vitest";
import {
  buildPhotographerApplicationPayload,
  canApplyForPhotographer,
  getPhotographerAccessMessage,
  isApprovedPhotographerStatus,
  normalizeApplicationStatus,
  normalizePhotographerStatus,
} from "./approval";

describe("photographer approval helpers", () => {
  it("normalizes profile photographer status defensively", () => {
    expect(normalizePhotographerStatus("approved")).toBe("approved");
    expect(normalizePhotographerStatus("pending")).toBe("pending");
    expect(normalizePhotographerStatus("suspended")).toBe("suspended");
    expect(normalizePhotographerStatus("unexpected")).toBe("none");
    expect(normalizePhotographerStatus(null)).toBe("none");
  });

  it("normalizes application status defensively", () => {
    expect(normalizeApplicationStatus("approved")).toBe("approved");
    expect(normalizeApplicationStatus("rejected")).toBe("rejected");
    expect(normalizeApplicationStatus("unexpected")).toBe("pending");
  });

  it("allows applications from none and suspended states only", () => {
    expect(canApplyForPhotographer("none")).toBe(true);
    expect(canApplyForPhotographer("suspended")).toBe(true);
    expect(canApplyForPhotographer("pending")).toBe(false);
    expect(canApplyForPhotographer("approved")).toBe(false);
  });

  it("treats only approved status as photographer authorization", () => {
    expect(isApprovedPhotographerStatus("approved")).toBe(true);
    expect(isApprovedPhotographerStatus("pending")).toBe(false);
    expect(isApprovedPhotographerStatus("suspended")).toBe(false);
    expect(isApprovedPhotographerStatus("none")).toBe(false);
  });

  it("builds a normalized application payload", () => {
    expect(
      buildPhotographerApplicationPayload({
        profileId: "user-1",
        name: "  Kim   Photo ",
        organization: " Studio  A ",
        phoneNumber: "+82 10 1234 5678",
        primaryActivityRegions: "Seoul, Busan\nSeoul",
        bio: "  Editorial and archive photography.  ",
      })
    ).toEqual({
      profile_id: "user-1",
      status: "pending",
      applicant_name: "Kim Photo",
      organization: "Studio A",
      phone_number: "+82 10 1234 5678",
      primary_activity_regions: ["Seoul", "Busan"],
      bio: "Editorial and archive photography.",
    });
  });

  it("rejects invalid application payloads before creating requests", () => {
    expect(() =>
      buildPhotographerApplicationPayload({
        profileId: "user-1",
        name: " ",
        phoneNumber: "12345",
      })
    ).toThrow("applicant_name");
  });

  it("returns user-facing photographer access messages", () => {
    expect(getPhotographerAccessMessage("pending")).toContain("승인 대기");
    expect(getPhotographerAccessMessage("suspended")).toContain("재신청");
    expect(getPhotographerAccessMessage("none")).toContain("신청");
  });
});
