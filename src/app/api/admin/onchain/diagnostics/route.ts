import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import {
  buildOnchainDiagnostics,
  type DiagnosticRead,
  type OnchainDiagnosticReads,
} from "@/lib/onchain/diagnostics";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// View-only ABI fragments for diagnostics (kept separate from the verified
// purchase/confirm ABI to avoid touching that surface).
const ESCROW_VIEW_ABI = [
  { type: "function", name: "usdc", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "platformFeeBps", stateMutability: "view", inputs: [], outputs: [{ type: "uint16" }] },
  { type: "function", name: "owner", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "operators", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const ERC20_VIEW_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  return profile?.is_admin ? user : null;
}

async function safeRead<T>(fn: () => Promise<T>): Promise<DiagnosticRead<T>> {
  try {
    return { value: await fn(), error: null };
  } catch (error) {
    return { value: null, error: error instanceof Error ? error.message : "read failed" };
  }
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let config;
  try {
    config = getOnchainServerConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onchain configuration is unavailable";
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      configured: false,
      config: null,
      checks: [
        { id: "config_loaded", label: "온체인 환경변수 로드", status: "fail", detail: message },
      ],
      summary: { pass: 0, fail: 1, warn: 0, info: 0, ok: false },
    });
  }

  let operatorAddress: string;
  try {
    operatorAddress = privateKeyToAccount(config.operatorPrivateKey).address;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operator key is invalid";
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      configured: false,
      config: null,
      checks: [
        { id: "config_loaded", label: "Operator 키 파생", status: "fail", detail: message },
      ],
      summary: { pass: 0, fail: 1, warn: 0, info: 0, ok: false },
    });
  }

  const publicClient = getOnchainPublicClient();
  const escrowAddress = getAddress(config.escrowAddress);
  const usdcAddress = getAddress(config.usdcAddress);
  const escrow = { address: escrowAddress, abi: ESCROW_VIEW_ABI } as const;

  const [
    rpcChainId,
    escrowBytecode,
    escrowUsdc,
    escrowTreasury,
    escrowPlatformFeeBps,
    escrowOwner,
    operatorAllowed,
    usdcDecimals,
    usdcSymbol,
  ] = await Promise.all([
    safeRead(() => publicClient.getChainId()),
    safeRead(() => publicClient.getBytecode({ address: escrowAddress })),
    safeRead(() => publicClient.readContract({ ...escrow, functionName: "usdc" }) as Promise<string>),
    safeRead(() => publicClient.readContract({ ...escrow, functionName: "treasury" }) as Promise<string>),
    safeRead(() => publicClient.readContract({ ...escrow, functionName: "platformFeeBps" }) as Promise<number>),
    safeRead(() => publicClient.readContract({ ...escrow, functionName: "owner" }) as Promise<string>),
    safeRead(() => publicClient.readContract({ ...escrow, functionName: "operators", args: [getAddress(operatorAddress)] }) as Promise<boolean>),
    safeRead(() => publicClient.readContract({ address: usdcAddress, abi: ERC20_VIEW_ABI, functionName: "decimals" }) as Promise<number>),
    safeRead(() => publicClient.readContract({ address: usdcAddress, abi: ERC20_VIEW_ABI, functionName: "symbol" }) as Promise<string>),
  ]);

  const escrowBytecodePresent: DiagnosticRead<boolean> = escrowBytecode.error
    ? { value: null, error: escrowBytecode.error }
    : { value: Boolean(escrowBytecode.value && escrowBytecode.value !== "0x"), error: null };

  const reads: OnchainDiagnosticReads = {
    rpcChainId,
    escrowBytecodePresent,
    escrowUsdc,
    escrowTreasury,
    escrowPlatformFeeBps,
    escrowOwner,
    operatorAllowed,
    usdcDecimals,
    usdcSymbol,
  };

  const { checks, summary } = buildOnchainDiagnostics(
    {
      enabled: config.enabled,
      chainId: config.chainId,
      escrowAddress,
      usdcAddress,
      treasuryAddress: getAddress(config.treasuryAddress),
      operatorAddress: getAddress(operatorAddress),
      platformFeeBps: config.platformFeeBps,
      usdcPerKrw: config.usdcPerKrw,
    },
    reads,
  );

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    configured: true,
    config: {
      chainId: config.chainId,
      explorerUrl: config.explorerUrl,
      escrowAddress,
      usdcAddress,
      treasuryAddress: getAddress(config.treasuryAddress),
      operatorAddress: getAddress(operatorAddress),
      platformFeeBps: config.platformFeeBps,
      usdcPerKrw: config.usdcPerKrw,
    },
    checks,
    summary,
  });
}
