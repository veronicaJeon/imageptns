import { describe, expect, it } from "vitest";
import {
  buildGoogleSignupPath,
  confirmationFailureQuery,
  isEmailNotConfirmedError,
  loginQueryNotice,
} from "./auth-feedback";

describe("auth feedback", () => {
  it("maps login query errors to notices, including legacy codes", () => {
    expect(loginQueryNotice("oauth")).toBe("oauth");
    expect(loginQueryNotice("confirmation_link")).toBe("confirmation_link");
    expect(loginQueryNotice("auth_confirmation")).toBe("confirmation_link");
    expect(loginQueryNotice("auth_callback_failed")).toBe("confirmation_link");
    expect(loginQueryNotice("recovery_link")).toBe("recovery_link");
    expect(loginQueryNotice("something_else")).toBeNull();
    expect(loginQueryNotice(null)).toBeNull();
  });

  it("separates expired password reset links from signup confirmation links", () => {
    expect(confirmationFailureQuery("recovery")).toBe("recovery_link");
    expect(confirmationFailureQuery("email")).toBe("confirmation_link");
    expect(confirmationFailureQuery("signup")).toBe("confirmation_link");
    expect(confirmationFailureQuery(null)).toBe("confirmation_link");
  });

  it("detects unconfirmed email sign-in errors", () => {
    expect(isEmailNotConfirmedError({ code: "email_not_confirmed" })).toBe(true);
    expect(isEmailNotConfirmedError({ message: "Email not confirmed" })).toBe(true);
    expect(isEmailNotConfirmedError({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(false);
    expect(isEmailNotConfirmedError(null)).toBe(false);
  });

  it("keeps personal data out of the Google signup URL", () => {
    const path = buildGoogleSignupPath("photographer");
    const params = new URL(path, "https://example.test").searchParams;
    expect([...params.keys()].sort()).toEqual(["next", "role"]);
    expect(params.get("role")).toBe("photographer");
    expect(params.get("next")).toBe("/dashboard");
  });
});
