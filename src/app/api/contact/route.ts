import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeContactSubmissionInput } from "@/lib/contact/request-fields";
import { sendContactEmails } from "@/lib/email/contact";
import { notifyOpsContact, safeEmailErrorDetails, sendContactConfirmation } from "@/lib/email/gmail";
import { checkRateLimit, requestIp } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const rate = checkRateLimit({
    key: `contact:${requestIp(req.headers)}`,
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many contact requests" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
