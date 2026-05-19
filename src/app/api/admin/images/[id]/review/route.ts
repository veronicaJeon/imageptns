import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendImageApproved, sendImageRejected } from "@/lib/email/resend";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { imageAssetBytes32 } from "@/lib/onchain/ids";
import { canonicalImageProofHash, sha256Buffer } from "@/lib/onchain/proof";
import { getOnchainOperatorClient, getOnchainPublicClient } from "@/lib/onchain/server";

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

interface ReviewImage {
  id: string;
  asset_id: string | null;
  title: string;
  storage_path_original: string | null;
  photographer_id: string | null;
  photographer: { wallet_address: string | null } | { wallet_address: string | null }[] | null;
}

interface ReviewResponseImage {
  id: string;
  status: string;
  rejection_reason: string | null;
  approved_at: string | null;
  title: string;
  asset_id: string | null;
  photographer_id: string | null;
  proof_status?: string | null;
  proof_registered_at?: string | null;
  proof_tx_hash?: string | null;
}

function photographerWalletAddress(photographer: ReviewImage["photographer"]) {
  const profile = Array.isArray(photographer) ? photographer[0] : photographer;
  return profile?.wallet_address ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action, rejection_reason } = body as {
    action: "approve" | "reject";
    rejection_reason?: string;
  };

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });
  }
  if (action === "reject" && !rejection_reason?.trim()) {
    return NextResponse.json({ error: "rejection_reason required" }, { status: 400 });
  }

  const admin = createAdminClient();
  let data: ReviewResponseImage;

  if (action === "approve") {
    const { data: loadedImage, error: loadError } = await admin
      .from("images")
      .select("id, asset_id, title, storage_path_original, photographer_id, photographer:profiles!photographer_id(wallet_address)")
      .eq("id", id)
      .single();

    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    const image = loadedImage as ReviewImage;
    if (!image.asset_id) return NextResponse.json({ error: "Image asset_id required for onchain proof" }, { status: 400 });
    if (!image.storage_path_original) return NextResponse.json({ error: "Original image file required for onchain proof" }, { status: 400 });
    if (!image.photographer_id) return NextResponse.json({ error: "Photographer required for onchain proof" }, { status: 400 });

    const walletAddress = photographerWalletAddress(image.photographer);
    if (!walletAddress) {
      return NextResponse.json({ error: "Photographer wallet address required for onchain approval" }, { status: 400 });
    }

    let photographerAddress;
    try {
      photographerAddress = getAddress(walletAddress);
    } catch {
      return NextResponse.json({ error: "Photographer wallet address is invalid" }, { status: 400 });
    }

    const downloaded = await admin.storage.from("images-original").download(image.storage_path_original);
    if (downloaded.error) {
      return NextResponse.json({ error: downloaded.error.message }, { status: 500 });
    }

    const originalFileSha256 = sha256Buffer(Buffer.from(await downloaded.data.arrayBuffer()));
    const contentHash = canonicalImageProofHash({
      assetId: image.asset_id,
      photographerId: image.photographer_id,
      storagePathOriginal: image.storage_path_original,
      title: image.title,
      originalFileSha256,
    });
    const onchainAssetId = imageAssetBytes32(image.asset_id);
    let config;
    try {
      config = getOnchainServerConfig();
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: "Onchain proof registration is not configured" }, { status: 500 });
    }

    const pending = await admin
      .from("images")
      .update({
        proof_status: "pending",
        content_hash: contentHash,
        onchain_asset_id: onchainAssetId,
        chain_id: config.chainId,
      })
      .eq("id", id);

    if (pending.error) return NextResponse.json({ error: pending.error.message }, { status: 500 });

    let txHash: `0x${string}` | null = null;
    try {
      const walletClient = getOnchainOperatorClient();
      const publicClient = getOnchainPublicClient();

      txHash = await walletClient.writeContract({
        address: config.escrowAddress,
        abi: IMAGE_PARTNERS_ESCROW_ABI,
        functionName: "registerAsset",
        args: [onchainAssetId, contentHash, photographerAddress, `imageptns://${image.asset_id}`],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        await admin
          .from("images")
          .update({ proof_status: "failed", proof_tx_hash: txHash })
          .eq("id", id);
        return NextResponse.json({ error: "Onchain proof registration failed" }, { status: 502 });
      }
    } catch (error) {
      console.error(error);
      await admin
        .from("images")
        .update({ proof_status: "failed", proof_tx_hash: txHash })
        .eq("id", id);
      return NextResponse.json(
        { error: "Onchain proof registration failed" },
        { status: 502 }
      );
    }

    const approvedAt = new Date().toISOString();
    const { data: approved, error: approveError } = await admin
      .from("images")
      .update({
        status: "approved",
        approved_at: approvedAt,
        rejection_reason: null,
        proof_status: "registered",
        proof_registered_at: approvedAt,
        proof_tx_hash: txHash,
      })
      .eq("id", id)
      .select("id, status, rejection_reason, approved_at, title, asset_id, photographer_id, proof_status, proof_registered_at, proof_tx_hash")
      .single();

    if (approveError) return NextResponse.json({ error: approveError.message }, { status: 500 });
    data = approved;
  } else {
    const { data: rejected, error } = await admin
      .from("images")
      .update({ status: "rejected", rejection_reason: rejection_reason!.trim(), approved_at: null })
      .eq("id", id)
      .select("id, status, rejection_reason, approved_at, title, asset_id, photographer_id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = rejected;
  }

  // Fire-and-forget notification — never block the response
  const photographerId = data.photographer_id;
  if (photographerId) {
    (async () => {
      const [profileRes, authRes] = await Promise.all([
        admin.from("profiles").select("full_name").eq("id", photographerId).single(),
        admin.auth.admin.getUserById(photographerId),
      ]);
      const email = authRes.data.user?.email;
      const name  = profileRes.data?.full_name ?? "사진작가";
      if (!email) return;
      const assetId = data.asset_id ?? data.id;

      if (action === "approve") {
        await sendImageApproved({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId });
      } else {
        await sendImageRejected({ photographerEmail: email, photographerName: name, imageTitle: data.title, assetId, reason: rejection_reason! });
      }
    })().catch(console.error);
  }

  return NextResponse.json({ image: data });
}
