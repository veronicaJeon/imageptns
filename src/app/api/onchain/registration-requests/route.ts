import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";
import {
  canRequestBlockchainRegistration,
  getBlockchainRegistrationState,
} from "@/lib/onchain/registration";
import { recordOnchainEvent } from "@/lib/onchain/events";

interface RegistrationImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  status: string;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  storage_path_preview: string | null;
  file_size_mb: number | null;
  created_at: string;
}

function normalizeImage(row: RegistrationImageRow) {
  return {
    ...row,
    storage_path_preview: previewUrl(row.storage_path_preview),
    registration_state: getBlockchainRegistrationState({
      imageStatus: row.status,
      salesCount: row.sales_count,
      proofStatus: row.proof_status,
    }),
  };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("images")
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      storage_path_preview, file_size_mb, created_at
    `)
    .eq("photographer_id", user.id)
    .eq("status", "approved")
    .eq("lifecycle_status", "active")
    .or("sales_count.gt.0,proof_status.in.(available,requested,pending,registered,failed)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    images: ((data ?? []) as RegistrationImageRow[]).map(normalizeImage),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { imageIds?: string[] } | null;
  const imageIds = Array.from(new Set(body?.imageIds ?? [])).filter(Boolean);
  if (imageIds.length === 0) return NextResponse.json({ error: "imageIds required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: rows, error: loadError } = await admin
    .from("images")
    .select("id, status, sales_count, proof_status")
    .eq("photographer_id", user.id)
    .in("id", imageIds)
    .eq("lifecycle_status", "active");

  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });

  const eligibleIds = ((rows ?? []) as Pick<RegistrationImageRow, "id" | "status" | "sales_count" | "proof_status">[])
    .filter((row) =>
      canRequestBlockchainRegistration({
        imageStatus: row.status,
        salesCount: row.sales_count,
        proofStatus: row.proof_status,
      })
    )
    .map((row) => row.id);

  if (eligibleIds.length !== imageIds.length) {
    return NextResponse.json(
      { error: "Only approved sold images with available or failed proof status can be requested" },
      { status: 409 },
    );
  }

  const requestedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("images")
    .update({
      proof_status: "requested",
      proof_requested_at: requestedAt,
      proof_requested_by: user.id,
      proof_failure_reason: null,
    })
    .in("id", eligibleIds)
    .eq("photographer_id", user.id)
    .select(`
      id, asset_id, title, category, sales_count, status, proof_status,
      proof_requested_at, proof_registered_at,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id,
      proof_arweave_confirmed_at, proof_failure_reason,
      storage_path_preview, file_size_mb, created_at
    `);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await Promise.all(
    eligibleIds.map((imageId) =>
      recordOnchainEvent(admin, {
        eventType: "proof_registration_requested",
        actorId: user.id,
        imageId,
        metadata: { requestedAt },
      }),
    ),
  );

  return NextResponse.json({
    images: ((data ?? []) as RegistrationImageRow[]).map(normalizeImage),
  });
}
