import { NextResponse } from "next/server";

import { normalizePhoneNumber, normalizePrimaryActivityRegions } from "../profile/contact";
import type { createAdminClient } from "../supabase/admin";

export type PhotographerStatus = "none" | "pending" | "approved" | "suspended";
export type PhotographerApplicationStatus = "pending" | "approved" | "rejected";

export interface PhotographerApplicationInput {
  profileId: string;
  name: unknown;
  organization?: unknown;
  phoneNumber?: unknown;
  primaryActivityRegions?: unknown;
  bio?: unknown;
}

export interface PhotographerApplicationPayload {
  profile_id: string;
  status: "pending";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[];
  bio: string | null;
}

export type PhotographerAuthorization =
  | {
      ok: true;
      userId: string;
      status: "approved";
    }
  | {
      ok: false;
      userId: string;
      status: PhotographerStatus;
      response: NextResponse;
    };

const PHOTOGRAPHER_STATUS_MESSAGES: Record<Exclude<PhotographerStatus, "approved">, string> = {
  none: "사진가 신청을 접수하면 관리자 확인 후 업로드 기능을 사용할 수 있습니다.",
  pending: "사진가 신청이 승인 대기 중입니다. 관리자가 통화 후 활동 정보를 확인하고 있어요.",
  suspended: "사진가 권한이 중지되었습니다. 활동 정보를 보완해 재신청할 수 있습니다.",
};

function cleanText(value: unknown, fieldName: string, maxLength: number, required: boolean) {
  if (value === null || value === undefined) {
    if (required) throw new Error(`${fieldName} is required`);
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    if (required) throw new Error(`${fieldName} is required`);
    return null;
  }

  if (text.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or fewer`);
  }

  return text;
}

export function normalizePhotographerStatus(value: unknown): PhotographerStatus {
  return value === "pending" || value === "approved" || value === "suspended" ? value : "none";
}

export function normalizeApplicationStatus(value: unknown): PhotographerApplicationStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

export function isApprovedPhotographerStatus(status: unknown) {
  return normalizePhotographerStatus(status) === "approved";
}

export function canApplyForPhotographer(status: unknown) {
  const normalized = normalizePhotographerStatus(status);
  return normalized === "none" || normalized === "suspended";
}

export function getPhotographerAccessMessage(status: unknown) {
  const normalized = normalizePhotographerStatus(status);
  if (normalized === "approved") return "사진가 기능을 사용할 수 있습니다.";
  return PHOTOGRAPHER_STATUS_MESSAGES[normalized];
}

export function buildPhotographerApplicationPayload(
  input: PhotographerApplicationInput
): PhotographerApplicationPayload {
  return {
    profile_id: input.profileId,
    status: "pending",
    applicant_name: cleanText(input.name, "applicant_name", 80, true) ?? "",
    organization: cleanText(input.organization, "organization", 120, false),
    phone_number: normalizePhoneNumber(input.phoneNumber),
    primary_activity_regions: normalizePrimaryActivityRegions(input.primaryActivityRegions),
    bio: cleanText(input.bio, "bio", 1000, false),
  };
}

export async function ensurePendingPhotographerApplication(
  admin: ReturnType<typeof createAdminClient>,
  input: PhotographerApplicationInput
) {
  const payload = buildPhotographerApplicationPayload(input);

  const { data: profile, error: profileReadError } = await admin
    .from("profiles")
    .select("photographer_status")
    .eq("id", payload.profile_id)
    .single();

  if (profileReadError) throw profileReadError;

  const currentStatus = normalizePhotographerStatus(profile?.photographer_status);
  if (currentStatus === "approved") {
    return { application: null, created: false, status: currentStatus };
  }

  const { data: existing, error: existingError } = await admin
    .from("photographer_applications")
    .select("id, status, created_at")
    .eq("profile_id", payload.profile_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({ photographer_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payload.profile_id);

    if (profileError) throw profileError;
    return { application: existing, created: false, status: "pending" as const };
  }

  const { data, error } = await admin
    .from("photographer_applications")
    .insert(payload)
    .select("id, status, created_at")
    .single();

  if (error) throw error;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ photographer_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", payload.profile_id);

  if (profileError) throw profileError;

  return { application: data, created: true, status: "pending" as const };
}

export async function requireApprovedPhotographer(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<PhotographerAuthorization> {
  const { data, error } = await admin
    .from("profiles")
    .select("photographer_status")
    .eq("id", userId)
    .single();

  if (error) {
    return {
      ok: false,
      userId,
      status: "none",
      response: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  const status = normalizePhotographerStatus(data?.photographer_status);
  if (status !== "approved") {
    return {
      ok: false,
      userId,
      status,
      response: NextResponse.json(
        {
          error: "Photographer approval required",
          code: "PHOTOGRAPHER_APPROVAL_REQUIRED",
          photographer_status: status,
          message: getPhotographerAccessMessage(status),
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId, status };
}
