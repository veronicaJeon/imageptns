import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { buildPhotoRequestInviteRecipients, formatPhotoRequestBudget } from "@/lib/contact/photo-request-invites";
import { sendPhotoRequestInviteEmails } from "@/lib/email/contact";
import { sendPhotoRequestInvite } from "@/lib/email/resend";
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
  request_status: string | null;
  assignee: { id: string; full_name: string | null } | { id: string; full_name: string | null }[] | null;
  matches?: PhotoRequestMatchRow[] | null;
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

type SupportPostBody = {
  action?: unknown;
  requestId?: unknown;
  limit?: unknown;
  matchIds?: unknown;
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
      matches: submission.matches ?? [],
    },
  };
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
        deadline_at, reference_url, reference_note, non_copying_attested, request_status,
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

    submissions.push(...((data ?? []) as ContactSubmissionRow[]).map(mapPhotoSubmission));
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

  return NextResponse.json({ submission: data });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as SupportPostBody | null;

  if (body?.action === "send_photo_request_invites") {
    return sendPhotoRequestInvites(body, adminUser.id);
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
    .select("id, subject, request_status, target_regions")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestData) {
    return NextResponse.json({ error: "Photo request not found" }, { status: 404 });
  }

  const requestRow = requestData as Pick<ContactSubmissionRow, "id" | "subject" | "request_status" | "target_regions">;
  const targetRegions = normalizeTextList(requestRow.target_regions);
  if (targetRegions.length === 0) {
    return NextResponse.json({ error: "사진 의뢰에 대상 지역이 없습니다." }, { status: 400 });
  }

  const { data: photographerData, error: photographerError } = await admin
    .from("profiles")
    .select("id, full_name, primary_activity_regions")
    .eq("role", "photographer")
    .is("deleted_at", null);

  if (photographerError) return NextResponse.json({ error: photographerError.message }, { status: 500 });

  const candidates = ((photographerData ?? []) as PhotographerProfileRow[])
    .map((photographer) => ({
      photographer,
      ...scorePhotographer(targetRegions, photographer.primary_activity_regions),
    }))
    .filter((candidate) => candidate.score > 0)
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

  return NextResponse.json({
    matches: matches ?? [],
    inserted: rows.length,
    skipped: candidates.length - rows.length,
  });
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
    .select("id, subject, request_status, location_label, budget_min_krw, budget_max_krw, deadline_at")
    .eq("id", requestId)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestData) {
    return NextResponse.json({ error: "Photo request not found" }, { status: 404 });
  }

  const requestRow = requestData as Pick<
    ContactSubmissionRow,
    "id" | "subject" | "request_status" | "location_label" | "budget_min_krw" | "budget_max_krw" | "deadline_at"
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
  const requestTitle = requestRow.subject?.trim() || "사진 의뢰";
  const payloads = recipients.map((recipient) => ({
    photographerEmail: recipient.photographerEmail,
    photographerName: recipient.photographerName,
    requestId,
    requestTitle,
    locationLabel: requestRow.location_label,
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
