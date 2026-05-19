import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendContactEmails } from "@/lib/email/contact";
import { sendContactConfirmation, notifyOpsContact } from "@/lib/email/gmail";

export async function POST(req: NextRequest) {
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
