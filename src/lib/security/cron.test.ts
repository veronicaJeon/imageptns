import { describe, expect, it } from "vitest";
import { authorizeCronRequest } from "./cron";

describe("authorizeCronRequest", () => {
  it("rejects calls when CRON_SECRET is unset", () => {
    const result = authorizeCronRequest(new Headers(), undefined);

    expect(result).toEqual({
      authorized: false,
      status: 503,
      error: "CRON_SECRET is not configured",
    });
  });

  it("requires an exact bearer token when CRON_SECRET is set", () => {
    expect(authorizeCronRequest(new Headers(), "secret").authorized).toBe(false);
    expect(authorizeCronRequest(new Headers({ Authorization: "Bearer wrong" }), "secret").authorized).toBe(false);
    expect(authorizeCronRequest(new Headers({ Authorization: "Bearer secret" }), "secret")).toEqual({
      authorized: true,
    });
  });
});
