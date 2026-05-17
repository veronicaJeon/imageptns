import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendContactConfirmation, notifyOpsContact } from "@/lib/email/resend";

export async function POST(req: NextRequest) {
  const { name, email, subject, message } = await req.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("contact_submissions")
    .insert({ name, email, subject, message });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fire-and-forget emails
  sendContactConfirmation({ name, email, subject }).catch(console.error);
  notifyOpsContact({ name, email, subject, message }).catch(console.error);

  return NextResponse.json({ ok: true }, { status: 201 });
}
