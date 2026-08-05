import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { buildPhotoRequestInviteRecipients, formatPhotoRequestBudget } from "@/lib/contact/photo-request-invites";
import { sendPhotoRequestInviteEmails } from "@/lib/email/contact";
import { sendPhotoRequestInvite } from "@/lib/email/resend";
import { sendSupportStatusUpdate } from "@/lib/email/resend";
import { candidateImageEligibility } from "@/lib/sourcing/candidates";
import { createAdminClient } from "@/lib/supabase/admin";

type SupportKind = "all" | "general" | "photo";
type SupportStatus = "pending" | "in_progress" | "resolved" | "all";

interface ContactSubmissionRow {
  id: string;
  name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  status: string;
  priority: string | null;
  admin_note: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
  inquiry_type: "general" | "photo_request" | string | null;
  location_label: string | null;
  target_regions: string[] | null;
  category: string | null;
  tags: string[] | null;
  usage_intent: string | null;
  license_intent: string | null;
  budget_min_krw: number | null;
  budget_max_krw: number | null;
  deadline_at: string | null;
  reference_url: string | null;
  reference_note: string | null;
  non_copying_attested: boolean | null;
  requester_organization: string | null;
  requester_phone: string | null;
  usage_project: string | null;
  usage_context: string | null;
  sourcing_purposes: string[] | null;
  request_status: string | null;
  assignee: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
  matches?: PhotoRequestMatchRow[] | null;
  answers?: SourcingAnswerRow[] | null;
}

interface PhotoRequestMatchRow {
  id: string;
  photographer_id: string;
  status: string;
  score: number | null;
  reason: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

interface PhotographerProfileRow {
  id: string;
  full_name: string | null;
  primary_activity_regions: string[] | null;
}

interface PhotoRequestInviteMatchRow {
  id: string;
  photographer_id: string;
  status: string;
}

interface SourcingCandidateImageRow {
  id: string;
  asset_id: string | null;
  title: string | null;
  storage_path_preview: string | null;
  status: string | null;
  lifecycle_status: string | null;
  is_published: boolean | null;
  price_krw?: number | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
  photographer_id: string | null;
}

interface SourcingCandidateRow {
  id: string;
  answer_id?: string;
  image_id: string;
  sort_order: number;
  is_visible: boolean;
  note: string | null;
  image?: SourcingCandidateImageRow | SourcingCandidateImageRow[] | null;
}

interface SourcingAnswerRow {
  id: string;
  contact_submission_id?: string;
  answer_text: string | null;
  rights_result: string | null;
  rights_explanation: string | null;
  status: string;
  revision_round: number;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  candidates?: SourcingCandidateRow[] | null;
}

type SupportPostBody = {
  action?: unknown;
  requestId?: unknown;
  limit?: unknown;
  matchIds?: unknown;
  answerId?: unknown;
  answerText?: unknown;
  rightsResult?: unknown;
  rightsExplanation?: unknown;
  imageIds?: unknown;
  photographerIds?: unknown;
  targetRegions?: unknown;
};

function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function asSupportKind(value: string | null): SupportKind {
  return value === "general" || value === "photo" ? value : "all";
}

function asSupportStatus(value: string | null): SupportStatus {
  return value === "pending" || value === "in_progress" || value === "resolved" || value === "all"
    ? value
    : "pending";
}

function photoStatusesForGroup(status: SupportStatus) {
  if (status === "pending") return ["submitted"];
  if (status === "in_progress") return ["matching", "in_progress"];
  if (status === "resolved") return ["fulfilled", "cancelled", "rejected"];
  return null;
}

function photoStatusGroup(status: string | null) {
  if (status === "submitted") return "pending";
  if (status === "matching" || status === "in_progress") return "in_progress";
  if (status === "fulfilled" || status === "cancelled" || status === "rejected") return "resolved";
  return "pending";
}

function supportStatusToPhotoStatus(status: unknown) {
  if (status === "pending") return "submitted";
  if (status === "in_progress") return "in_progress";
  if (status === "resolved") return "fulfilled";
  return null;
}

function photoPriority(deadlineAt: string | null) {
  if (!deadlineAt) return "normal";
  const msRemaining = new Date(deadlineAt).getTime() - Date.now();
  if (msRemaining <= 0) return "urgent";
  if (msRemaining <= 3 * 24 * 60 * 60 * 1000) return "high";
  return "normal";
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeTextList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const region = normalizeText(item);
    if (!region || seen.has(region)) continue;
    seen.add(region);
    normalized.push(region);
  }
  return normalized;
}

