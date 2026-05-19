import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  const admin = createAdminClient();
  let query = admin
    .from("contact_submissions")
    .select("*, assignee:profiles!contact_submissions_assigned_to_fkey(id, full_name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ submissions: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json();
  const id = String(body.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const allowed: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    allowed.status = body.status;
    allowed.resolved_at = body.status === "resolved" ? new Date().toISOString() : null;
  }
  if (body.priority !== undefined) allowed.priority = body.priority;
  if (body.admin_note !== undefined) allowed.admin_note = body.admin_note || null;
  if (body.assigned_to !== undefined) allowed.assigned_to = body.assigned_to || null;

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("contact_submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

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
