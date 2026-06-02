import { describe, expect, it } from "vitest";
import {
  buildOnchainDiagnostics,
  type OnchainDiagnosticConfigInput,
  type OnchainDiagnosticReads,
} from "./diagnostics";

const CONFIG: OnchainDiagnosticConfigInput = {
  enabled: true,
  chainId: 84532,
  escrowAddress: "0xEScRoW0000000000000000000000000000000001",
  usdcAddress: "0xUSDC00000000000000000000000000000000aBcD",
  treasuryAddress: "0xTREASURY000000000000000000000000000000Ff",
  operatorAddress: "0xOPERATOR00000000000000000000000000000099",
  platformFeeBps: 2000,
  usdcPerKrw: 0.00075,
};

function ok<T>(value: T) {
  return { value, error: null };
}
function err<T>(error: string) {
  return { value: null as T | null, error };
}

function healthyReads(): OnchainDiagnosticReads {
  return {
    rpcChainId: ok(84532),
    escrowBytecodePresent: ok(true),
    escrowUsdc: ok(CONFIG.usdcAddress.toLowerCase()),
    escrowTreasury: ok(CONFIG.treasuryAddress.toLowerCase()),
    escrowPlatformFeeBps: ok(2000),
    escrowOwner: ok("0xOWNER0000000000000000000000000000000001"),
    operatorAllowed: ok(true),
    usdcDecimals: ok(6),
    usdcSymbol: ok("USDC"),
  };
}

function find(result: ReturnType<typeof buildOnchainDiagnostics>, id: string) {
  const check = result.checks.find((c) => c.id === id);
  if (!check) throw new Error(`check ${id} missing`);
  return check;
}

describe("buildOnchainDiagnostics", () => {
  it("passes all hard checks for a healthy testnet wiring", () => {
    const result = buildOnchainDiagnostics(CONFIG, healthyReads());
    expect(result.summary.fail).toBe(0);
    expect(result.summary.ok).toBe(true);
    expect(find(result, "network").status).toBe("pass");
    expect(find(result, "escrow_contract").status).toBe("pass");
    expect(find(result, "escrow_usdc").status).toBe("pass");
    expect(find(result, "operator").status).toBe("pass");
    expect(find(result, "usdc_token").status).toBe("pass");
  });

  it("compares addresses case-insensitively", () => {
    const reads = healthyReads();
    reads.escrowUsdc = ok(CONFIG.usdcAddress.toUpperCase());
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "escrow_usdc").status).toBe("pass");
  });

  it("fails network check on wrong chain id", () => {
    const reads = healthyReads();
    reads.rpcChainId = ok(8453);
    const check = find(buildOnchainDiagnostics(CONFIG, reads), "network");
    expect(check.status).toBe("fail");
    expect(check.expected).toBe("84532");
    expect(check.actual).toBe("8453");
  });

  it("fails when escrow address has no bytecode (not deployed)", () => {
    const reads = healthyReads();
    reads.escrowBytecodePresent = ok(false);
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "escrow_contract").status).toBe("fail");
  });

  it("fails escrow_usdc when contract references a different USDC", () => {
    const reads = healthyReads();
    reads.escrowUsdc = ok("0xDIFFERENT00000000000000000000000000000001");
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "escrow_usdc").status).toBe("fail");
  });

  it("fails operator when not allowed and not owner", () => {
    const reads = healthyReads();
    reads.operatorAllowed = ok(false);
    reads.escrowOwner = ok("0xSOMEONEELSE0000000000000000000000000001");
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "operator").status).toBe("fail");
  });

  it("passes operator when operator is the contract owner even if operators=false", () => {
    const reads = healthyReads();
    reads.operatorAllowed = ok(false);
    reads.escrowOwner = ok(CONFIG.operatorAddress.toLowerCase());
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "operator").status).toBe("pass");
  });

  it("fails operator check on read error", () => {
    const reads = healthyReads();
    reads.operatorAllowed = err<boolean>("revert");
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "operator").status).toBe("fail");
  });

  it("warns (not fail) on treasury and fee drift", () => {
    const reads = healthyReads();
    reads.escrowTreasury = ok("0xOTHERTREASURY00000000000000000000000001");
    reads.escrowPlatformFeeBps = ok(1500);
    const result = buildOnchainDiagnostics(CONFIG, reads);
    expect(find(result, "treasury").status).toBe("warn");
    expect(find(result, "platform_fee").status).toBe("warn");
    expect(result.summary.ok).toBe(true); // warnings do not fail overall
  });

  it("warns when USDC decimals are not 6", () => {
    const reads = healthyReads();
    reads.usdcDecimals = ok(18);
    reads.usdcSymbol = ok("FAKE");
    expect(find(buildOnchainDiagnostics(CONFIG, reads), "usdc_token").status).toBe("warn");
  });

  it("warns when onchain feature flag is disabled", () => {
    const result = buildOnchainDiagnostics({ ...CONFIG, enabled: false }, healthyReads());
    expect(find(result, "feature_flag").status).toBe("warn");
  });
});