function scorePhotographer(targetRegions: string[], photographerRegions: string[] | null) {
  const photographerRegionNames = normalizeTextList(photographerRegions);
  const exactMatches = photographerRegionNames.filter((region) => targetRegions.includes(region));
  const partialMatches = photographerRegionNames.filter((region) =>
    !exactMatches.includes(region) &&
    targetRegions.some((target) => region.includes(target) || target.includes(region))
  );

  const rawScore = exactMatches.length * 100 + partialMatches.length * 25;
  const score = Math.min(100, rawScore);
  const reasons = [
    ...exactMatches.map((region) => `정확 지역 일치: ${region}`),
    ...partialMatches.map((region) => `부분 지역 일치: ${region}`),
  ];

  return { score, reason: reasons.join(", ") };
}

async function notifyCustomerStatus(row: Pick<ContactSubmissionRow, "name" | "email" | "subject" | "inquiry_type">, status: "in_progress" | "resolved") {
  if (!row.email) return "skipped" as const;
  try {
    await sendSupportStatusUpdate({
      name: row.name ?? "고객",
      email: row.email,
      subject: row.subject ?? "문의",
      status,
      inquiryType: row.inquiry_type ?? "general",
    });
    return "sent" as const;
  } catch (error) {
    console.error("[admin/support] status email failed", {
      submissionId: "id" in row ? row.id : undefined,
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed" as const;
  }
}

function mapGeneralSubmission(submission: ContactSubmissionRow) {
  return {
    ...submission,
    kind: "general",
    status_group: submission.status,
    assignee: first(submission.assignee),
  };
}

function mapPhotoSubmission(submission: ContactSubmissionRow) {
  const requestStatus = submission.request_status ?? "submitted";
  return {
    id: submission.id,
    kind: "photo_request",
    name: submission.name,
    email: submission.email,
    subject: submission.subject,
    message: submission.message,
    status: requestStatus,
    status_group: photoStatusGroup(requestStatus),
    priority: submission.priority ?? photoPriority(submission.deadline_at),
    admin_note: submission.admin_note,
    assigned_to: submission.assigned_to,
    assignee: first(submission.assignee),
    created_at: submission.created_at,
    updated_at: submission.updated_at,
    resolved_at: submission.resolved_at,
    photo_request: {
      id: submission.id,
      title: submission.subject,
      brief: submission.message,
      location_label: submission.location_label,
      target_regions: submission.target_regions ?? [],
      category: submission.category,
      tags: submission.tags ?? [],
      usage_intent: submission.usage_intent,
      license_intent: submission.license_intent,
      budget_min_krw: submission.budget_min_krw,
      budget_max_krw: submission.budget_max_krw,
      deadline_at: submission.deadline_at,
      reference_url: submission.reference_url,
      reference_note: submission.reference_note,
      non_copying_attested: submission.non_copying_attested,
      requester_organization: submission.requester_organization,
      requester_phone: submission.requester_phone,
      usage_project: submission.usage_project,
      usage_context: submission.usage_context,
      sourcing_purposes: submission.sourcing_purposes ?? [],
      matches: submission.matches ?? [],
      answers: submission.answers ?? [],
    },
  };
}

async function hydrateSourcingAnswers(
  admin: ReturnType<typeof createAdminClient>,
  submissions: ContactSubmissionRow[],
) {
  const requestIds = submissions.map((submission) => submission.id);
  if (requestIds.length === 0) return submissions;

  const { data: answerData, error: answerError } = await admin
    .from("sourcing_request_answers")
    .select("id, contact_submission_id, answer_text, rights_result, rights_explanation, status, revision_round, published_at, created_at, updated_at")
    .in("contact_submission_id", requestIds)
    .order("created_at", { ascending: false });

  if (answerError) throw answerError;

  const answers = (answerData ?? []) as SourcingAnswerRow[];
  const answerIds = answers.map((answer) => answer.id);
  const { data: candidateData, error: candidateError } = answerIds.length > 0
    ? await admin
      .from("sourcing_request_candidates")
      .select("id, answer_id, image_id, sort_order, is_visible, note")
      .in("answer_id", answerIds)
      .order("sort_order", { ascending: true })
    : { data: [], error: null };

  if (candidateError) throw candidateError;

  const candidates = (candidateData ?? []) as SourcingCandidateRow[];
  const imageIds = Array.from(new Set(candidates.map((candidate) => candidate.image_id).filter(Boolean)));
  const { data: imageData, error: imageError } = imageIds.length > 0
    ? await admin
      .from("images")
      .select("id, asset_id, title, storage_path_preview, status, lifecycle_status, is_published, copyright_license, free_usage_policy, photographer_id")
      .in("id", imageIds)
    : { data: [], error: null };

  if (imageError) throw imageError;

  const imagesById = new Map(((imageData ?? []) as SourcingCandidateImageRow[]).map((image) => [image.id, image]));
  const candidatesByAnswerId = new Map<string, SourcingCandidateRow[]>();
  for (const candidate of candidates) {
    candidatesByAnswerId.set(candidate.answer_id ?? "", [
      ...(candidatesByAnswerId.get(candidate.answer_id ?? "") ?? []),
      { ...candidate, image: imagesById.get(candidate.image_id) ?? null },
    ]);
  }

  const answersByRequestId = new Map<string, SourcingAnswerRow[]>();
  for (const answer of answers) {
    answersByRequestId.set(answer.contact_submission_id ?? "", [
      ...(answersByRequestId.get(answer.contact_submission_id ?? "") ?? []),
      { ...answer, candidates: candidatesByAnswerId.get(answer.id) ?? [] },
    ]);
  }

  return submissions.map((submission) => ({
    ...submission,
    answers: answersByRequestId.get(submission.id) ?? [],
  }));
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = asSupportStatus(req.nextUrl.searchParams.get("status"));
  const kind = asSupportKind(req.nextUrl.searchParams.get("kind"));
  const admin = createAdminClient();
  const submissions: Record<string, unknown>[] = [];

  if (kind !== "photo") {
    let query = admin
      .from("contact_submissions")
      .select("*, assignee:profiles!contact_submissions_assigned_to_fkey(id, full_name)")
      .eq("inquiry_type", "general")
      .order("created_at", { ascending: false })
      .limit(200);

    if (status !== "all") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    submissions.push(...((data ?? []) as ContactSubmissionRow[]).map(mapGeneralSubmission));
  }

  if (kind !== "general") {
    let query = admin
      .from("contact_submissions")
      .select(`
        id, name, email, subject, message, status, priority, admin_note, assigned_to,
        created_at, updated_at, resolved_at, inquiry_type, location_label, target_regions,
        category, tags, usage_intent, license_intent, budget_min_krw, budget_max_krw,
        deadline_at, reference_url, reference_note, non_copying_attested,
        requester_organization, requester_phone, usage_project, usage_context, sourcing_purposes,
        request_status,
        assignee:profiles!contact_submissions_assigned_to_fkey(id, full_name),
        matches:photo_request_matches(id, photographer_id, status, score, reason, created_at, updated_at)
      `)
      .eq("inquiry_type", "photo_request")
      .order("created_at", { ascending: false })
      .limit(200);

    const photoStatuses = photoStatusesForGroup(status);
    if (photoStatuses) query = query.in("request_status", photoStatuses);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      const hydrated = await hydrateSourcingAnswers(admin, (data ?? []) as ContactSubmissionRow[]);
      submissions.push(...hydrated.map(mapPhotoSubmission));
    } catch (hydrateError) {
      const message = hydrateError instanceof Error ? hydrateError.message : "Failed to load sourcing answers";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  submissions.sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))
  );

  return NextResponse.json({ submissions });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("contact_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    const rawStatus = typeof body.status === "string" ? body.status : "";
    const nextStatus = asSupportStatus(rawStatus);
    if (nextStatus === "all" || rawStatus !== nextStatus) {
      return NextResponse.json({ error: "status is not supported" }, { status: 400 });
    }

    allowed.status = nextStatus;
    allowed.resolved_at = nextStatus === "resolved" ? new Date().toISOString() : null;

    const beforeRow = before as ContactSubmissionRow;
    const nextPhotoStatus = supportStatusToPhotoStatus(nextStatus);
    if (beforeRow.inquiry_type === "photo_request" && nextPhotoStatus) {
      allowed.request_status = nextPhotoStatus;
    }
  }
  if (body.priority !== undefined) allowed.priority = body.priority;
  if (body.admin_note !== undefined) allowed.admin_note = body.admin_note || null;
  if (body.assigned_to !== undefined) allowed.assigned_to = body.assigned_to || null;

  const { data, error } = await admin
    .from("contact_submissions")
    .update(allowed)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "contact_submission.updated",
    targetType: "contact_submission",
    targetId: id,
    targetLabel: data.subject,
    before,
    after: data,
  });

  const beforeRow = before as ContactSubmissionRow;
  const emailDelivery = body.status !== undefined && beforeRow.status !== data.status
    ? await notifyCustomerStatus(data as ContactSubmissionRow, data.status === "resolved" ? "resolved" : "in_progress")
    : "unchanged";

  return NextResponse.json({ submission: data, emailDelivery });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as SupportPostBody | null;

  if (body?.action === "send_photo_request_invites") {
    return sendPhotoRequestInvites(body, adminUser.id);
  }

  if (body?.action === "save_sourcing_answer_draft") {
    return saveSourcingAnswerDraft(body, adminUser.id);
  }

  if (body?.action === "set_sourcing_candidates") {
    return setSourcingCandidates(body, adminUser.id);
  }

  if (body?.action === "publish_sourcing_answer") {
    return publishSourcingAnswer(body, adminUser.id);
  }

  if (body?.action === "add_selected_photo_request_matches") {
    return addSelectedPhotoRequestMatches(body, adminUser.id);
  }

  if (body?.action !== "create_photo_request_matches") {
    return NextResponse.json({ error: "Unsupported support action" }, { status: 400 });
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });

  const limit = Number.isFinite(Number(body.limit))
    ? Math.min(50, Math.max(1, Math.round(Number(body.limit))))
    : 20;

  const admin = createAdminClient();
  const { data: requestData, error: requestError } = await admin
    .from("contact_submissions")
    .select("id, name, email, subject, inquiry_type, request_status, target_regions")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestData) {
    return NextResponse.json({ error: "Photo request not found" }, { status: 404 });
  }

  const requestRow = requestData as Pick<ContactSubmissionRow, "id" | "subject" | "request_status" | "target_regions">;
  const targetRegions = normalizeTextList(requestRow.target_regions);

  const { data: photographerData, error: photographerError } = await admin
    .from("profiles")
    .select("id, full_name, primary_activity_regions")
    .contains("roles", ["photographer"])
    .eq("photographer_status", "approved")
    .is("deleted_at", null);

  if (photographerError) return NextResponse.json({ error: photographerError.message }, { status: 500 });

  const candidates = ((photographerData ?? []) as PhotographerProfileRow[])
    .map((photographer) => ({
      photographer,
      ...(targetRegions.length > 0
        ? scorePhotographer(targetRegions, photographer.primary_activity_regions)
        : { score: 0, reason: "지역 조건 없음" }),
    }))
    .filter((candidate) => targetRegions.length === 0 || candidate.score > 0)
    .sort((a, b) => b.score - a.score || (a.photographer.full_name ?? "").localeCompare(b.photographer.full_name ?? ""))
    .slice(0, limit);

  if (candidates.length === 0) {
    return NextResponse.json({ matches: [], inserted: 0, skipped: 0 });
  }

  const candidateIds = candidates.map((candidate) => candidate.photographer.id);
  const { data: existingData, error: existingError } = await admin
    .from("photo_request_matches")
    .select("photographer_id")
    .eq("contact_submission_id", requestId)
    .in("photographer_id", candidateIds);

  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existingIds = new Set(
    ((existingData ?? []) as { photographer_id: string }[]).map((match) => match.photographer_id),
  );
  const rows = candidates
    .filter((candidate) => !existingIds.has(candidate.photographer.id))
    .map((candidate) => ({
      contact_submission_id: requestId,
      photographer_id: candidate.photographer.id,
      status: "candidate",
      score: candidate.score,
      reason: candidate.reason,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ matches: [], inserted: 0, skipped: candidates.length });
  }

  const { data: matches, error: insertError } = await admin
    .from("photo_request_matches")
    .insert(rows)
    .select();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const now = new Date().toISOString();
  await admin
    .from("contact_submissions")
    .update({ request_status: "matching", status: "in_progress", updated_at: now })
    .eq("id", requestId)
    .in("request_status", ["submitted", "matching"]);

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "photo_request.matches_created",
    targetType: "contact_submission",
    targetId: requestId,
    targetLabel: requestRow.subject ?? requestId,
    before: requestRow as unknown as Record<string, unknown>,
    after: { matches, inserted: rows.length, skipped: candidates.length - rows.length },
  });

  if (requestRow.request_status === "submitted") {
    await notifyCustomerStatus(requestRow as ContactSubmissionRow, "in_progress");
  }

  return NextResponse.json({
    matches: matches ?? [],
    inserted: rows.length,
    skipped: candidates.length - rows.length,
  });
}

