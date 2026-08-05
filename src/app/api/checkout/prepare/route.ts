import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { calculateCommission, selectCommissionPolicy, type CommissionPolicy } from "@/lib/commerce/commission";
import { isCheckoutRequestEnabled } from "@/lib/commerce/availability";
import { priceCartItemsFromLicenses, type LicensePriceRow } from "@/lib/commerce/pricing";
import {
  allowIncompleteDisclosureForBeta,
  checkoutRequestHash,
  checkoutRequiresPublishedDisclosure,
  CHECKOUT_TERMS_VERSION,
  isUuid,
} from "@/lib/checkout/transaction";
import { buildCheckoutTermsSnapshot } from "@/lib/checkout/terms-server";
import { disclosureIsCompleteForPaidCommerce } from "@/lib/legal/disclosure";
import { dispatchOrderEmailsForOrder } from "@/lib/orders/email-outbox";
import { bankTransferAccountIsConfigured, getBankTransferAccount } from "@/lib/payments/bank-transfer";
import { readBoundedJson, RequestBodyError } from "@/lib/security/request-body";
import { consumeDistributedRateLimit } from "@/lib/security/distributed-rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loadSubscriptionCoverageForCheckout } from "@/lib/subscription/checkout";

interface CartItemInput {
  id: string;
  license: string;
}

type CheckoutPaymentProvider = "toss" | "bank_transfer";

interface CheckoutImageRow {
  id: string;
  title: string | null;
  asset_id: string | null;
  photographer_id: string | null;
  storage_path_preview: string | null;
  storage_path_original: string | null;
  storage_path_full: string | null;
  original_filename: string | null;
  free_usage_policy: string | null;
}

interface LicenseRow extends LicensePriceRow {
  name_ko: string;
  description_ko: string | null;
}

interface CheckoutRequestBody {
  items?: CartItemInput[];
  billing?: { name?: string; email?: string; company?: string };
  paymentProvider?: CheckoutPaymentProvider;
  usagePurposeNote?: string | null;
  checkoutTermsAccepted?: boolean;
  checkoutIdempotencyKey?: string;
}

interface CreatedOrder {
  id: string;
  order_number: string;
  toss_order_id: string;
  status: string;
  reused: boolean;
}

