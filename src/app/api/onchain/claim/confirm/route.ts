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
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function decimalToUnits(value: number | string, decimals: number) {
  const normalized = String(value).trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) throw new Error("Invalid decimal amount");

  const [whole, fraction = ""] = normalized.split(".");
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

  const admin = createAdminClient();
  const { data: claimableRowsData, error: claimableRowsError } = await admin
    .from("earnings_ledger")
    .select("id, claimable_amount")
    .eq("photographer_id", user.id)
    .eq("settlement_provider", "onchain_escrow")
    .eq("claim_status", "claimable");

  if (claimableRowsError) return NextResponse.json({ error: claimableRowsError.message }, { status: 500 });

  const claimableRows = (claimableRowsData ?? []) as unknown as ClaimableLedgerRow[];
  if (claimableRows.length === 0) {
    const { data: alreadyClaimed, error: alreadyClaimedError } = await admin
      .from("earnings_ledger")
      .select("id")
      .eq("photographer_id", user.id)
      .eq("settlement_provider", "onchain_escrow")
      .eq("claim_status", "claimed")
      .eq("claim_tx_hash", receipt.transactionHash)
      .limit(1);

    if (alreadyClaimedError) return NextResponse.json({ error: alreadyClaimedError.message }, { status: 500 });
    if (alreadyClaimed && alreadyClaimed.length > 0) return NextResponse.json({ ok: true });

    return NextResponse.json({ error: "No claimable onchain earnings found" }, { status: 409 });
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

  const { error: profileError } = await admin
    .from("profiles")
    .update({ wallet_address: walletAddress })
    .eq("id", user.id);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { data: updatedRows, error: ledgerError } = await admin
    .from("earnings_ledger")
    .update({ claim_status: "claimed", claim_tx_hash: receipt.transactionHash })
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
