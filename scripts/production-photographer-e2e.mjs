#!/usr/bin/env node

// Usage:
// PRODUCTION_ENV_FILE=/secure/vercel-production.env \
//   node scripts/production-photographer-e2e.mjs --confirm-production
//
// The script always attempts to remove its temporary users, image objects,
// upload sessions, and rate-limit bucket, including after a failed assertion.

import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import process from "node:process";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

function parseEnvFile(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
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
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function responseJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function main() {
  assert(
    process.argv.includes("--confirm-production"),
    "Pass --confirm-production to acknowledge that this creates temporary users and upload sessions in production",
  );
  const envPath = process.env.PRODUCTION_ENV_FILE;
  assert(envPath, "PRODUCTION_ENV_FILE must point to a Vercel production env file");

  const fileEnv = parseEnvFile(await readFile(envPath, "utf8"));
  const supabaseUrl = fileEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = fileEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = fileEnv.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = (process.env.E2E_BASE_URL ?? "https://www.imagepartners.kr").replace(/\/$/, "");
  assert(supabaseUrl && anonKey && serviceRoleKey, "Production Supabase credentials are incomplete");

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = `E2E-${randomBytes(18).toString("base64url")}!9a`;
  const accounts = {
    pending: {
      email: `imagepartners-e2e-pending-${runId}@example.com`,
      profile: {
        role: "buyer",
        roles: ["buyer"],
        photographer_status: "pending",
        is_admin: false,
      },
    },
    approved: {
      email: `imagepartners-e2e-approved-${runId}@example.com`,
      profile: {
        role: "photographer",
        roles: ["buyer", "photographer"],
        photographer_status: "approved",
        is_admin: false,
      },
    },
    reviewer: {
      email: `imagepartners-e2e-reviewer-${runId}@example.com`,
      profile: {
        role: "buyer",
        roles: ["buyer"],
        photographer_status: "none",
        is_admin: true,
      },
    },
  };
  const createdUserIds = [];
  const createdStoragePaths = new Set();
  let createdImageId = null;
  let testError = null;
  const results = [];

  async function createAccount(key) {
    const account = accounts[key];
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `운영 E2E ${key}`, role: account.profile.role },
    });
    if (error || !data.user) throw error ?? new Error(`Failed to create ${key} account`);
    account.id = data.user.id;
    createdUserIds.push(data.user.id);

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        ...account.profile,
        full_name: `운영 E2E ${key}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.user.id);
    if (profileError) throw profileError;
  }

  async function authenticatedCookies(account) {
    const jar = new Map();
    const client = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return [...jar.entries()].map(([name, value]) => ({ name, value }));
        },
        setAll(cookies) {
          for (const cookie of cookies) jar.set(cookie.name, cookie.value);
        },
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: account.email,
      password,
    });
    if (error) throw error;
    assert(jar.size > 0, `No auth cookies were issued for ${account.email}`);
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
    for (const key of Object.keys(accounts)) await createAccount(key);
    results.push("임시 계정 3개 생성 및 운영 인증: 통과");

    const [pendingCookie, approvedCookie, reviewerCookie] = await Promise.all([
      authenticatedCookies(accounts.pending),
      authenticatedCookies(accounts.approved),
      authenticatedCookies(accounts.reviewer),
    ]);

    const pendingList = await api("/api/uploads", { cookie: pendingCookie });
    assert(pendingList.response.status === 403, `Pending upload list expected 403, got ${pendingList.response.status}`);
    assert(
      pendingList.data?.code === "PHOTOGRAPHER_APPROVAL_REQUIRED",
      "Pending upload list returned an unexpected error code",
    );
    const pendingPresign = await api("/api/uploads/presign", {
      cookie: pendingCookie,
      method: "POST",
      body: { filename: "blocked.jpg", contentType: "image/jpeg", fileSize: 10 },
    });
    assert(pendingPresign.response.status === 403, `Pending presign expected 403, got ${pendingPresign.response.status}`);
    results.push("승인 대기 사진가의 목록·업로드 발급 403: 통과");

    const { data: categories, error: categoryError } = await admin
      .from("image_categories")
      .select("code")
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .limit(1);
    if (categoryError) throw categoryError;
    const categoryCode = categories?.[0]?.code;
    assert(categoryCode, "No active image category is available");

    const jpeg = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 35, g: 93, b: 122 },
      },
    })
      .jpeg({ quality: 90 })
      .toBuffer();
    const title = `운영 E2E 업로드 ${runId}`;
    const presign = await api("/api/uploads/presign", {
      cookie: approvedCookie,
      method: "POST",
      body: { filename: `${runId}.jpg`, contentType: "image/jpeg", fileSize: jpeg.length },
    });
    assert(presign.response.status === 200, `Approved presign expected 200, got ${presign.response.status}`);
    assert(presign.data?.storagePath && presign.data?.token && presign.data?.uploadSessionId, "Presign payload is incomplete");
    createdStoragePaths.add(presign.data.storagePath);

    const { error: storageError } = await publicClient.storage
      .from("images-original")
      .uploadToSignedUrl(
        presign.data.storagePath,
        presign.data.token,
        jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
        { contentType: "image/jpeg" },
      );
    if (storageError) throw storageError;

    const upload = await api("/api/uploads", {
      cookie: approvedCookie,
      method: "POST",
      body: {
        title,
        description: "운영 사진가 업로드 상태 전이 검증용 임시 이미지",
        category_codes: [categoryCode],
        tags: ["e2e", "temporary"],
        upload_session_id: presign.data.uploadSessionId,
        storage_path_original: presign.data.storagePath,
        original_filename: `${runId}.jpg`,
        copyright_license: "standard",
        free_usage_policy: "none",
        authorship_declaration: "human_original",
        factuality_attested: true,
        promotional_use_allowed: false,
      },
    });
    assert(upload.response.status === 201, `Upload expected 201, got ${upload.response.status}: ${JSON.stringify(upload.data)}`);
    createdImageId = upload.data?.image?.id;
    assert(createdImageId, "Uploaded image id is missing");
    assert(upload.data.image.status === "pending" && upload.data.image.is_published === false, "New upload state is incorrect");

    const ownerPending = await api("/api/uploads", { cookie: approvedCookie });
    assert(ownerPending.response.status === 200, `Owner uploads expected 200, got ${ownerPending.response.status}`);
    const ownerPendingImage = ownerPending.data?.uploads?.find((image) => image.id === createdImageId);
    assert(ownerPendingImage?.status === "pending", "New image is missing from photographer uploads");

    const adminPending = await api(`/api/admin/images?status=pending&query=${encodeURIComponent(title)}`, {
      cookie: reviewerCookie,
    });
    assert(adminPending.response.status === 200, `Admin pending list expected 200, got ${adminPending.response.status}`);
    assert(
      adminPending.data?.images?.some((image) => image.id === createdImageId),
      "New image is missing from the admin review queue",
    );
    results.push("승인 사진가 업로드·내 업로드·관리자 검토 대기 조회: 통과");

    const publicBeforeApproval = await api(`/api/images/${createdImageId}`);
    assert(publicBeforeApproval.response.status === 404, "Pending image must not be public");

    const approve = await api(`/api/admin/images/${createdImageId}/review`, {
      cookie: reviewerCookie,
      method: "PATCH",
      body: { action: "approve" },
    });
    assert(approve.response.status === 200, `Admin approval expected 200, got ${approve.response.status}`);
    assert(approve.data?.image?.status === "approved" && approve.data?.image?.is_published === true, "Approval state is incorrect");

    const publicAfterApproval = await api(`/api/images/${createdImageId}`);
    assert(publicAfterApproval.response.status === 200, "Approved image must be public");

    const reject = await api(`/api/admin/images/${createdImageId}/review`, {
      cookie: reviewerCookie,
      method: "PATCH",
      body: { action: "reject", rejection_reason: "운영 E2E 상태 전이 검증" },
    });
    assert(reject.response.status === 200, `Admin rejection expected 200, got ${reject.response.status}`);
    assert(reject.data?.image?.status === "rejected" && reject.data?.image?.is_published === false, "Rejection state is incorrect");

    const [ownerRejected, adminRejected, publicAfterRejection] = await Promise.all([
      api("/api/uploads", { cookie: approvedCookie }),
      api(`/api/admin/images?status=rejected&query=${encodeURIComponent(title)}`, { cookie: reviewerCookie }),
      api(`/api/images/${createdImageId}`),
    ]);
    assert(
      ownerRejected.data?.uploads?.some((image) => image.id === createdImageId && image.status === "rejected"),
      "Rejected image is missing from photographer uploads",
    );
    assert(
      adminRejected.data?.images?.some((image) => image.id === createdImageId && image.status === "rejected"),
      "Rejected image is missing from the admin rejected list",
    );
    assert(publicAfterRejection.response.status === 404, "Rejected image must not be public");
    results.push("관리자 승인·공개·반려·사진가/관리자 조회·공개 차단: 통과");

    let accepted = 1;
    let limited = 0;
    let retryAfter = null;
    for (let offset = 0; offset < 110 && limited === 0; offset += 10) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(10, 110 - offset) }, (_, index) =>
          api("/api/uploads/presign", {
            cookie: approvedCookie,
            method: "POST",
            body: {
              filename: `quota-${offset + index}.jpg`,
              contentType: "image/jpeg",
              fileSize: jpeg.length,
            },
          }),
        ),
      );
      for (const item of batch) {
        if (item.response.status === 200) {
          accepted += 1;
          if (item.data?.storagePath) createdStoragePaths.add(item.data.storagePath);
        } else if (item.response.status === 429) {
          limited += 1;
          retryAfter = item.response.headers.get("retry-after");
        } else {
          throw new Error(`Quota request returned unexpected ${item.response.status}: ${JSON.stringify(item.data)}`);
        }
      }
    }
    assert(accepted === 100, `Expected exactly 100 accepted presigns, got ${accepted}`);
    assert(limited > 0, "Upload quota did not return 429");
    assert(Number(retryAfter) > 0, "429 response is missing a valid Retry-After header");
    results.push(`업로드 발급 시간당 100회 제한·429·Retry-After: 통과 (${limited}건 차단)`);
  } catch (error) {
    testError = error;
  } finally {
    const cleanupErrors = [];
    const cleanup = async (label, action) => {
      try {
        const result = await action();
        if (result?.error) throw result.error;
      } catch (error) {
        cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    if (createdImageId) {
      await cleanup("user_events", () => admin.from("user_events").delete().eq("image_id", createdImageId));
    }
    if (createdStoragePaths.size > 0) {
      const paths = [...createdStoragePaths];
      await cleanup("original storage", () => admin.storage.from("images-original").remove(paths));
      await cleanup("preview storage", () =>
        admin.storage.from("images-preview").remove([...paths, ...paths.map((path) => `thumbs/${path}`)]),
      );
    }
    if (createdImageId) {
      await cleanup("image row", () => admin.from("images").delete().eq("id", createdImageId));
    }
    for (const userId of createdUserIds) {
      const bucketKey = `upload-presign:${createHash("sha256").update(userId).digest("hex")}`;
      await cleanup("rate-limit bucket", () =>
        admin.from("api_rate_limit_windows").delete().eq("bucket_key", bucketKey),
      );
      await cleanup("upload sessions", () => admin.from("upload_sessions").delete().eq("user_id", userId));
      await cleanup("photographer applications", () =>
        admin.from("photographer_applications").delete().eq("profile_id", userId),
      );
    }
    for (const userId of [...createdUserIds].reverse()) {
      await cleanup("auth user", async () => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        return { error };
      });
    }

    if (cleanupErrors.length > 0) {
      const cleanupError = new Error(`Cleanup failed:\n- ${cleanupErrors.join("\n- ")}`);
      testError = testError
        ? new AggregateError([testError, cleanupError], "E2E and cleanup both failed")
        : cleanupError;
    } else {
      results.push("임시 이미지·스토리지·세션·한도 버킷·계정 정리: 통과");
    }
  }

  for (const result of results) console.log(`✓ ${result}`);
  if (testError) throw testError;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
