import { describe, expect, it, vi } from "vitest";

describe("gmail smtp helpers", () => {
  it("rejects contact delivery when SMTP credentials are missing", async () => {
    vi.resetModules();
    vi.stubEnv("GMAIL_SMTP_USER", "");
    vi.stubEnv("GMAIL_SMTP_PASS", "");

    const { sendContactConfirmation } = await import("./gmail");

    await expect(
      sendContactConfirmation({
        name: "홍길동",
        email: "buyer@example.com",
        subject: "문의",
      }),
    ).rejects.toThrow("GMAIL_SMTP_USER");
  });

  it("includes nested SMTP error details for AggregateError logs", async () => {
    vi.resetModules();
    const { safeEmailErrorDetails } = await import("./gmail");
    const smtpError = Object.assign(new Error("Invalid login"), {
      code: "EAUTH",
      command: "AUTH PLAIN",
      responseCode: 535,
      response: "535-5.7.8 Username and Password not accepted.",
    });

    const details = safeEmailErrorDetails(
      new AggregateError([smtpError], "Contact email delivery failed"),
    );

    expect(details).toMatchObject({
      name: "AggregateError",
      message: "Contact email delivery failed",
      errors: [
        {
          name: "Error",
          message: "Invalid login",
          code: "EAUTH",
          command: "AUTH PLAIN",
          responseCode: 535,
        },
      ],
    });
  });
});
