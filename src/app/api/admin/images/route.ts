import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import {
  applyAdminImageListLifecycleFilter,
  applyAdminReviewableLifecycleFilter,
} from "@/lib/images/admin-list";
import { createAdminClient } from "@/lib/supabase/admin";
import { previewUrl } from "@/lib/supabase/storage";

interface AdminImageListRow {
  storage_path_preview: string | null;
  duplicate_of_fingerprint_id?: string | null;
}

interface DuplicateFingerprintRow {
  id: string;
  image_id: string | null;
}

interface DuplicateCandidateRow {
  id: string;
  asset_id: string | null;
  title: string;
  title_ko: string | null;
  storage_path_preview: string | null;
  photographer_id: string | null;
  photographer: { full_name: string | null } | { full_name: string | null }[] | null;
}

function clampPage(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return parsed;
}

function clampPageSize(value: string | null) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return 50;
  return Math.min(Math.max(parsed, 10), 100);
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase().replace(/[{}"\\,]/g, "");
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const queryText = req.nextUrl.searchParams.get("query")?.trim() ?? "";
  const page = clampPage(req.nextUrl.searchParams.get("page"));
  const pageSize = clampPageSize(req.nextUrl.searchParams.get("pageSize"));
  const promotionalUseOnly = req.nextUrl.searchParams.get("promotionalUse") === "true";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const admin = createAdminClient();

  let query = admin
    .from("images")
    .select(`
    id, asset_id, title, title_ko, title_en, description, description_ko, description_en, category, tags, tags_ko, tags_en,
    status, rejection_reason, is_published, unpublished_at, unpublished_reason,
    lifecycle_status, deletion_requested_at, deletion_fee_krw, deletion_fee_status,
    chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at,
    proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id,
    storage_path_preview, storage_path_original,
    promotional_use_allowed, promotional_use_consented_at, promotional_use_consent_version, promotional_use_revoked_at, promotional_use_basis,
    width, height, resolution_mp, file_format, file_size_mb,
    views_count, sales_count, created_at, approved_at,
    duplicate_review_status, duplicate_of_fingerprint_id, duplicate_match_kind,
    duplicate_phash_distance, duplicate_dhash_distance, duplicate_review_reason,
    photographer:profiles!photographer_id(id, full_name, avatar_url, wallet_address)
  `, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  query = status === "all"
    ? applyAdminImageListLifecycleFilter(query)
    : applyAdminReviewableLifecycleFilter(query);
  if (status !== "all") query = query.eq("status", status);
  if (promotionalUseOnly) {
    query = query
      .eq("promotional_use_allowed", true)
      .not("promotional_use_consented_at", "is", null)
      .not("promotional_use_consent_version", "is", null)
      .not("promotional_use_basis", "is", null)
      .is("promotional_use_revoked_at", null)
      .eq("status", "approved")
      .eq("is_published", true)
      .eq("lifecycle_status", "active");
  }
  if (queryText) {
    const escaped = escapeLike(queryText);
    const tag = normalizeTag(queryText);
    query = query.or(`title.ilike.%${escaped}%,asset_id.ilike.%${escaped}%,tags.cs.{${tag}}`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fingerprintIds = [...new Set((data ?? [])
    .map((img: AdminImageListRow) => img.duplicate_of_fingerprint_id)
    .filter((id): id is string => Boolean(id)))];
  const fingerprintMap = new Map<string, DuplicateFingerprintRow>();
  const candidateMap = new Map<string, DuplicateCandidateRow>();

  if (fingerprintIds.length > 0) {
    const { data: fingerprints, error: fingerprintsError } = await admin
      .from("image_fingerprints")
      .select("id, image_id")
      .in("id", fingerprintIds);
    if (fingerprintsError) return NextResponse.json({ error: fingerprintsError.message }, { status: 500 });
    for (const fingerprint of (fingerprints ?? []) as DuplicateFingerprintRow[]) {
      fingerprintMap.set(fingerprint.id, fingerprint);
    }

    const candidateIds = [...new Set((fingerprints ?? [])
      .map((fingerprint: DuplicateFingerprintRow) => fingerprint.image_id)
      .filter((id): id is string => Boolean(id)))];
    if (candidateIds.length > 0) {
      const { data: candidates, error: candidatesError } = await admin
        .from("images")
        .select("id, asset_id, title, title_ko, storage_path_preview, photographer_id, photographer:profiles!photographer_id(full_name)")
        .in("id", candidateIds);
      if (candidatesError) return NextResponse.json({ error: candidatesError.message }, { status: 500 });
      for (const candidate of (candidates ?? []) as unknown as DuplicateCandidateRow[]) {
        candidateMap.set(candidate.id, candidate);
      }
    }
  }

  const images = (data ?? []).map((img: AdminImageListRow) => {
    const fingerprint = img.duplicate_of_fingerprint_id
      ? fingerprintMap.get(img.duplicate_of_fingerprint_id)
      : null;
    const candidate = fingerprint?.image_id ? candidateMap.get(fingerprint.image_id) : null;
    const photographer = Array.isArray(candidate?.photographer)
      ? candidate.photographer[0] ?? null
      : candidate?.photographer ?? null;
    return {
      ...img,
      storage_path_preview: previewUrl(img.storage_path_preview),
      duplicate_candidate: candidate ? {
        id: candidate.id,
        asset_id: candidate.asset_id,
        title: candidate.title_ko?.trim() || candidate.title,
        storage_path_preview: previewUrl(candidate.storage_path_preview),
        photographer_id: candidate.photographer_id,
        photographer_name: photographer?.full_name ?? null,
      } : null,
    };
  });

  return NextResponse.json({
    images,
    pagination: {
      page,
      pageSize,
      total: count ?? 0,
      totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
    },
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
