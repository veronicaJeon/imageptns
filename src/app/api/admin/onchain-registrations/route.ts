import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { assertArweaveConfigured, uploadBufferToArweave, verifyArweaveTransactions } from "@/lib/arweave/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";
import { imageAssetBytes32 } from "@/lib/onchain/ids";
import { canonicalImageProofHash, sha256Buffer } from "@/lib/onchain/proof";
import { recordOnchainEvent } from "@/lib/onchain/events";
import {
  buildArweaveCredentialMetadata,
  summarizeRegistrationSelection,
  type AuthorshipDeclaration,
} from "@/lib/onchain/registration";

export const maxDuration = 300;

type RegistrationStatus = "requested" | "pending" | "registered" | "failed" | "available" | "all";

interface AdminRegistrationImage {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  status: string;
  storage_path_original: string | null;
  storage_path_preview: string | null;
  original_filename: string | null;
  file_format: string | null;
  file_size_mb: number | null;
  photographer_id: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
  authorship_declaration: AuthorshipDeclaration | null;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_batch_id: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  proof_request_fee_payer: string | null;
  proof_request_kind: string | null;
  proof_request_fee_krw: number | null;
  photographer: { id: string; full_name: string | null; wallet_address: string | null } | { id: string; full_name: string | null; wallet_address: string | null }[] | null;
}

interface BatchRow {
  id: string;
  status: string;
  image_count: number;
  total_bytes: number;
  arweave_manifest_tx_id: string | null;
  arweave_confirmed_at: string | null;
  graph_verified_at: string | null;
  error_message: string | null;
  created_at: string;
}

function validStatus(value: string | null): value is RegistrationStatus {
  return ["requested", "pending", "registered", "failed", "available", "all"].includes(value ?? "");
}

function normalizeImage(row: AdminRegistrationImage) {
  return {
    ...row,
    storage_path_preview: previewUrl(row.storage_path_preview),
  };
}

function contentTypeForImage(image: AdminRegistrationImage) {
  const format = image.file_format?.toUpperCase();
  if (format === "JPEG" || format === "JPG") return "image/jpeg";
  if (format === "PNG") return "image/png";
  if (format === "WEBP") return "image/webp";
  if (format === "TIFF" || format === "TIF") return "image/tiff";
  return "application/octet-stream";
}

function firstPhotographer(image: AdminRegistrationImage) {
  return Array.isArray(image.photographer) ? image.photographer[0] : image.photographer;
}

