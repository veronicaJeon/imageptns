import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q") ?? "";

  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const supabase = await createClient();
  const pattern = `%${q}%`;

  const [titlesRes, tagsRes] = await Promise.all([
    supabase
      .from("images")
      .select("title")
      .eq("status", "approved")
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("images")
      .select("tags")
      .eq("status", "approved")
      .limit(200),
  ]);

  const seen = new Set<string>();
  const titles: string[] = [];

  for (const row of (titlesRes.data ?? []) as { title: string }[]) {
    if (row.title && !seen.has(row.title.toLowerCase())) {
      seen.add(row.title.toLowerCase());
      titles.push(row.title);
    }
  }

  const lq = q.toLowerCase();
  const tags: string[] = [];

  for (const row of (tagsRes.data ?? []) as { tags: string[] }[]) {
    for (const tag of row.tags ?? []) {
      if (tag.toLowerCase().includes(lq) && !seen.has(tag.toLowerCase())) {
        seen.add(tag.toLowerCase());
        tags.push(tag);
      }
    }
  }

  return NextResponse.json({ suggestions: [...titles, ...tags].slice(0, 8) });
}