async function addSelectedPhotoRequestMatches(body: SupportPostBody, adminUserId: string) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const photographerIds = Array.from(new Set(
    Array.isArray(body.photographerIds)
      ? body.photographerIds.map((id) => typeof id === "string" ? id.trim() : "").filter(Boolean)
      : [],
  )).slice(0, 50);
  const targetRegions = normalizeTextList(body.targetRegions);

  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  if (photographerIds.length === 0) {
    return NextResponse.json({ error: "사진작가를 한 명 이상 선택해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
    .from("contact_submissions")
    .select("id, name, email, subject, inquiry_type, target_regions, request_status")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();
  if (requestError || !requestRow) return NextResponse.json({ error: "Photo request not found" }, { status: 404 });

  const { data: photographerRows, error: photographerError } = await admin
    .from("profiles")
    .select("id, full_name, primary_activity_regions")
    .in("id", photographerIds)
    .contains("roles", ["photographer"])
    .eq("photographer_status", "approved")
    .is("deleted_at", null);
  if (photographerError) return NextResponse.json({ error: photographerError.message }, { status: 500 });

  const validPhotographers = (photographerRows ?? []) as PhotographerProfileRow[];
  const { data: existingRows, error: existingError } = await admin
    .from("photo_request_matches")
    .select("photographer_id")
    .eq("contact_submission_id", requestId)
    .in("photographer_id", validPhotographers.map((row) => row.id));
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const existingIds = new Set((existingRows ?? []).map((row) => row.photographer_id));

  const rows = validPhotographers
    .filter((photographer) => !existingIds.has(photographer.id))
    .map((photographer) => {
      const match = targetRegions.length > 0
        ? scorePhotographer(targetRegions, photographer.primary_activity_regions)
        : { score: 0, reason: "관리자 직접 선택" };
      return {
        contact_submission_id: requestId,
        photographer_id: photographer.id,
        status: "candidate",
        score: match.score,
        reason: match.reason || "관리자 직접 선택",
      };
    });

  const { data: matches, error: insertError } = rows.length > 0
    ? await admin.from("photo_request_matches").insert(rows).select()
    : { data: [], error: null };
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const now = new Date().toISOString();
  const requestUpdate: Record<string, unknown> = {
    request_status: "matching",
    status: "in_progress",
    updated_at: now,
  };
  if (targetRegions.length > 0) {
    requestUpdate.target_regions = targetRegions;
    requestUpdate.location_label = targetRegions.join(", ");
  }
  await admin.from("contact_submissions").update(requestUpdate).eq("id", requestId);

  await recordAdminAuditLog(admin, {
    actorId: adminUserId,
    action: "photo_request.matches_selected",
    targetType: "contact_submission",
    targetId: requestId,
    targetLabel: requestRow.subject ?? requestId,
    before: requestRow,
    after: { photographerIds, targetRegions, matches },
  });

  if (requestRow.request_status === "submitted") {
    await notifyCustomerStatus(requestRow as ContactSubmissionRow, "in_progress");
  }

  return NextResponse.json({
    matches: matches ?? [],
    inserted: rows.length,
    skipped: photographerIds.length - rows.length,
  });
}

async function saveSourcingAnswerDraft(body: SupportPostBody, adminUserId: string) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const answerText = typeof body.answerText === "string" ? body.answerText.trim() : "";
  const rightsResult = typeof body.rightsResult === "string" && body.rightsResult.trim()
    ? body.rightsResult.trim()
    : null;
  const rightsExplanation = typeof body.rightsExplanation === "string" && body.rightsExplanation.trim()
    ? body.rightsExplanation.trim()
    : null;

  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  if (
    rightsResult !== null
    && !["usable", "conditional", "unverified", "not_recommended"].includes(rightsResult)
  ) {
    return NextResponse.json({ error: "rightsResult is not supported" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestRow, error: requestError } = await admin
    .from("contact_submissions")
    .select("id, subject")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Sourcing request not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("sourcing_request_answers")
    .insert({
      contact_submission_id: requestId,
      answer_text: answerText || null,
      rights_result: rightsResult,
      rights_explanation: rightsExplanation,
      status: "draft",
      created_by: adminUserId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUserId,
    action: "sourcing_request.answer_draft_saved",
    targetType: "contact_submission",
    targetId: requestId,
    targetLabel: requestRow.subject,
    after: data,
  });

  return NextResponse.json({ answer: data });
}

async function setSourcingCandidates(body: SupportPostBody, adminUserId: string) {
  const answerId = typeof body.answerId === "string" ? body.answerId.trim() : "";
  const imageIds = Array.from(new Set(
    Array.isArray(body.imageIds)
      ? body.imageIds.map((id) => typeof id === "string" ? id.trim() : "").filter(Boolean)
      : [],
  ));

  if (!answerId) return NextResponse.json({ error: "answerId is required" }, { status: 400 });
  if (imageIds.length > 30) {
    return NextResponse.json({ error: "imageIds must include 30 items or fewer" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: answer, error: answerError } = await admin
    .from("sourcing_request_answers")
    .select("id, contact_submission_id, status")
    .eq("id", answerId)
    .single();

  if (answerError || !answer) return NextResponse.json({ error: "Sourcing answer not found" }, { status: 404 });
  if (answer.status !== "draft") {
    return NextResponse.json({ error: "Published answers cannot be edited" }, { status: 409 });
  }

  const { error: deleteError } = await admin
    .from("sourcing_request_candidates")
    .delete()
    .eq("answer_id", answerId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  if (imageIds.length === 0) {
    return NextResponse.json({ candidates: [] });
  }

  const { data: images, error: imageError } = await admin
    .from("images")
    .select("id, status, lifecycle_status, is_published")
    .in("id", imageIds);

  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });

  const imageMap = new Map(((images ?? []) as SourcingCandidateImageRow[]).map((image) => [image.id, image]));
  const invalid = imageIds
    .map((imageId) => {
      const image = imageMap.get(imageId);
      if (!image) return { imageId, reason: "image_not_found" };
      const eligibility = candidateImageEligibility(image);
      return eligibility.eligible ? null : { imageId, reason: eligibility.reason };
    })
    .filter(Boolean);

  if (invalid.length > 0) {
    return NextResponse.json({ error: "Some images cannot be published as candidates", invalid }, { status: 400 });
  }

  const rows = imageIds.map((imageId, index) => ({
    answer_id: answerId,
    image_id: imageId,
    sort_order: index,
    is_visible: false,
  }));

  const { data, error } = await admin
    .from("sourcing_request_candidates")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUserId,
    action: "sourcing_request.candidates_set",
    targetType: "sourcing_request_answer",
    targetId: answerId,
    before: { answerId },
    after: { imageIds },
  });

  return NextResponse.json({ candidates: data ?? [] });
}

async function publishSourcingAnswer(body: SupportPostBody, adminUserId: string) {
  const answerId = typeof body.answerId === "string" ? body.answerId.trim() : "";
  if (!answerId) return NextResponse.json({ error: "answerId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: answer, error: answerError } = await admin
    .from("sourcing_request_answers")
    .select("id, contact_submission_id, answer_text, rights_result, status")
    .eq("id", answerId)
    .single();

  if (answerError || !answer) return NextResponse.json({ error: "Sourcing answer not found" }, { status: 404 });
  if (answer.status !== "draft") {
    return NextResponse.json({ error: "Only draft answers can be published" }, { status: 409 });
  }

  const { data: candidateData, error: candidateLoadError } = await admin
    .from("sourcing_request_candidates")
    .select("id")
    .eq("answer_id", answerId);

  if (candidateLoadError) return NextResponse.json({ error: candidateLoadError.message }, { status: 500 });

  const candidates = candidateData ?? [];
  if (!answer.answer_text && !answer.rights_result && candidates.length === 0) {
    return NextResponse.json({ error: "답변 내용, 권리 확인 결과, 후보 이미지 중 하나 이상이 필요합니다." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { data: published, error: publishError } = await admin
    .from("sourcing_request_answers")
    .update({
      status: "published",
      published_at: now,
      updated_at: now,
    })
    .eq("id", answerId)
    .select()
    .single();

  if (publishError) return NextResponse.json({ error: publishError.message }, { status: 500 });

  const { error: candidateError } = await admin
    .from("sourcing_request_candidates")
    .update({ is_visible: true })
    .eq("answer_id", answerId);

  if (candidateError) return NextResponse.json({ error: candidateError.message }, { status: 500 });

  const { data: completedRequest, error: requestError } = await admin
    .from("contact_submissions")
    .update({
      internal_sourcing_status: "answered",
      buyer_sourcing_status: "answer_ready",
      request_status: "fulfilled",
      status: "resolved",
      resolved_at: now,
      updated_at: now,
    })
    .eq("id", answer.contact_submission_id)
    .select("id, name, email, subject, inquiry_type")
    .single();

  if (requestError) return NextResponse.json({ error: requestError.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUserId,
    action: "sourcing_request.answer_published",
    targetType: "contact_submission",
    targetId: answer.contact_submission_id,
    before: answer as unknown as Record<string, unknown>,
    after: published,
  });

  await notifyCustomerStatus(completedRequest as ContactSubmissionRow, "resolved");

  return NextResponse.json({ answer: published });
}

async function sendPhotoRequestInvites(body: SupportPostBody, adminUserId: string) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });

  const matchIds = Array.from(new Set(
    Array.isArray(body.matchIds)
      ? body.matchIds
        .map((matchId) => typeof matchId === "string" ? matchId.trim() : "")
        .filter(Boolean)
      : [],
  ));
  if (matchIds.length === 0) {
    return NextResponse.json({ error: "matchIds is required" }, { status: 400 });
  }
  if (matchIds.length > 50) {
    return NextResponse.json({ error: "matchIds must include 50 items or fewer" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: requestData, error: requestError } = await admin
    .from("contact_submissions")
    .select("id, subject, request_status, location_label, budget_min_krw, budget_max_krw, deadline_at, usage_project, usage_context")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestData) {
    return NextResponse.json({ error: "Photo request not found" }, { status: 404 });
  }

  const requestRow = requestData as Pick<
    ContactSubmissionRow,
    "id" | "subject" | "request_status" | "location_label" | "budget_min_krw" | "budget_max_krw" | "deadline_at" | "usage_project" | "usage_context"
  >;
  if (["fulfilled", "cancelled", "rejected"].includes(requestRow.request_status ?? "")) {
    return NextResponse.json(
      { error: "Photo request is not open for invites" },
      { status: 409 },
    );
  }

  const { data: matchData, error: matchError } = await admin
    .from("photo_request_matches")
    .select("id, photographer_id, status")
    .eq("contact_submission_id", requestId)
    .in("id", matchIds);

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 });

  const matches = (matchData ?? []) as PhotoRequestInviteMatchRow[];
  const foundMatchIds = new Set(matches.map((match) => match.id));
  const missing = matchIds
    .filter((matchId) => !foundMatchIds.has(matchId))
    .map((matchId) => ({ matchId, status: null, reason: "not_found" }));

  const photographerIds = Array.from(new Set(matches.map((match) => match.photographer_id)));
  const { data: profileData, error: profileError } = photographerIds.length > 0
    ? await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", photographerIds)
    : { data: [], error: null };

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const namesById = new Map(
    ((profileData ?? []) as Pick<PhotographerProfileRow, "id" | "full_name">[])
      .map((profile) => [profile.id, profile.full_name] as const),
  );
  const emailsById = new Map<string, string | null>();
  await Promise.all(photographerIds.map(async (photographerId) => {
    const { data } = await admin.auth.admin.getUserById(photographerId);
    emailsById.set(photographerId, data.user?.email ?? null);
  }));

  const { recipients, skipped } = buildPhotoRequestInviteRecipients(
    matches.map((match) => ({
      ...match,
      photographerEmail: emailsById.get(match.photographer_id) ?? null,
      photographerName: namesById.get(match.photographer_id) ?? null,
    })),
  );

  if (recipients.length === 0) {
    return NextResponse.json({ sent: 0, invited: 0, skipped: [...skipped, ...missing] });
  }

  const budgetLabel = formatPhotoRequestBudget(requestRow.budget_min_krw, requestRow.budget_max_krw);
  const requestTitle = requestRow.subject?.trim() || "이미지 의뢰";
  const payloads = recipients.map((recipient) => ({
    photographerEmail: recipient.photographerEmail,
    photographerName: recipient.photographerName,
    requestId,
    requestTitle,
    locationLabel: requestRow.location_label,
    usageProject: requestRow.usage_project,
    usageContext: requestRow.usage_context,
    deadlineAt: requestRow.deadline_at,
    budgetLabel,
  }));

  try {
    await sendPhotoRequestInviteEmails(payloads, sendPhotoRequestInvite);
  } catch (emailError) {
    console.error("[admin/support] photo request invite delivery failed", emailError);
    return NextResponse.json(
      { error: "Photo request invites were not fully delivered" },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  const { data: updatedMatches, error: updateError } = await admin
    .from("photo_request_matches")
    .update({ status: "invited", updated_at: now })
    .eq("contact_submission_id", requestId)
    .in("id", recipients.map((recipient) => recipient.matchId))
    .eq("status", "candidate")
    .select("id");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  await admin
    .from("contact_submissions")
    .update({ request_status: "in_progress", status: "in_progress", updated_at: now })
    .eq("id", requestId)
    .in("request_status", ["submitted", "matching", "in_progress"]);

  await recordAdminAuditLog(admin, {
    actorId: adminUserId,
    action: "photo_request.invites_sent",
    targetType: "contact_submission",
    targetId: requestId,
    targetLabel: requestTitle,
    before: { request: requestRow, matchIds },
    after: {
      invited: (updatedMatches ?? []).length,
      sent: recipients.length,
      skipped: [...skipped, ...missing],
    },
  });

  return NextResponse.json({
    sent: recipients.length,
    invited: (updatedMatches ?? []).length,
    skipped: [...skipped, ...missing],
  });
}
