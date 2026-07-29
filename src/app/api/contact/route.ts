import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeContactSubmissionInput } from "@/lib/contact/request-fields";
import { sendContactEmails } from "@/lib/email/contact";
import { safeEmailErrorDetails } from "@/lib/email/gmail";
import { notifyOpsContact, sendContactConfirmation } from "@/lib/email/resend";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";

export async function POST(req: NextRequest) {
  const rate = await consumeDistributedRateLimit({
    scope: "contact",
    identity: requestIdentity(req.headers),
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: rate.unavailable ? "Contact service temporarily unavailable" : "Too many contact requests" },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req, 64 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid contact request" },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }

  let submission;
  try {
    submission = normalizeContactSubmissionInput(body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid contact request" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  let buyerId: string | null = null;

  if (submission.inquiry_type === "photo_request") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "이미지 소싱 요청은 로그인 후 접수할 수 있습니다." },
        { status: 401 },
      );
    }
    buyerId = user.id;

    const rawBody = body as Record<string, unknown>;
    const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (rawBody.sync_profile_phone === true) {
      profileUpdate.phone_number = submission.requester_phone;
    }
    if (rawBody.sync_profile_organization === true) {
      profileUpdate.organization = submission.requester_organization;
    }
    if (Object.keys(profileUpdate).length > 1) {
      const { error: profileError } = await supabase
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user.id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
      }
    }
  }

  const { error } = await supabase
    .from("contact_submissions")
    .insert({ ...submission, buyer_id: buyerId });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendContactEmails(
      {
        name: submission.name,
        email: submission.email,
        subject: submission.subject,
        message: submission.message,
        phone: submission.requester_phone,
        organization: submission.requester_organization,
      },
      {
        sendConfirmation: sendContactConfirmation,
        notifyOps: notifyOpsContact,
      },
    );
  } catch (emailError) {
    console.error("[contact] email delivery failed", {
      inquiryType: submission.inquiry_type,
      recipientDomain: submission.email.split("@")[1] ?? null,
      details: safeEmailErrorDetails(emailError),
    });
    return NextResponse.json({ ok: true, emailDelivery: "failed" }, { status: 201 });
  }

  return NextResponse.json({ ok: true, emailDelivery: "sent" }, { status: 201 });
}
