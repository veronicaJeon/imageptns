import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function stringValue(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const labelKo = stringValue(body.ko ?? body.label_ko);
  const labelEn = stringValue(body.en ?? body.label_en);
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 1000;

  if (!labelKo || !labelEn) {
    return NextResponse.json({ error: "한글/영문 라벨은 필수입니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("image_categories")
    .update({
      label_ko: labelKo,
      label_en: labelEn,
      sort_order: sortOrder,
      active: body.active !== false,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code)
    .select("code, label_ko, label_en, sort_order, active")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "카테고리를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    category: {
      code: data.code,
      ko: data.label_ko,
      en: data.label_en,
      sort_order: data.sort_order,
      active: data.active,
    },
  });
}