function invalidRequest(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function normalizeRequestBody(value: unknown): CheckoutRequestBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as CheckoutRequestBody;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return invalidRequest("Unauthorized", 401);
  const rate = await consumeDistributedRateLimit({
    scope: "checkout-create",
    identity: user.id,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "주문 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let parsed: unknown;
  try {
    parsed = await readBoundedJson(req, 64 * 1024);
  } catch (error) {
    return invalidRequest("Invalid checkout request", error instanceof RequestBodyError ? error.status : 400);
  }
  const body = normalizeRequestBody(parsed);
  if (!body) return invalidRequest("Invalid checkout request");

  const items = body.items;
  const billing = body.billing;
  const paymentProvider = body.paymentProvider ?? "toss";
  const idempotencyKey = body.checkoutIdempotencyKey;
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) return invalidRequest("Invalid checkout items");
  if (paymentProvider !== "toss" && paymentProvider !== "bank_transfer") return invalidRequest("Unsupported payment provider");
  if (!billing?.name?.trim() || !billing.email?.trim()) return invalidRequest("Billing name and email are required");
  if (billing.name.length > 120 || billing.email.length > 254 || (billing.company?.length ?? 0) > 200) {
    return invalidRequest("Billing information is too long");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billing.email.trim())) return invalidRequest("Billing email is invalid");
  if (body.checkoutTermsAccepted !== true) return invalidRequest("주문 및 라이선스 조건 동의가 필요합니다.");
  if (!isUuid(idempotencyKey)) return invalidRequest("Invalid checkout idempotency key");
  if (items.some((item) => !item || typeof item.id !== "string" || typeof item.license !== "string")) {
    return invalidRequest("Invalid checkout items");
  }
  const imageIds = items.map((item) => item.id);
  if (new Set(imageIds).size !== imageIds.length) return invalidRequest("Duplicate checkout images are not allowed");

  const admin = createAdminClient();
  const licenseCodes = [...new Set(items.map((item) => item.license))];
  const [{ data: licenses, error: licenseError }, { data: images, error: imageError }] = await Promise.all([
    admin
      .from("license_types")
      .select("code, name_ko, description_ko, price_krw")
      .in("code", licenseCodes),
    admin
      .from("images")
      .select("id, title, asset_id, photographer_id, storage_path_preview, storage_path_original, storage_path_full, original_filename, free_usage_policy")
      .in("id", imageIds)
      .eq("status", "approved")
      .eq("lifecycle_status", "active")
      .eq("is_published", true),
  ]);
  if (licenseError) return invalidRequest(licenseError.message, 500);
  if (imageError) return invalidRequest(imageError.message, 500);

  const licenseRows = (licenses ?? []) as LicenseRow[];
  const licenseMap = Object.fromEntries(licenseRows.map((license) => [license.code, license]));
  if (licenseCodes.some((code) => !licenseMap[code])) return invalidRequest("Invalid license");
  const imageRows = (images ?? []) as CheckoutImageRow[];
  const imageMap = Object.fromEntries(imageRows.map((image) => [image.id, image]));
  if (imageIds.some((id) => !imageMap[id])) {
    return invalidRequest("현재 사용권을 구매할 수 없는 이미지가 포함되어 있습니다.", 409);
  }

  const { data: priceOverrides, error: overrideError } = await admin
    .from("image_price_overrides")
    .select("image_id, license_code, price_krw")
    .in("image_id", imageIds)
    .in("license_code", licenseCodes);
  if (overrideError) return invalidRequest(overrideError.message, 500);

  let pricedItems;
  try {
    pricedItems = priceCartItemsFromLicenses(items, licenseRows, priceOverrides ?? []).map((item) => {
      const policy = imageMap[item.id]?.free_usage_policy;
      if (policy === "all") return { ...item, priceKrw: 0 };
      if (policy === "education" && item.license === "editorial") return { ...item, priceKrw: 0 };
      return item;
    });
  } catch (error) {
    return invalidRequest(error instanceof Error ? error.message : "Invalid license");
  }

  const usagePurposeNote = typeof body.usagePurposeNote === "string"
    ? body.usagePurposeNote.trim().slice(0, 1000)
    : "";
  const coverage = await loadSubscriptionCoverageForCheckout({ admin, userId: user.id, items: pricedItems });
  const payableItems = coverage.items;
  const subtotal = payableItems.reduce((sum, item) => sum + item.effectivePriceKrw, 0);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  if (!isCheckoutRequestEnabled(paymentProvider, total)) {
    return invalidRequest("Online payments are not available yet", 503);
  }
  if (paymentProvider === "bank_transfer" && total > 0 && !bankTransferAccountIsConfigured()) {
    return invalidRequest("계좌이체 계좌정보가 준비되지 않았습니다.", 503);
  }

  const requiresUsagePurpose = payableItems.some((item) => {
    const policy = imageMap[item.id]?.free_usage_policy;
    return item.effectivePriceKrw === 0
      && item.license === "editorial"
      && (policy === "all" || policy === "education");
  });
  if (requiresUsagePurpose && !usagePurposeNote) {
    return invalidRequest("무료 에디토리얼/교육용 사용처를 입력해주세요.");
  }

  let terms;
  try {
    terms = await buildCheckoutTermsSnapshot();
  } catch (error) {
    return invalidRequest(error instanceof Error ? error.message : "Checkout policies are unavailable", 503);
  }
  const betaDisclosureOverride = allowIncompleteDisclosureForBeta();
  if (
    checkoutRequiresPublishedDisclosure(paymentProvider, total)
    && !disclosureIsCompleteForPaidCommerce(terms.disclosure)
    && !betaDisclosureOverride
  ) {
    return NextResponse.json({
      error: "정식 유료 주문을 위한 사업자 공시사항을 준비하고 있습니다.",
      code: "PAID_DISCLOSURE_INCOMPLETE",
    }, { status: 503 });
  }

  const { data: policyRows, error: policyError } = await admin
    .from("commission_policies")
    .select("id, scope, rate, active, starts_at, ends_at, license_code, photographer_id, image_id")
    .eq("active", true);
  if (policyError) return invalidRequest(policyError.message, 500);
  const policies = ((policyRows ?? []) as CommissionPolicy[]).map((policy) => ({ ...policy, rate: Number(policy.rate) }));

  const orderItems = payableItems.map((item) => {
    const image = imageMap[item.id];
    const license = licenseMap[item.license];
    const gross = item.effectivePriceKrw;
    const commissionPolicy = selectCommissionPolicy({
      imageId: item.id,
      photographerId: image.photographer_id,
      licenseCode: item.license,
      policies,
    });
    const commission = calculateCommission(gross, commissionPolicy.rate);
    return {
      image_id: item.id,
      license_code: item.license,
      price_krw: item.effectivePriceKrw,
      photographer_id: image.photographer_id,
      image_title_snapshot: image.title,
      image_asset_id_snapshot: image.asset_id,
      image_preview_path_snapshot: image.storage_path_preview,
      image_original_path_snapshot: image.storage_path_original ?? image.storage_path_full,
      image_original_filename_snapshot: image.original_filename,
      license_name_ko_snapshot: license.name_ko,
      license_description_ko_snapshot: license.description_ko,
      gross_krw: gross,
      commission_rate: commission.commissionRate,
      commission_krw: commission.commissionKrw,
      net_krw: commission.netKrw,
      subscription_id: item.subscriptionCovered ? coverage.subscriptionId : null,
      subscription_covered: item.subscriptionCovered,
      subscription_original_price_krw: item.subscriptionCovered ? item.originalPriceKrw : null,
      subscription_plan: item.subscriptionCovered ? coverage.subscriptionPlan : null,
    };
  });

  const requestHash = checkoutRequestHash({
    buyerId: user.id,
    billing: {
      name: billing.name.trim(),
      email: billing.email.trim().toLowerCase(),
      company: billing.company?.trim() || null,
    },
    usagePurposeNote: usagePurposeNote || null,
    paymentProvider,
    subtotal,
    vat,
    total,
    items: orderItems,
    termsVersion: CHECKOUT_TERMS_VERSION,
  });
  const tossOrderId = randomUUID();
  const { data: createdData, error: createError } = await admin.rpc("create_standard_checkout_order", {
    p_buyer_id: user.id,
    p_billing_name: billing.name.trim(),
    p_billing_email: billing.email.trim(),
    p_billing_company: billing.company?.trim() || null,
    p_usage_purpose_note: usagePurposeNote || null,
    p_payment_provider: paymentProvider,
    p_toss_order_id: tossOrderId,
    p_subtotal_krw: subtotal,
    p_vat_krw: vat,
    p_total_krw: total,
    p_checkout_idempotency_key: idempotencyKey,
    p_checkout_request_hash: requestHash,
    p_transaction_terms_version: CHECKOUT_TERMS_VERSION,
    p_transaction_terms_snapshot: terms.snapshot,
    p_allow_incomplete_disclosure: betaDisclosureOverride,
    p_items: orderItems,
  });
  if (createError || !createdData) return invalidRequest(createError?.message ?? "Order creation failed", 500);
  const order = createdData as CreatedOrder;

  const emailResults = await dispatchOrderEmailsForOrder(order.id);
  const emailDeliveryPending = emailResults.some((result) => !result.ok);
  const subscriptionCoverage = coverage;
  if (total === 0) {
    return NextResponse.json({
      orderId: order.toss_order_id,
      orderDbId: order.id,
      orderNumber: order.order_number,
      amount: total,
      orderName: coverage.coveredCount > 0
        ? items.length === 1 ? `구독 무료다운 이미지 라이선스 (${items[0].license})` : `구독 무료다운 이미지 라이선스 외 ${items.length - 1}건`
        : items.length === 1 ? `무료 이미지 라이선스 (${items[0].license})` : `무료 이미지 라이선스 외 ${items.length - 1}건`,
      free: true,
      reused: order.reused,
      emailDeliveryPending,
      subscriptionCoverage,
    });
  }

  if (paymentProvider === "bank_transfer") {
    return NextResponse.json({
      orderId: order.toss_order_id,
      orderDbId: order.id,
      orderNumber: order.order_number,
      amount: total,
      orderName: items.length === 1
        ? `계좌이체 이미지 라이선스 (${items[0].license})`
        : `계좌이체 이미지 라이선스 외 ${items.length - 1}건`,
      bankTransfer: { status: "requested", account: getBankTransferAccount() },
      reused: order.reused,
      emailDeliveryPending,
      subscriptionCoverage,
    });
  }

  return NextResponse.json({
    orderId: order.toss_order_id,
    orderDbId: order.id,
    amount: total,
    orderName: items.length === 1
      ? `이미지 라이선스 (${items[0].license})`
      : `이미지 라이선스 외 ${items.length - 1}건`,
    reused: order.reused,
    subscriptionCoverage,
  });
}
