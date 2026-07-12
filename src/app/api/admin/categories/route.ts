import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { listImageCategories } from "@/lib/images/category-server";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function stringValue(value: unknown, max = 200) {
  return String(value ?? "").trim().slice(0, max);
}

export async function GET() {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const admin = createAdminClient();
  const categories = await listImageCategories(admin, true);
  return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => ({}));
  const code = stringValue(body.code, 64);
  const labelKo = stringValue(body.ko ?? body.label_ko);
  const labelEn = stringValue(body.en ?? body.label_en);
  const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 1000;

  if (!CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "카테고리 코드는 영문 소문자, 숫자, -, _ 조합이어야 합니다." }, { status: 400 });
  }
  if (!labelKo || !labelEn) {
    return NextResponse.json({ error: "한글/영문 라벨은 필수입니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("image_categories")
    .insert({
      code,
      label_ko: labelKo,
      label_en: labelEn,
      sort_order: sortOrder,
      active: body.active !== false,
    })
    .select("code, label_ko, label_en, sort_order, active")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    category: data ? {
      code: data.code,
      ko: data.label_ko,
      en: data.label_en,
      sort_order: data.sort_order,
      active: data.active,
    } : null,
  }, { status: 201 });
}