async function verifyAndPersist(imageIds: string[], actorId: string) {
  const admin = createAdminClient();
  const { data: images, error } = await admin
    .from("images")
    .select("id, proof_batch_id, proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id")
    .in("id", imageIds);

  if (error) throw new Error(error.message);

  const rows = (images ?? []) as Pick<
    AdminRegistrationImage,
    "id" | "proof_batch_id" | "proof_arweave_original_tx_id" | "proof_arweave_metadata_tx_id" | "proof_arweave_manifest_tx_id"
  >[];
  const ids = Array.from(new Set(rows.flatMap((row) => [
    row.proof_arweave_original_tx_id,
    row.proof_arweave_metadata_tx_id,
    row.proof_arweave_manifest_tx_id,
  ]).filter(Boolean) as string[]));
  const verification = await verifyArweaveTransactions(ids);
  const verifiedAt = new Date().toISOString();

  const results: Array<{ imageId: string; confirmed: boolean; arweaveTxIds: string[] }> = [];
  for (const row of rows) {
    const relatedIds = [
      row.proof_arweave_original_tx_id,
      row.proof_arweave_metadata_tx_id,
      row.proof_arweave_manifest_tx_id,
    ].filter(Boolean) as string[];
    const confirmed = relatedIds.length > 0 && relatedIds.every((id) => verification[id]?.confirmed);

    if (confirmed) {
      await admin
        .from("images")
        .update({
          proof_status: "registered",
          proof_registered_at: verifiedAt,
          proof_arweave_confirmed_at: verifiedAt,
          proof_failure_reason: null,
        })
        .eq("id", row.id)
        .in("proof_status", ["pending", "registered"]);
      await recordOnchainEvent(admin, {
        eventType: "proof_arweave_confirmed",
        actorId,
        imageId: row.id,
        metadata: { arweaveTxIds: relatedIds },
      });
    }

    results.push({ imageId: row.id, confirmed, arweaveTxIds: relatedIds });
  }

  const batchIds = Array.from(new Set(rows.map((row) => row.proof_batch_id).filter(Boolean) as string[]));
  for (const batchId of batchIds) {
    const batchRows = rows.filter((row) => row.proof_batch_id === batchId);
    const allBatchImagesConfirmed = batchRows.every((row) =>
      results.find((result) => result.imageId === row.id)?.confirmed,
    );
    await admin
      .from("onchain_registration_batches")
      .update({
        status: allBatchImagesConfirmed ? "confirmed" : "uploaded",
        arweave_confirmed_at: allBatchImagesConfirmed ? verifiedAt : null,
        graph_verified_at: verifiedAt,
        updated_at: verifiedAt,
      })
      .eq("id", batchId);
  }

  return { results };
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "requested";
  if (!validStatus(status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });

  const admin = createAdminClient();
  let query = admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status,
      storage_path_original, storage_path_preview, original_filename,
      file_format, file_size_mb, photographer_id,
      copyright_license, free_usage_policy, authorship_declaration,
      proof_status, proof_requested_at, proof_registered_at, proof_batch_id,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_manifest_tx_id, proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
      photographer:profiles!photographer_id(id, full_name, wallet_address)
    `)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .order("proof_requested_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("proof_status", status);
  else query = query.in("proof_status", ["available", "requested", "pending", "registered", "failed"]);

  const [{ data: images, error }, { data: batches, error: batchError }] = await Promise.all([
    query,
    admin
      .from("onchain_registration_batches")
      .select("id, status, image_count, total_bytes, arweave_manifest_tx_id, arweave_confirmed_at, graph_verified_at, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 });

  return NextResponse.json({
    images: ((images ?? []) as AdminRegistrationImage[]).map(normalizeImage),
    batches: (batches ?? []) as BatchRow[],
  });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as { action?: "register" | "verify"; imageIds?: string[] } | null;
  const action = body?.action ?? "register";
  const imageIds = Array.from(new Set(body?.imageIds ?? [])).filter(Boolean);
  if (imageIds.length === 0) return NextResponse.json({ error: "imageIds required" }, { status: 400 });

  if (action === "verify") {
    try {
      const verification = await verifyAndPersist(imageIds, adminUser.id);
      return NextResponse.json(verification);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
    }
  }

  const admin = createAdminClient();
  const { data: loaded, error: loadError } = await admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status,
      storage_path_original, storage_path_preview, original_filename,
      file_format, file_size_mb, photographer_id,
      copyright_license, free_usage_policy, authorship_declaration,
      proof_status, proof_requested_at, proof_registered_at, proof_batch_id,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_manifest_tx_id, proof_arweave_confirmed_at, proof_failure_reason,
      proof_request_fee_payer, proof_request_kind, proof_request_fee_krw,
      photographer:profiles!photographer_id(id, full_name, wallet_address)
    `)
    .in("id", imageIds)
    .eq("status", "approved")
    .eq("lifecycle_status", "active");

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const images = (loaded ?? []) as AdminRegistrationImage[];
  const eligible = images.filter((image) =>
    ["requested", "available", "failed"].includes(image.proof_status ?? "not_registered") &&
    image.asset_id &&
    image.photographer_id &&
    image.storage_path_original
  );
  if (eligible.length !== imageIds.length) {
    return NextResponse.json(
      { error: "Only approved images with requested/available/failed status and original files can be registered" },
      { status: 409 },
    );
  }

  try {
    assertArweaveConfigured();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }

  for (const image of eligible) {
    const wallet = firstPhotographer(image)?.wallet_address;
    if (wallet) {
      try { getAddress(wallet); } catch {
        return NextResponse.json({ error: `${image.asset_id} photographer wallet address is invalid` }, { status: 400 });
      }
    }
  }

  const summary = summarizeRegistrationSelection(
    eligible.map((image) => ({ id: image.id, fileSizeMb: image.file_size_mb })),
  );
  const { data: batch, error: batchError } = await admin
    .from("onchain_registration_batches")
    .insert({
      admin_id: adminUser.id,
      image_count: summary.count,
      total_bytes: summary.totalBytes,
      status: "pending",
    })
    .select("id")
    .single();

  if (batchError) return NextResponse.json({ error: batchError.message }, { status: 500 });

  const batchId = batch.id as string;
  await admin
    .from("images")
    .update({ proof_status: "pending", proof_batch_id: batchId, proof_failure_reason: null })
    .in("id", eligible.map((image) => image.id));

  await recordOnchainEvent(admin, {
    eventType: "proof_registration_batch_created",
    actorId: adminUser.id,
    metadata: { batchId, imageIds, ...summary },
  });

  const manifestItems: Array<{ imageId: string; assetId: string; originalTxId: string; metadataTxId: string }> = [];
  const now = new Date().toISOString();

  try {
    for (const image of eligible) {
      const original = await admin.storage.from("images-original").download(image.storage_path_original!);
      if (original.error || !original.data) throw original.error ?? new Error("Original image download failed");

      const originalBuffer = Buffer.from(await original.data.arrayBuffer());
      const originalFileSha256 = sha256Buffer(originalBuffer);
      const contentHash = canonicalImageProofHash({
        assetId: image.asset_id!,
        photographerId: image.photographer_id!,
        storagePathOriginal: image.storage_path_original!,
        title: image.title,
        originalFileSha256,
      });
      const onchainAssetId = imageAssetBytes32(image.asset_id!);
      const originalUpload = await uploadBufferToArweave(
        originalBuffer,
        contentTypeForImage(image),
        [
          { name: "Image-Partners-Asset-Id", value: image.asset_id! },
          { name: "Image-Partners-Image-Id", value: image.id },
          { name: "Image-Partners-Batch-Id", value: batchId },
          { name: "Credential-Part", value: "original" },
        ],
      );
      const metadata = buildArweaveCredentialMetadata({
        appName: "Image Partners",
        assetId: image.asset_id!,
        imageId: image.id,
        photographerId: image.photographer_id!,
        title: image.title,
        originalFilename: image.original_filename,
        originalFileSha256,
        fileSizeBytes: originalBuffer.byteLength,
        contentType: contentTypeForImage(image),
        storagePathOriginal: image.storage_path_original!,
        copyrightLicense: image.copyright_license ?? "standard",
        freeUsagePolicy: image.free_usage_policy ?? "none",
        authorshipDeclaration: image.authorship_declaration ?? "human_original",
        arweaveOriginalTxId: originalUpload.id,
        contentHash,
        onchainAssetId,
        ledgerKey: onchainAssetId,
        createdAt: now,
      });
      const metadataBuffer = Buffer.from(JSON.stringify(metadata, null, 2));
      const metadataUpload = await uploadBufferToArweave(
        metadataBuffer,
        "application/json",
        [
          { name: "Image-Partners-Asset-Id", value: image.asset_id! },
          { name: "Image-Partners-Image-Id", value: image.id },
          { name: "Image-Partners-Batch-Id", value: batchId },
          { name: "Credential-Part", value: "metadata" },
        ],
      );

      manifestItems.push({
        imageId: image.id,
        assetId: image.asset_id!,
        originalTxId: originalUpload.id,
        metadataTxId: metadataUpload.id,
      });

      await admin
        .from("images")
        .update({
          onchain_asset_id: onchainAssetId,
          content_hash: contentHash,
          proof_arweave_original_tx_id: originalUpload.id,
          proof_arweave_metadata_tx_id: metadataUpload.id,
          proof_original_sha256: originalFileSha256,
          proof_file_size_bytes: originalBuffer.byteLength,
          proof_metadata: metadata,
          proof_failure_reason: null,
        })
        .eq("id", image.id);

      await recordOnchainEvent(admin, {
        eventType: "proof_arweave_uploaded",
        actorId: adminUser.id,
        imageId: image.id,
        metadata: {
          batchId,
          assetId: image.asset_id,
          originalTxId: originalUpload.id,
          metadataTxId: metadataUpload.id,
          originalFileSha256,
        },
      });
    }

    const manifest = {
      schema: "imagepartners.photo-credential-batch.v1",
      batchId,
      createdAt: now,
      imageCount: manifestItems.length,
      totalBytes: summary.totalBytes,
      items: manifestItems,
    };
    const manifestUpload = await uploadBufferToArweave(
      Buffer.from(JSON.stringify(manifest, null, 2)),
      "application/json",
      [
        { name: "Image-Partners-Batch-Id", value: batchId },
        { name: "Credential-Part", value: "batch-manifest" },
      ],
    );

    await admin
      .from("images")
      .update({ proof_arweave_manifest_tx_id: manifestUpload.id })
      .in("id", eligible.map((image) => image.id));

    await admin
      .from("onchain_registration_batches")
      .update({
        status: "uploaded",
        arweave_manifest_tx_id: manifestUpload.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchId);

    const verification = await verifyAndPersist(eligible.map((image) => image.id), adminUser.id);
    return NextResponse.json({ batchId, manifestTxId: manifestUpload.id, summary, ...verification });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin
      .from("images")
      .update({ proof_status: "failed", proof_failure_reason: message })
      .in("id", eligible.map((image) => image.id))
      .eq("proof_status", "pending");
    await admin
      .from("onchain_registration_batches")
      .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", batchId);

    await recordOnchainEvent(admin, {
      eventType: "proof_registration_failed",
      severity: "error",
      actorId: adminUser.id,
      metadata: { batchId, imageIds, errorMessage: message },
    });

    return NextResponse.json({ error: message, batchId }, { status: 500 });
  }
}
