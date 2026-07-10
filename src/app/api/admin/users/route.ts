import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: "buyer" | "photographer";
  roles: Array<"buyer" | "photographer"> | null;
  photographer_status: "none" | "pending" | "approved" | "suspended";
  avatar_url: string | null;
  is_admin: boolean;
  wallet_address: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
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

interface PhotographerApplicationSummary {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  bio: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string | null;
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
  const photographerStatus = searchParams.get("photographer_status") ?? "all";
  const adminOnly = searchParams.get("admin") === "true";

  const admin = createAdminClient();
  let profileQuery = admin
    .from("profiles")
    .select("id, full_name, role, roles, photographer_status, avatar_url, is_admin, wallet_address, phone_number, primary_activity_regions, created_at, updated_at, last_login_at, login_count, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(300);

  if (role === "buyer" || role === "photographer") profileQuery = profileQuery.eq("role", role);
  if (
    photographerStatus === "none" ||
    photographerStatus === "pending" ||
    photographerStatus === "approved" ||
    photographerStatus === "suspended"
  ) {
    profileQuery = profileQuery.eq("photographer_status", photographerStatus);
  }
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
  const profileIds = profiles.map((profile) => profile.id);
  const { data: applicationData, error: applicationError } = profileIds.length > 0
    ? await admin
      .from("photographer_applications")
      .select("id, profile_id, status, applicant_name, organization, phone_number, primary_activity_regions, bio, admin_note, rejection_reason, reviewed_at, created_at, updated_at")
      .in("profile_id", profileIds)
      .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (applicationError) return NextResponse.json({ error: applicationError.message }, { status: 500 });

  const latestApplicationByProfile = new Map<string, PhotographerApplicationSummary>();
  const pendingApplicationByProfile = new Map<string, PhotographerApplicationSummary>();
  for (const application of (applicationData ?? []) as PhotographerApplicationSummary[]) {
    if (!latestApplicationByProfile.has(application.profile_id)) {
      latestApplicationByProfile.set(application.profile_id, application);
    }
    if (application.status === "pending" && !pendingApplicationByProfile.has(application.profile_id)) {
      pendingApplicationByProfile.set(application.profile_id, application);
    }
  }

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
        roles: Array.isArray(profile.roles) && profile.roles.length > 0 ? profile.roles : [profile.role],
        email: auth?.email ?? "",
        authCreatedAt: auth?.created_at ?? null,
        authLastSignInAt: auth?.last_sign_in_at ?? null,
        latest_photographer_application: latestApplicationByProfile.get(profile.id) ?? null,
        pending_photographer_application: pendingApplicationByProfile.get(profile.id) ?? null,
        ...summarizeOrders(ordersByBuyer.get(profile.id) ?? []),
      };
    })
    .filter((user) => {
      if (!query) return true;
      const latestApplication = user.latest_photographer_application;
      return [
        user.email,
        user.full_name,
        user.wallet_address,
        user.phone_number,
        user.photographer_status,
        latestApplication?.applicant_name,
        latestApplication?.organization,
        latestApplication?.phone_number,
        latestApplication?.bio,
        latestApplication?.rejection_reason,
        ...(latestApplication?.primary_activity_regions ?? []),
        ...(user.primary_activity_regions ?? []),
        user.id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

  return NextResponse.json({ users });
}
