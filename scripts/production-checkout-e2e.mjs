#!/usr/bin/env node

// Usage:
// PRODUCTION_ENV_FILE=/secure/vercel-production.env \
//   node scripts/production-checkout-e2e.mjs --confirm-production
//
// Creates temporary buyer/admin accounts and bank-transfer orders, verifies
// idempotency, email outbox, approval/cancel, and original download access,
// then removes all temporary records and accounts.

import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function parseEnvFile(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value.replace(/\\n/g, "\n");
  }
  return values;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function responseJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return { raw: text }; }
}

async function main() {
  assert(process.argv.includes("--confirm-production"), "Pass --confirm-production to acknowledge temporary production orders and emails");
  const envPath = process.env.PRODUCTION_ENV_FILE;
  assert(envPath, "PRODUCTION_ENV_FILE must point to a Vercel production env file");
  const env = parseEnvFile(await readFile(envPath, "utf8"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const opsEmail = env.OPS_EMAIL;
  const baseUrl = (process.env.E2E_BASE_URL ?? "https://www.imagepartners.kr").replace(/\/$/, "");
  assert(supabaseUrl && anonKey && serviceRoleKey && opsEmail, "Production Supabase or operations email configuration is incomplete");

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = `E2E-${randomBytes(18).toString("base64url")}!9a`;
  const buyerEmail = opsEmail.includes("@")
    ? `${opsEmail.split("@")[0]}+checkout-e2e-${runId}@${opsEmail.split("@")[1]}`
    : opsEmail;
  const accounts = {
    buyer: { email: buyerEmail, id: null },
    reviewer: { email: `imagepartners-checkout-reviewer-${runId}@example.com`, id: null },
  };
  const orderIds = [];
  const results = [];

  async function createAccount(key, isAdmin) {
    const account = accounts[key];
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `주문 E2E ${key}`, role: "buyer" },
    });
    if (error || !data.user) throw error ?? new Error(`Failed to create ${key}`);
    account.id = data.user.id;
    const { error: profileError } = await admin.from("profiles").update({
      is_admin: isAdmin,
      role: "buyer",
      roles: ["buyer"],
      full_name: `주문 E2E ${key}`,
      updated_at: new Date().toISOString(),
    }).eq("id", data.user.id);
    if (profileError) throw profileError;
  }

  async function cookiesFor(account) {
    const jar = new Map();
    const client = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
        setAll: (cookies) => cookies.forEach((cookie) => jar.set(cookie.name, cookie.value)),
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: account.email, password });
    if (error) throw error;
    return cookieHeader(jar);
  }

  async function api(path, { cookie, method = "GET", body } = {}) {
    const headers = { Accept: "application/json" };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
    return { response, data: await responseJson(response) };
  }

  try {
    await createAccount("buyer", false);
    await createAccount("reviewer", true);
    const [buyerCookie, reviewerCookie] = await Promise.all([
      cookiesFor(accounts.buyer),
      cookiesFor(accounts.reviewer),
    ]);
    results.push("임시 구매자·관리자 인증: 통과");

    const readiness = await api("/api/checkout/readiness");
    assert(readiness.response.status === 200, `Checkout readiness expected 200, got ${readiness.response.status}`);
    assert(readiness.data?.paidOrdersAvailable === true, "Paid bank-transfer orders are not available");
    results.push(`공시·계좌 준비 상태: 통과 (${readiness.data.disclosureComplete ? "정식 공시" : "제한 베타 예외"})`);

    const [{ data: images, error: imageError }, { data: licenses, error: licenseError }] = await Promise.all([
      admin.from("images")
        .select("id, free_usage_policy")
        .eq("status", "approved")
        .eq("lifecycle_status", "active")
        .eq("is_published", true)
        .limit(20),
      admin.from("license_types").select("code, price_krw").gt("price_krw", 0).order("price_krw"),
    ]);
    if (imageError) throw imageError;
    if (licenseError) throw licenseError;
    const candidates = [];
    for (const image of images ?? []) {
      for (const license of licenses ?? []) {
        if (image.free_usage_policy === "all") continue;
        if (image.free_usage_policy === "education" && license.code === "editorial") continue;
        candidates.push({ imageId: image.id, licenseCode: license.code, basePrice: license.price_krw });
      }
    }
    assert(candidates.length > 0, "No paid public image/license candidate exists");
    let candidate = null;
    for (const entry of candidates) {
      const { data: override } = await admin.from("image_price_overrides")
        .select("price_krw")
        .eq("image_id", entry.imageId)
        .eq("license_code", entry.licenseCode)
        .maybeSingle();
      if ((override?.price_krw ?? entry.basePrice) > 0) { candidate = entry; break; }
    }
    assert(candidate, "No positively priced checkout candidate exists");

    async function createBankOrder(idempotencyKey) {
      const body = {
        items: [{ id: candidate.imageId, license: candidate.licenseCode }],
        billing: { name: "운영 주문 E2E", email: buyerEmail, company: "Image Partners QA" },
        paymentProvider: "bank_transfer",
        usagePurposeNote: null,
        checkoutTermsAccepted: true,
        checkoutIdempotencyKey: idempotencyKey,
      };
      const response = await api("/api/checkout/prepare", { cookie: buyerCookie, method: "POST", body });
      assert(response.response.status === 200, `Bank checkout expected 200, got ${response.response.status}: ${JSON.stringify(response.data)}`);
      assert(response.data?.bankTransfer?.status === "requested", "Bank transfer request was not created");
      assert(response.data?.amount > 0, "Bank transfer amount must be positive");
      if (!orderIds.includes(response.data.orderDbId)) orderIds.push(response.data.orderDbId);
      return { ...response, body };
    }

    const idempotencyKey = randomUUID();
    const first = await createBankOrder(idempotencyKey);
    const retry = await api("/api/checkout/prepare", { cookie: buyerCookie, method: "POST", body: first.body });
    assert(retry.response.status === 200, `Idempotent retry expected 200, got ${retry.response.status}`);
    assert(retry.data?.orderDbId === first.data.orderDbId && retry.data?.reused === true, "Retry created a different order");
    const { data: createdOrder } = await admin.from("orders")
      .select("id, transaction_terms_version, transaction_terms_accepted_at, transaction_terms_snapshot, order_items(id), order_email_outbox(event_type,status)")
      .eq("id", first.data.orderDbId)
      .single();
    assert(createdOrder?.transaction_terms_version, "Terms version was not stored");
    assert(createdOrder?.transaction_terms_accepted_at, "Terms acceptance time was not stored");
    assert(createdOrder?.transaction_terms_snapshot?.acceptedDocuments?.terms?.body, "Terms body snapshot was not stored");
    assert(createdOrder?.order_items?.length === 1, "Atomic order item was not stored");
    assert(createdOrder?.order_email_outbox?.filter((event) => event.status === "sent").length === 2, "Request emails were not sent");
    results.push("원자적 주문·동의 스냅샷·중복방지·접수메일: 통과");

    const approval = await api("/api/admin/payment-requests", {
      cookie: reviewerCookie,
      method: "PATCH",
      body: { orderId: first.data.orderDbId, action: "approve", note: "운영 E2E 입금 확인" },
    });
    assert(approval.response.status === 200, `Approval expected 200, got ${approval.response.status}`);
    assert(approval.data?.order?.status === "completed", "Approved order was not completed");
    assert(approval.data?.emailDeliveryPending === false, "Approval email remained pending");
    const { data: download } = await admin.from("downloads")
      .select("order_item_id")
      .eq("user_id", accounts.buyer.id)
      .limit(1)
      .single();
    assert(download?.order_item_id, "Approval did not create download access");
    const downloadResponse = await api(`/api/download/${download.order_item_id}`, { cookie: buyerCookie });
    assert(downloadResponse.response.status === 200 && downloadResponse.data?.url, "Signed original download URL was not issued");
    const bytesResponse = await fetch(downloadResponse.data.url, { headers: { Range: "bytes=0-15" } });
    assert(bytesResponse.ok, `Signed original download returned ${bytesResponse.status}`);
    results.push("관리자 입금 승인·확정메일·원본 다운로드: 통과");

    const canceledOrder = await createBankOrder(randomUUID());
    const cancellation = await api("/api/admin/payment-requests", {
      cookie: reviewerCookie,
      method: "PATCH",
      body: { orderId: canceledOrder.data.orderDbId, action: "cancel", note: "운영 E2E 취소" },
    });
    assert(cancellation.response.status === 200, `Cancellation expected 200, got ${cancellation.response.status}`);
    assert(cancellation.data?.order?.status === "canceled", "Canceled order status mismatch");
    assert(cancellation.data?.emailDeliveryPending === false, "Cancellation email remained pending");
    results.push("계좌이체 취소·취소메일: 통과");
  } finally {
    if (accounts.buyer.id) await admin.from("orders").delete().eq("buyer_id", accounts.buyer.id);
    else if (orderIds.length > 0) await admin.from("orders").delete().in("id", orderIds);
    for (const account of Object.values(accounts)) {
      if (account.id) await admin.auth.admin.deleteUser(account.id);
    }
  }

  console.log(results.join("\n"));
  console.log("임시 주문·계정 정리: 완료");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
