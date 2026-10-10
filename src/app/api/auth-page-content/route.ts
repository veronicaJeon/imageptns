import { NextResponse } from "next/server";
import { getPublicAuthPageContent } from "@/lib/auth/page-content-server";

export async function GET() {
  return NextResponse.json({ content: await getPublicAuthPageContent() }, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=0, must-revalidate" },
  });
}
