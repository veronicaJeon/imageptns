import type { PhotoRequestMatchStatus } from "./request-fields";

export interface PhotoRequestInviteMatch {
  id: string;
  photographer_id: string;
  status: string;
  photographerEmail: string | null;
  photographerName: string | null;
}

export interface PhotoRequestInviteRecipient {
  matchId: string;
  photographerId: string;
  photographerEmail: string;
  photographerName: string;
}

export interface PhotoRequestInviteSkipped {
  matchId: string;
  status: string | null;
  reason: "status_not_sendable" | "missing_email";
}

const SENDABLE_MATCH_STATUSES = new Set<PhotoRequestMatchStatus>(["candidate"]);

function cleanText(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function buildPhotoRequestInviteRecipients(matches: PhotoRequestInviteMatch[]) {
  const recipients: PhotoRequestInviteRecipient[] = [];
  const skipped: PhotoRequestInviteSkipped[] = [];

  for (const match of matches) {
    if (!SENDABLE_MATCH_STATUSES.has(match.status as PhotoRequestMatchStatus)) {
      skipped.push({ matchId: match.id, status: match.status, reason: "status_not_sendable" });
      continue;
    }

    const photographerEmail = cleanText(match.photographerEmail);
    if (!photographerEmail) {
      skipped.push({ matchId: match.id, status: match.status, reason: "missing_email" });
      continue;
    }

    recipients.push({
      matchId: match.id,
      photographerId: match.photographer_id,
      photographerEmail,
      photographerName: cleanText(match.photographerName) || "사진작가",
    });
  }

  return { recipients, skipped };
}

export function formatPhotoRequestBudget(minKrw: number | null, maxKrw: number | null) {
  const format = (value: number) => `₩${value.toLocaleString("ko-KR")}`;
  if (minKrw !== null && maxKrw !== null) return `${format(minKrw)} ~ ${format(maxKrw)}`;
  if (minKrw !== null) return `${format(minKrw)} 이상`;
  if (maxKrw !== null) return `${format(maxKrw)} 이하`;
  return null;
}
