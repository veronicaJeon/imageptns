import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { previewUrl } from "@/lib/supabase/storage";

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "buyer";

  if (role === "buyer") {
    const [favRes, ordRes] = await Promise.all([
      supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("status", "completed"),
    ]);

    const [recentOrders, recentFavs] = await Promise.all([
      supabase
        .from("orders")
        .select(`id, created_at, order_items(image:images!image_id(title, storage_path_preview))`)
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("favorites")
        .select(`id, created_at, image:images!image_id(title, storage_path_preview)`)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const orderActivity = (recentOrders.data ?? []).flatMap((o: any) =>
      (o.order_items ?? []).map((item: any) => ({
        title:  item.image?.title ?? "",
        action: "Licensed",
        date:   new Date(o.created_at).getTime(),
        dateStr: new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        src:    previewUrl(item.image?.storage_path_preview),
      }))
    );
    const favActivity = (recentFavs.data ?? []).map((f: any) => ({
      title:  f.image?.title ?? "",
      action: "Favorited",
      date:   new Date(f.created_at).getTime(),
      dateStr: new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      src:    previewUrl(f.image?.storage_path_preview),
    }));

    const recent = [...orderActivity, ...favActivity]
      .sort((a, b) => b.date - a.date)
      .slice(0, 5)
      .map(({ dateStr, date: _d, ...rest }) => ({ ...rest, date: dateStr }));

    return NextResponse.json({
      role,
      favorites_count: favRes.count ?? 0,
      orders_count:    ordRes.count ?? 0,
      recent,
    });
  }

  // Photographer
  const [uploadRes, pendingRes, earningsRes] = await Promise.all([
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id),
    supabase.from("images").select("id", { count: "exact", head: true }).eq("photographer_id", user.id).eq("status", "pending"),
    supabase.from("earnings_ledger").select("net_krw").eq("photographer_id", user.id),
  ]);

  const earningsTotal = (earningsRes.data ?? []).reduce((s: number, r: any) => s + r.net_krw, 0);

  const { data: recentUploads } = await supabase
    .from("images")
    .select("id, title, status, storage_path_preview, created_at")
    .eq("photographer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const statusLabel: Record<string, string> = {
    approved: "Approved",
    pending:  "Under Review",
    rejected: "Rejected",
    draft:    "Draft",
  };

  return NextResponse.json({
    role,
    uploads_count:       uploadRes.count ?? 0,
    earnings_total:      earningsTotal,
    pending_review_count: pendingRes.count ?? 0,
    recent: (recentUploads ?? []).map((img: any) => ({
      id:     img.id,
      title:  img.title,
      action: statusLabel[img.status] ?? img.status,
      date:   new Date(img.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      src:    previewUrl(img.storage_path_preview),
    })),
  });
}
