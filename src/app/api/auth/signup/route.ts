import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSiteUrl } from "@/lib/routing/canonical";
import {
  consumeDistributedRateLimit,
  requestIdentity,
} from "@/lib/security/distributed-rate-limit";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decideSignupFlow,
  normalizeSignupEmail,
  normalizeSignupPassword,
  normalizeSignupRole,
  normalizeSignupText,
  photographerIntentCreatesBuyerRole,
  SIGNUP_CONFIRMATION_RESENT_MESSAGE,
  SIGNUP_CONFIRMATION_SENT_MESSAGE,
  SIGNUP_EXISTING_ACCOUNT_MESSAGE,
  type SignupLookupResult,
} from "@/lib/auth/signup-flow";
import {
  buildPhotographerApplicationPayload,
  ensurePendingPhotographerApplication,
} from "@/lib/photographers/approval";

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
  const rate = await consumeDistributedRateLimit({
    scope: "auth-signup",
    identity: requestIdentity(req.headers),
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      {
        error: rate.unavailable
          ? "가입 서비스를 잠시 사용할 수 없습니다. 잠시 후 다시 시도해주세요."
          : "가입 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
      },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req, 32 * 1024);
  } catch (error) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: error instanceof RequestBodyError ? error.status : 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return badRequest("요청 형식이 올바르지 않습니다.");
  }

  const payload = body as Record<string, unknown>;
  let email: string;
  let password: string;
  let name: string;
  let organization: string;
  let phoneNumber: unknown;
  let primaryActivityRegions: unknown;
  let bio: unknown;
  try {
    email = normalizeSignupEmail(payload.email);
    password = normalizeSignupPassword(payload.password);
    name = normalizeSignupText(payload.name, "이름", 80);
    organization = normalizeSignupText(payload.organization, "소속", 120);
    phoneNumber = typeof payload.phone_number === "string" ? payload.phone_number : null;
    primaryActivityRegions = payload.primary_activity_regions ?? [];
    bio = typeof payload.bio === "string" ? payload.bio : "";
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : "가입 정보를 확인해주세요.");
  }
  const role = normalizeSignupRole(payload.role);
  const signupIntent = photographerIntentCreatesBuyerRole(role);
  if (signupIntent.shouldCreateApplication) {
    try {
      const applicationPayload = buildPhotographerApplicationPayload({
        profileId: "00000000-0000-0000-0000-000000000000",
        name,
        organization,
        phoneNumber,
        primaryActivityRegions,
        bio,
      });
      if (!applicationPayload.phone_number || applicationPayload.primary_activity_regions.length === 0) {
        return badRequest("사진작가 신청을 위해 연락처와 주요 활동 지역을 입력해주세요.");
      }
    } catch (error) {
      return badRequest(error instanceof Error ? error.message : "사진작가 신청 정보를 확인해주세요.");
    }
  }
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
      data: {
        full_name: name,
        role,
        requested_role: role,
        organization,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const createdUserId = data.user?.id;
  if (createdUserId && signupIntent.shouldCreateApplication) {
    try {
      await ensurePendingPhotographerApplication(admin, {
        profileId: createdUserId,
        name,
        organization,
        phoneNumber,
        primaryActivityRegions,
        bio,
      });
    } catch (applicationError) {
      console.error("[auth-signup] photographer application creation failed", applicationError);
      return NextResponse.json({ error: "사진작가 신청을 접수하지 못했습니다." }, { status: 500 });
    }
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
