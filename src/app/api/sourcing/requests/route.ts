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
  photographer_name?: string | null;
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
  answers?: AnswerRow[] | null;
  revisions?: unknown[] | null;
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
      sourcing_purposes, usage_intent, requester_organization, usage_project, usage_context, deadline_at
    `)
    .eq("inquiry_type", "photo_request")
    .or(`buyer_id.eq.${user.id},email.eq.${user.email}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requests = (data ?? []) as Array<RequestRow & Record<string, unknown> & { id: string }>;
  const requestIds = requests.map((request) => request.id);

  const { data: answersData, error: answersError } = requestIds.length > 0
    ? await admin
      .from("sourcing_request_answers")
      .select("id, contact_submission_id, answer_text, rights_result, rights_explanation, status, revision_round, published_at")
      .in("contact_submission_id", requestIds)
      .eq("status", "published")
      .order("published_at", { ascending: false })
    : { data: [], error: null };

  if (answersError) return NextResponse.json({ error: answersError.message }, { status: 500 });

  const answers = (answersData ?? []) as Array<AnswerRow & { contact_submission_id: string }>;
  const answerIds = answers.map((answer) => answer.id);

  const { data: candidateData, error: candidateError } = answerIds.length > 0
    ? await admin
      .from("sourcing_request_candidates")
      .select("id, answer_id, image_id, sort_order, is_visible")
      .in("answer_id", answerIds)
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });

  const candidateRows = (candidateData ?? []) as Array<Omit<CandidateRow, "image"> & { answer_id: string }>;
  const imageIds = Array.from(new Set(candidateRows.map((candidate) => candidate.image_id).filter(Boolean)));

  const { data: imageData, error: imageError } = imageIds.length > 0
    ? await admin
      .from("images")
      .select(`
        id, asset_id, title, category, storage_path_preview, width, height,
        photographer_id, copyright_license, free_usage_policy
      `)
      .in("id", imageIds)
    : { data: [], error: null };

  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });

  const { data: revisionsData, error: revisionsError } = requestIds.length > 0
    ? await admin
      .from("sourcing_request_revisions")
      .select("id, contact_submission_id, round, reasons, message, created_at")
      .in("contact_submission_id", requestIds)
      .order("round", { ascending: true })
    : { data: [], error: null };

  if (revisionsError) return NextResponse.json({ error: revisionsError.message }, { status: 500 });

  const imagesById = new Map(((imageData ?? []) as CandidateImage[]).map((image) => [image.id, image]));
  const photographerIds = Array.from(new Set(
    ((imageData ?? []) as CandidateImage[])
      .map((image) => image.photographer_id)
      .filter((id): id is string => Boolean(id)),
  ));
  const { data: photographerData, error: photographerError } = photographerIds.length > 0
    ? await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", photographerIds)
    : { data: [], error: null };

  if (photographerError) return NextResponse.json({ error: photographerError.message }, { status: 500 });

  const photographerNamesById = new Map(
    ((photographerData ?? []) as Array<{ id: string; full_name: string | null }>).map((profile) => [profile.id, profile.full_name]),
  );
  const candidatesByAnswerId = new Map<string, CandidateRow[]>();
  for (const candidate of candidateRows) {
    const rawImage = imagesById.get(candidate.image_id) ?? null;
    const image = rawImage
      ? { ...rawImage, photographer_name: rawImage.photographer_id ? photographerNamesById.get(rawImage.photographer_id) ?? null : null }
      : null;
    const row: CandidateRow = { ...candidate, image };
    candidatesByAnswerId.set(candidate.answer_id, [...(candidatesByAnswerId.get(candidate.answer_id) ?? []), row]);
  }

  const answersByRequestId = new Map<string, AnswerRow[]>();
  for (const answer of answers) {
    answersByRequestId.set(answer.contact_submission_id, [
      ...(answersByRequestId.get(answer.contact_submission_id) ?? []),
      { ...answer, candidates: candidatesByAnswerId.get(answer.id) ?? [] },
    ]);
  }

  const revisionsByRequestId = new Map<string, unknown[]>();
  for (const revision of revisionsData ?? []) {
    const requestId = String((revision as { contact_submission_id: string }).contact_submission_id);
    revisionsByRequestId.set(requestId, [...(revisionsByRequestId.get(requestId) ?? []), revision]);
  }

  const hydrated = requests.map((request) => ({
    ...request,
    answers: answersByRequestId.get(request.id) ?? [],
    revisions: revisionsByRequestId.get(request.id) ?? [],
  }));

  return NextResponse.json({ requests: hydrated.map(normalizeRequest) });
}
