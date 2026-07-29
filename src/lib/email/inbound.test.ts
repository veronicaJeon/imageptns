import { describe, expect, it } from "vitest";
import {
  eventTargetsPublicContact,
  inboundForwardIdempotencyKey,
  isPublicContactRecipient,
} from "./inbound";

describe("inbound public email routing", () => {
  it("accepts only the canonical contact mailbox", () => {
    expect(isPublicContactRecipient("contact@imagepartners.kr")).toBe(true);
    expect(isPublicContactRecipient("Image Partners <CONTACT@imagepartners.kr>")).toBe(true);
    expect(isPublicContactRecipient("sales@imagepartners.kr")).toBe(false);
  });

  it("checks both envelope and visible recipients", () => {
    expect(eventTargetsPublicContact({ to: ["other@example.com"], received_for: ["contact@imagepartners.kr"] })).toBe(true);
    expect(eventTargetsPublicContact({ to: ["other@example.com"], received_for: [] })).toBe(false);
  });

  it("uses a stable per-email idempotency key", () => {
    expect(inboundForwardIdempotencyKey("email_123")).toBe("inbound-contact-forward/email_123");
  });
});
