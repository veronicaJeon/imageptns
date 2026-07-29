import { NextRequest, NextResponse } from "next/server";
import { Resend, type EmailReceivedEvent } from "resend";
import {
  DEFAULT_OPS_EMAIL,
  eventTargetsPublicContact,
  inboundForwardIdempotencyKey,
} from "@/lib/email/inbound";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!apiKey || !webhookSecret) {
    console.error("[resend-inbound] required configuration is missing");
    return new NextResponse("Inbound email is not configured", { status: 503 });
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const payload = await req.text();
  if (Buffer.byteLength(payload, "utf8") > MAX_WEBHOOK_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature) {
    return new NextResponse("Missing webhook signature", { status: 400 });
  }

  const resend = new Resend(apiKey);
  let event;
  try {
    event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });
  } catch {
    return new NextResponse("Invalid webhook signature", { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ accepted: true, forwarded: false });
  }

  const received = event as EmailReceivedEvent;
  if (!eventTargetsPublicContact(received.data)) {
    return NextResponse.json({ accepted: true, forwarded: false });
  }

  const { data, error } = await resend.emails.receiving.forward(
    {
      emailId: received.data.email_id,
      to: process.env.OPS_EMAIL ?? DEFAULT_OPS_EMAIL,
      from: process.env.RESEND_FROM_EMAIL ?? "Image Partners <contact@imagepartners.kr>",
    },
    { idempotencyKey: inboundForwardIdempotencyKey(received.data.email_id) },
  );

  if (error) {
    console.error("[resend-inbound] forwarding failed", {
      emailId: received.data.email_id,
      error: error.message,
    });
    return new NextResponse("Email forwarding failed", { status: 502 });
  }

  return NextResponse.json({ accepted: true, forwarded: true, id: data?.id });
}
