import { NextRequest, NextResponse } from "next/server";
import { decodeEventLog, decodeFunctionData, getAddress, isHex, type Address, type Hex } from "viem";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ClaimConfirmBody {
  txHash?: string;
  walletAddress?: string;
}

interface ClaimableLedgerRow {
  id: string;
  claimable_amount: number | string | null;
  created_at: string;
}

interface UsedClaimTxRow {
  photographer_id: string;
  settlement_provider: string;
  claim_status: string;
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function decimalToUnits(value: number | string, decimals: number) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount");

  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error("Invalid decimal amount");
  }
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole}${paddedFraction}`.replace(/^0+/, "") || "0");
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: ClaimConfirmBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body.txHash || !isHex(body.txHash) || !body.walletAddress) {
    return badRequest("txHash and walletAddress are required");
  }

  const txHash = body.txHash as Hex;
  const normalizedTxHash = txHash.toLowerCase();
  let walletAddress: Address;
  try {
    walletAddress = getAddress(body.walletAddress);
  } catch {
    return badRequest("walletAddress is invalid");
  }

  let config;
  try {
    config = getOnchainServerConfig();
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Onchain claims are not configured" }, { status: 500 });
  }

  const admin = createAdminClient();
  const { data: profile, error: profileLoadError } = await admin
    .from("profiles")
    .select("wallet_address")
    .eq("id", user.id)
    .single();

  if (profileLoadError) return NextResponse.json({ error: profileLoadError.message }, { status: 500 });

  let existingProfileWallet: Address | null = null;
  if (profile?.wallet_address) {
    try {
      existingProfileWallet = getAddress(profile.wallet_address);
    } catch {
      return NextResponse.json({ error: "Stored profile wallet is invalid" }, { status: 409 });
    }
  }
  if (existingProfileWallet && existingProfileWallet !== walletAddress) {
    return badRequest("Profile wallet mismatch");
  }

  const { data: usedTxRowsData, error: usedTxRowsError } = await admin
    .from("earnings_ledger")
    .select("photographer_id, settlement_provider, claim_status")
    .eq("claim_tx_hash", normalizedTxHash);

  if (usedTxRowsError) return NextResponse.json({ error: usedTxRowsError.message }, { status: 500 });

  const usedTxRows = (usedTxRowsData ?? []) as unknown as UsedClaimTxRow[];
  const txAlreadyConfirmedForUser =
    usedTxRows.length > 0 &&
    usedTxRows.every((row) =>
      row.photographer_id === user.id &&
      row.settlement_provider === "onchain_escrow" &&
      row.claim_status === "claimed",
    );

  if (usedTxRows.length > 0 && !txAlreadyConfirmedForUser) {
    return NextResponse.json({ error: "Claim transaction hash is already used" }, { status: 409 });
  }

  const publicClient = getOnchainPublicClient();
  const escrowAddress = getAddress(config.escrowAddress);

  const transaction = await publicClient.getTransaction({ hash: txHash });
  if (!transaction.to || getAddress(transaction.to) !== escrowAddress) {
    return badRequest("Transaction was not sent to escrow contract");
  }
  if (getAddress(transaction.from) !== walletAddress) {
    return badRequest("Transaction sender wallet mismatch");
  }

  let decodedFunction;
  try {
    decodedFunction = decodeFunctionData({
      abi: IMAGE_PARTNERS_ESCROW_ABI,
      data: transaction.input,
    });
  } catch {
    return badRequest("Transaction calldata is not a recognized escrow call");
  }

  if (decodedFunction.functionName !== "claim") {
    return badRequest("Transaction is not a claim call");
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return badRequest("Claim transaction failed");

  const claimEvents = receipt.logs.flatMap((log) => {
    if (getAddress(log.address) !== escrowAddress) return [];

    try {
      const event = decodeEventLog({
        abi: IMAGE_PARTNERS_ESCROW_ABI,
        data: log.data,
        topics: log.topics,
      });

      return event.eventName === "Claimed" ? [event] : [];
    } catch {
      return [];
    }
  });

  const claimEvent = claimEvents.find((event) => getAddress(event.args.photographer) === walletAddress);
  if (!claimEvent) return badRequest("Claimed event missing");

  const { data: claimableRowsData, error: claimableRowsError } = await admin
    .from("earnings_ledger")
    .select("id, claimable_amount, created_at")
    .eq("photographer_id", user.id)
    .eq("settlement_provider", "onchain_escrow")
    .eq("claim_status", "claimable");

  if (claimableRowsError) return NextResponse.json({ error: claimableRowsError.message }, { status: 500 });

  const claimableRows = (claimableRowsData ?? []) as unknown as ClaimableLedgerRow[];
  if (claimableRows.length === 0) {
    if (txAlreadyConfirmedForUser) return NextResponse.json({ ok: true, alreadyConfirmed: true });

    return NextResponse.json({ error: "No claimable onchain earnings found" }, { status: 409 });
  }

  if (txAlreadyConfirmedForUser) {
    return NextResponse.json({ error: "Claim transaction hash is already used" }, { status: 409 });
  }

  const latestClaimableCreatedAt = claimableRows.reduce((latest, row) => {
    const rowTime = Date.parse(row.created_at);
    if (!Number.isFinite(rowTime)) return Number.NaN;
    return Math.max(latest, rowTime);
  }, 0);
  if (!Number.isFinite(latestClaimableCreatedAt)) {
    return NextResponse.json({ error: "Claimable row timestamp is invalid" }, { status: 409 });
  }

  const claimBlock = await publicClient.getBlock({ blockHash: receipt.blockHash });
  const claimBlockTimestampMs = Number(claimBlock.timestamp) * 1000;
  if (claimBlockTimestampMs < latestClaimableCreatedAt) {
    return badRequest("Claim transaction predates current claimable earnings");
  }

  let expectedClaimAmount: bigint;
  try {
    expectedClaimAmount = claimableRows.reduce(
      (sum, row) => sum + decimalToUnits(row.claimable_amount ?? "0", 6),
      BigInt(0),
    );
  } catch {
    return NextResponse.json({ error: "Claimable amount is invalid" }, { status: 409 });
  }

  if (claimEvent.args.amount !== expectedClaimAmount) {
    return badRequest("Claim amount mismatch");
  }

  if (!existingProfileWallet) {
    const { data: updatedProfile, error: profileError } = await admin
      .from("profiles")
      .update({ wallet_address: walletAddress })
      .eq("id", user.id)
      .is("wallet_address", null)
      .select("id")
      .maybeSingle();

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    if (!updatedProfile) {
      return NextResponse.json({ error: "Profile wallet changed during confirmation" }, { status: 409 });
    }
  }

  const { data: updatedRows, error: ledgerError } = await admin
    .from("earnings_ledger")
    .update({ claim_status: "claimed", claim_tx_hash: normalizedTxHash })
    .eq("photographer_id", user.id)
    .eq("settlement_provider", "onchain_escrow")
    .eq("claim_status", "claimable")
    .in("id", claimableRows.map((row) => row.id))
    .select("id");

  if (ledgerError) return NextResponse.json({ error: ledgerError.message }, { status: 500 });
  if (!updatedRows || updatedRows.length !== claimableRows.length) {
    return NextResponse.json({ error: "Claimable earnings changed during confirmation" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
