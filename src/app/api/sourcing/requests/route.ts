import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

interface CandidateImage {
  id: string;
  asset_id: string | null;
  title: string | null;
  category: string | null;
  storage_path_preview: string | null;
  width: number | null;
  height: number | null;
  photographer_id: string | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
}

interface CandidateRow {
  id: string;
  image_id: string;
  sort_order: number;
  is_visible: boolean;
  image: CandidateImage | CandidateImage[] | null;
}

interface AnswerRow {
  id: string;
  answer_text: string | null;
  rights_result: string | null;
  rights_explanation: string | null;
  status: string;
  revision_round: number;
  published_at: string | null;
  candidates: CandidateRow[] | null;
}

interface RequestRow {
  answers: AnswerRow[] | null;
}

function firstImage(image: CandidateRow["image"]) {
  return Array.isArray(image) ? image[0] : image;
}

function normalizeRequest(row: RequestRow & Record<string, unknown>) {
  const answers = (row.answers ?? [])
    .filter((answer) => answer.status === "published")
    .map((answer) => ({
      ...answer,
      candidates: (answer.candidates ?? [])
        .filter((candidate) => candidate.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((candidate) => {
          const image = firstImage(candidate.image);
          return {
            ...candidate,
            image: image
              ? { ...image, storage_path_preview: previewUrl(image.storage_path_preview) }
              : null,
          };
        }),
    }));

  return { ...row, answers };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("contact_submissions")
    .select(`
      id, subject, message, created_at, updated_at, buyer_sourcing_status, internal_sourcing_status,
      sourcing_purposes, usage_intent, deadline_at,
      answers:sourcing_request_answers(
        id, answer_text, rights_result, rights_explanation, status, revision_round, published_at,
        candidates:sourcing_request_candidates(
          id, image_id, sort_order, is_visible,
          image:images(
            id, asset_id, title, category, storage_path_preview, width, height,
            photographer_id, copyright_license, free_usage_policy
          )
        )
      ),
      revisions:sourcing_request_revisions(id, round, reasons, message, created_at)
    `)
    .eq("inquiry_type", "photo_request")
    .or(`buyer_id.eq.${user.id},email.eq.${user.email}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: ((data ?? []) as Array<RequestRow & Record<string, unknown>>).map(normalizeRequest) });
}
