import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  requestIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/locations/administrative-areas", () => ({
  normalizeLocationQuery: (value: unknown) => typeof value === "string" ? value.trim() : "",
}));

const mockedCreateAdminClient = vi.mocked(createAdminClient);
const mockedCheckRateLimit = vi.mocked(checkRateLimit);

describe("location suggestion route", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckRateLimit.mockReturnValue({ allowed: true, retryAfterSeconds: 0 });
    mockedCreateAdminClient.mockReturnValue({ rpc } as never);
  });

  it("returns public, cacheable administrative-area suggestions without user authentication", async () => {
    rpc.mockResolvedValue({
      data: [{
        code: "1144012000",
        full_name: "서울특별시 마포구 서교동",
        leaf_name: "서교동",
        level: "eup_myeon_dong",
      }],
      error: null,
    });

    const response = await GET(new NextRequest("https://example.com/api/locations/suggest?q=서교동"));

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    expect(response.headers.get("server-timing")).toMatch(/^location-rpc;dur=/);
    await expect(response.json()).resolves.toEqual({
      suggestions: [{
        code: "1144012000",
        name: "서울특별시 마포구 서교동",
        level: "eup_myeon_dong",
      }],
    });
    expect(rpc).toHaveBeenCalledWith("search_administrative_areas", {
      search_query: "서교동",
      result_limit: 8,
    });
  });

  it("does not query the database for fewer than two characters", async () => {
    const response = await GET(new NextRequest("https://example.com/api/locations/suggest?q=서"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ suggestions: [] });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("keeps rate-limited responses out of caches", async () => {
    mockedCheckRateLimit.mockReturnValue({ allowed: false, retryAfterSeconds: 30 });

    const response = await GET(new NextRequest("https://example.com/api/locations/suggest?q=서교동"));

    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("30");
    expect(rpc).not.toHaveBeenCalled();
  });
});
