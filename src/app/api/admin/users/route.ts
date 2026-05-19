import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: "buyer" | "photographer";
  avatar_url: string | null;
  is_admin: boolean;
  wallet_address: string | null;
  created_at: string;
  updated_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
  deleted_at?: string | null;
}

interface OrderSummaryRow {
  id: string;
  buyer_id: string | null;
  status: string;
  total_krw: number | null;
  created_at: string;
  completed_at: string | null;
  order_items: { id: string }[] | null;
}

interface AuthUserSummary {
  id: string;
  email?: string;
  last_sign_in_at?: string | null;
  created_at?: string;
}

function summarizeOrders(orders: OrderSummaryRow[]) {
  return orders.reduce(
    (summary, order) => {
      summary.orderCount += 1;
      summary.purchaseCount += order.order_items?.length ?? 0;
      if (order.status === "completed") {
        summary.paymentCount += 1;
        summary.totalPaidKrw += order.total_krw ?? 0;
      }
      const orderDate = order.completed_at ?? order.created_at;
      if (!summary.lastOrderAt || new Date(orderDate) > new Date(summary.lastOrderAt)) {
        summary.lastOrderAt = orderDate;
      }
      return summary;
    },
    { orderCount: 0, paymentCount: 0, purchaseCount: 0, totalPaidKrw: 0, lastOrderAt: null as string | null },
  );
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query")?.trim().toLowerCase() ?? "";
  const role = searchParams.get("role") ?? "all";
  const adminOnly = searchParams.get("admin") === "true";

  const admin = createAdminClient();
  let profileQuery = admin
    .from("profiles")
    .select("id, full_name, role, avatar_url, is_admin, wallet_address, created_at, updated_at, last_login_at, login_count, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (role === "buyer" || role === "photographer") profileQuery = profileQuery.eq("role", role);
  if (adminOnly) profileQuery = profileQuery.eq("is_admin", true);

  const [{ data: profileData, error: profileError }, authResult, { data: orderData, error: orderError }] = await Promise.all([
    profileQuery,
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin
      .from("orders")
      .select("id, buyer_id, status, total_krw, created_at, completed_at, order_items(id)")
      .order("created_at", { ascending: false }),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });
  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const profiles = (profileData ?? []) as ProfileRow[];
  const authUsers = ((authResult.data.users ?? []) as AuthUserSummary[]);
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  const orders = (orderData ?? []) as OrderSummaryRow[];
  const ordersByBuyer = new Map<string, OrderSummaryRow[]>();
  for (const order of orders) {
    if (!order.buyer_id) continue;
    ordersByBuyer.set(order.buyer_id, [...(ordersByBuyer.get(order.buyer_id) ?? []), order]);
  }

  const users = profiles
    .map((profile) => {
      const auth = authById.get(profile.id);
      return {
        ...profile,
        email: auth?.email ?? "",
        authCreatedAt: auth?.created_at ?? null,
        authLastSignInAt: auth?.last_sign_in_at ?? null,
        ...summarizeOrders(ordersByBuyer.get(profile.id) ?? []),
      };
    })
    .filter((user) => {
      if (!query) return true;
      return [user.email, user.full_name, user.wallet_address, user.id]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  return NextResponse.json({ users });
}
