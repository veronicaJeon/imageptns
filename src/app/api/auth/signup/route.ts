import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSiteUrl } from "@/lib/routing/canonical";
import { checkRateLimit, requestIp } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideSignupFlow,
  normalizeSignupEmail,
  normalizeSignupPassword,
  normalizeSignupRole,
  normalizeSignupText,
  SIGNUP_CONFIRMATION_RESENT_MESSAGE,
  SIGNUP_CONFIRMATION_SENT_MESSAGE,
  SIGNUP_EXISTING_ACCOUNT_MESSAGE,
  type SignupLookupResult,
} from "@/lib/auth/signup-flow";

function createPublicAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const rate = checkRateLimit({
    key: `auth-signup:${requestIp(req.headers)}`,
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  if (!body || typeof body !== "object") {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  const payload = body as Record<string, unknown>;
  let email: string;
  let password: string;
  let name: string;
  let organization: string;
  try {
    email = normalizeSignupEmail(payload.email);
    password = normalizeSignupPassword(payload.password);
    name = normalizeSignupText(payload.name, "이름", 80);
    organization = normalizeSignupText(payload.organization, "소속", 120);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "가입 정보를 확인해주세요.");
  }
  const role = normalizeSignupRole(payload.role);
  const emailRedirectTo = buildSiteUrl("/api/auth/callback");

  const admin = createAdminClient();
  const { data: lookupRows, error: lookupError } = await admin.rpc("lookup_auth_user_by_email", {
    lookup_email: email,
  });

  if (lookupError) {
    console.error("[auth-signup] email lookup failed", {
      code: lookupError.code,
      message: lookupError.message,
      details: lookupError.details,
    });
    return NextResponse.json({ error: "가입 상태를 확인하지 못했습니다." }, { status: 500 });
  }

  const lookupRow = Array.isArray(lookupRows) ? lookupRows[0] : lookupRows;
  const lookup: SignupLookupResult = lookupRow?.user_exists
    ? {
        userExists: true,
        emailConfirmed: Boolean(lookupRow.email_confirmed),
        providers: Array.isArray(lookupRow.providers) ? lookupRow.providers : [],
      }
    : { userExists: false, emailConfirmed: false, providers: [] };

  const auth = createPublicAuthClient();
  const action = decideSignupFlow(lookup);

  if (action === "show_existing_account") {
    return NextResponse.json({
      ok: true,
      status: "existing_account",
      message: SIGNUP_EXISTING_ACCOUNT_MESSAGE,
    });
  }

  if (action === "resend_confirmation") {
    const { error } = await auth.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo },
    });
    if (error) {
      console.error("[auth-signup] confirmation resend failed", {
        name: error.name,
        message: error.message,
        status: error.status,
        code: error.code,
      });
      return NextResponse.json({ error: "인증메일을 다시 보내지 못했습니다." }, { status: 502 });
    }
    return NextResponse.json({
      ok: true,
      status: "confirmation_resent",
      message: SIGNUP_CONFIRMATION_RESENT_MESSAGE,
    });
  }

  const { data, error } = await auth.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name, role, organization },
      emailRedirectTo,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.session) {
    return NextResponse.json({ ok: true, status: "signed_in" });
  }

  return NextResponse.json({
    ok: true,
    status: "confirmation_sent",
    message: SIGNUP_CONFIRMATION_SENT_MESSAGE,
  });
}
