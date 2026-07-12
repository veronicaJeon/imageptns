import { NextResponse } from "next/server";
import { listImageCategories } from "@/lib/images/category-server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const categories = await listImageCategories(admin, false);
  return NextResponse.json({ categories });
}
