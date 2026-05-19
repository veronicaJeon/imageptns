import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendContactEmails } from "@/lib/email/contact";
import { sendContactConfirmation, notifyOpsContact } from "@/lib/email/gmail";
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

  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const subject = body.subject?.trim();
  const message = body.message?.trim();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }
  if (name.length > 80 || email.length > 254 || subject.length > 160 || message.length > 5000) {
    return NextResponse.json({ error: "Input is too long" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("contact_submissions")
    .insert({ name, email, subject, message });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try {
    await sendContactEmails(
      { name, email, subject, message },
      {
        sendConfirmation: sendContactConfirmation,
        notifyOps: notifyOpsContact,
      },
    );
  } catch (emailError) {
    console.error("[contact] email delivery failed", emailError);
    return NextResponse.json(
      { error: "Contact was saved, but email delivery failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
