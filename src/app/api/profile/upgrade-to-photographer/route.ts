import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildPhotographerApplicationPayload,
  canApplyForPhotographer,
  ensurePendingPhotographerApplication,
  normalizePhotographerStatus,
} from "@/lib/photographers/approval";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name, organization, photographer_status, phone_number, primary_activity_regions, bio")
    .eq("id", user.id)
    .single();

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const currentStatus = normalizePhotographerStatus(profile.photographer_status);
  if (currentStatus === "approved") {
    return NextResponse.json({
      error: "이미 승인된 사진작가입니다.",
      code: "ALREADY_APPROVED_PHOTOGRAPHER",
      photographer_status: currentStatus,
    }, { status: 400 });
  }

  if (currentStatus === "pending") {
    return NextResponse.json({
      ok: true,
      photographer_status: currentStatus,
      message: "사진작가 신청이 이미 접수되어 승인 대기 중입니다.",
    });
  }

  if (!canApplyForPhotographer(currentStatus)) {
    return NextResponse.json({ error: "사진작가 신청이 가능한 상태가 아닙니다." }, { status: 400 });
  }

  const name = typeof body.name === "string" && body.name.trim()
    ? body.name
    : profile.full_name || user.email?.split("@")[0] || "User";
  const organization = "organization" in body ? body.organization : profile.organization;
  const phoneNumber = "phone_number" in body ? body.phone_number : profile.phone_number;
  const primaryActivityRegions = "primary_activity_regions" in body
    ? body.primary_activity_regions
    : profile.primary_activity_regions;
  const bio = "bio" in body ? body.bio : profile.bio;

  try {
    const applicationPayload = buildPhotographerApplicationPayload({
      profileId: user.id,
      name,
      organization,
      phoneNumber,
      primaryActivityRegions,
      bio,
    });

    if (!applicationPayload.phone_number || applicationPayload.primary_activity_regions.length === 0) {
      return NextResponse.json(
        { error: "사진작가 신청을 위해 연락처와 주요 활동 지역을 입력해주세요." },
        { status: 400 },
      );
    }

    const result = await ensurePendingPhotographerApplication(admin, {
      profileId: user.id,
      name,
      organization,
      phoneNumber,
      primaryActivityRegions,
      bio,
    });

    return NextResponse.json({
      ok: true,
      photographer_status: result.status,
      application: result.application,
      created: result.created,
      message: "사진작가 신청이 접수되었습니다. 관리자가 확인 후 안내드릴게요.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "사진작가 신청 정보를 확인해주세요." },
      { status: 400 },
    );
  }
}
