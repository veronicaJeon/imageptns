import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const deploy = readFileSync(".github/workflows/deploy.yml", "utf8");

describe("production keyword search deployment smoke", () => {
  it("checks the known Han River result after deployment", () => {
    expect(deploy).toContain("/api/images/search?query=%ED%95%9C%EA%B0%95&limit=20");
    expect(deploy).toContain("서울 한강 풍경");
  });
});
