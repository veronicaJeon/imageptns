import { NextRequest, NextResponse } from "next/server";
import { imageLedgerKey } from "@/lib/onchain/asset-ledger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

interface ImageRow {
  id: string;
  asset_id: string | null;
  title: string;
  photographer_id: string | null;
  onchain_asset_id: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
}

interface OrderJoinRow {
  id: string;
  order_number: string;
  buyer_id: string | null;
  billing_name: string | null;
  billing_email: string | null;
  completed_at: string | null;
  created_at: string;
  status: string;
  payment_provider: string | null;
  payment_tx_hash: string | null;
  contract_order_id: string | null;
  buyer_wallet_address: string | null;
}

interface OrderItemRow {
  id: string;
  license_code: string;
  price_krw: number;
  gross_krw: number;
  commission_krw: number;
  net_krw: number;
  subscription_covered: boolean | null;
  subscription_plan: string | null;
  order: OrderJoinRow | OrderJoinRow[] | null;
}

function normalizeOrder(order: OrderItemRow["order"]) {
  return Array.isArray(order) ? order[0] : order;
}

function maskEmail(email: string | null) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}***@${domain}`;
}

async function isAdminUser(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .maybeSingle();
  return Boolean(data?.is_admin);
}

export async function GET(_req: NextRequest, context: RouteContext) {
  const { id: imageId } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: image, error: imageError } = await admin
    .from("images")
    .select(`
      id, asset_id, title, photographer_id, onchain_asset_id,
      proof_arweave_original_tx_id, proof_arweave_metadata_tx_id, proof_arweave_manifest_tx_id
    `)
    .eq("id", imageId)
    .maybeSingle();

  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });
  if (!image) return NextResponse.json({ error: "Image not found" }, { status: 404 });

  const imageRow = image as ImageRow;
  const adminUser = await isAdminUser(admin, user.id);
  if (!adminUser && imageRow.photographer_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: rows, error } = await admin
    .from("order_items")
    .select(`
      id, license_code, price_krw, gross_krw, commission_krw, net_krw,
      subscription_covered, subscription_plan,
      order:orders!order_id(
        id, order_number, buyer_id, billing_name, billing_email,
        completed_at, created_at, status, payment_provider, payment_tx_hash,
        contract_order_id, buyer_wallet_address
      )
    `)
    .eq("image_id", imageId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const transactions = ((rows ?? []) as unknown as OrderItemRow[])
    .map((item) => ({ item, order: normalizeOrder(item.order) }))
    .filter(({ order }) => order?.status === "completed")
    .sort((left, right) => {
      const leftDate = left.order?.completed_at ?? left.order?.created_at ?? "";
      const rightDate = right.order?.completed_at ?? right.order?.created_at ?? "";
      return rightDate.localeCompare(leftDate);
    })
    .map(({ item, order }) => ({
      orderItemId: item.id,
      orderId: order!.id,
      orderNumber: order!.order_number,
      completedAt: order!.completed_at,
      buyer: {
        id: order!.buyer_id,
        name: order!.billing_name,
        email: adminUser ? order!.billing_email : maskEmail(order!.billing_email),
        walletAddress: order!.buyer_wallet_address,
      },
      licenseCode: item.license_code,
      priceKrw: item.price_krw,
      grossKrw: item.gross_krw,
      commissionKrw: item.commission_krw,
      netKrw: item.net_krw,
      subscriptionCovered: Boolean(item.subscription_covered),
      subscriptionPlan: item.subscription_plan,
      paymentProvider: order!.payment_provider,
      paymentTxHash: order!.payment_tx_hash,
      contractOrderId: order!.contract_order_id,
    }));

  return NextResponse.json({
    image: {
      id: imageRow.id,
      title: imageRow.title,
      assetId: imageRow.asset_id,
      ledgerKey: imageLedgerKey(imageRow.asset_id, imageRow.onchain_asset_id),
      arweave: {
        originalTxId: imageRow.proof_arweave_original_tx_id,
        metadataTxId: imageRow.proof_arweave_metadata_tx_id,
        manifestTxId: imageRow.proof_arweave_manifest_tx_id,
      },
    },
    transactions,
  });
}
