#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return [];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [[match[1], value.replace(/\\n/g, "\n")]];
  }));
}

async function json(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return { raw: text }; }
}

assert(process.argv.includes("--confirm-production"), "Pass --confirm-production to run against production.");
const envPath = process.env.PRODUCTION_ENV_FILE;
assert(envPath, "PRODUCTION_ENV_FILE is required.");
const env = parseEnv(await readFile(envPath, "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
assert(url && anonKey && serviceKey, "Production Supabase credentials are incomplete.");

const baseUrl = (process.env.E2E_BASE_URL ?? "https://www.imagepartners.kr").replace(/\/$/, "");
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const runId = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `E2E-${randomBytes(18).toString("base64url")}!9a`;
const accounts = [
  { email: `duplicate-a-${runId}@example.com`, name: "중복 E2E 사진가 A", admin: false },
  { email: `duplicate-b-${runId}@example.com`, name: "중복 E2E 사진가 B", admin: false },
  { email: `duplicate-admin-${runId}@example.com`, name: "중복 E2E 관리자", admin: true },
];
const userIds = [];
const imageIds = [];
const storagePaths = new Set();
let failure = null;

async function createAccount(account) {
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: account.name, role: account.admin ? "buyer" : "photographer" },
  });
  if (error || !data.user) throw error ?? new Error("Account creation failed");
  account.id = data.user.id;
  userIds.push(data.user.id);
  const { error: profileError } = await admin.from("profiles").update({
    full_name: account.name,
    role: account.admin ? "buyer" : "photographer",
    roles: account.admin ? ["buyer"] : ["buyer", "photographer"],
    photographer_status: account.admin ? "none" : "approved",
    is_admin: account.admin,
  }).eq("id", data.user.id);
  if (profileError) throw profileError;
}

async function authCookie(account) {
  const jar = new Map();
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach((cookie) => jar.set(cookie.name, cookie.value)),
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email: account.email, password });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function api(route, cookie, method = "GET", body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { Accept: "application/json", ...(cookie ? { Cookie: cookie } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  return { response, data: await json(response) };
}

async function upload(cookie, jpeg, category, suffix) {
  const presign = await api("/api/uploads/presign", cookie, "POST", {
    filename: `${runId}-${suffix}.jpg`, contentType: "image/jpeg", fileSize: jpeg.length,
  });
  assert(presign.response.status === 200, `Presign failed: ${presign.response.status}`);
  storagePaths.add(presign.data.storagePath);
  const { error } = await publicClient.storage.from("images-original").uploadToSignedUrl(
    presign.data.storagePath,
    presign.data.token,
    jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength),
    { contentType: "image/jpeg" },
  );
  if (error) throw error;
  return api("/api/uploads", cookie, "POST", {
    title: `중복 E2E ${suffix}`,
    description: `중복 탐지 운영 검증 ${suffix}`,
    category_codes: [category],
    tags: ["e2e", "duplicate"],
    upload_session_id: presign.data.uploadSessionId,
    storage_path_original: presign.data.storagePath,
    original_filename: `${runId}-${suffix}.jpg`,
    copyright_license: "standard",
    free_usage_policy: "none",
    authorship_declaration: "human_original",
    factuality_attested: true,
    promotional_use_allowed: false,
  });
}

try {
  for (const account of accounts) await createAccount(account);
  const [cookieA, cookieB, adminCookie] = await Promise.all(accounts.map(authCookie));
  const { data: categories, error: categoryError } = await admin.from("image_categories").select("code").eq("active", true).limit(1);
  if (categoryError) throw categoryError;
  assert(categories?.[0]?.code, "No active category exists.");
  const jpeg = await sharp({ create: { width: 1280, height: 960, channels: 3, background: { r: 23, g: 87, b: 151 } } })
    .composite([{ input: Buffer.from('<svg width="1280" height="960"><circle cx="430" cy="410" r="230" fill="white"/><rect x="760" y="210" width="290" height="510" fill="black"/></svg>') }])
    .jpeg({ quality: 91 }).toBuffer();

  const first = await upload(cookieA, jpeg, categories[0].code, "first");
  assert(first.response.status === 201, `First upload expected 201: ${JSON.stringify(first.data)}`);
  imageIds.push(first.data.image.id);

  const samePhotographer = await upload(cookieA, jpeg, categories[0].code, "same-owner");
  assert(samePhotographer.response.status === 409, `Same-owner duplicate expected 409, got ${samePhotographer.response.status}`);
  assert(samePhotographer.data?.code === "DUPLICATE_UPLOAD", "Same-owner duplicate code is missing.");

  const crossPhotographer = await upload(cookieB, jpeg, categories[0].code, "cross-owner");
  assert(crossPhotographer.response.status === 201, `Cross-owner duplicate expected 201: ${JSON.stringify(crossPhotographer.data)}`);
  imageIds.push(crossPhotographer.data.image.id);
  assert(crossPhotographer.data.image.duplicate_review_status === "required", "Cross-owner duplicate was not held for review.");

  const reviewList = await api(`/api/admin/images?status=pending&query=${encodeURIComponent(`중복 E2E cross-owner`)}`, adminCookie);
  const duplicate = reviewList.data?.images?.find((image) => image.id === crossPhotographer.data.image.id);
  assert(duplicate?.duplicate_match_kind === "exact", "Admin review did not show an exact duplicate.");
  assert(duplicate?.duplicate_candidate?.id === first.data.image.id, "Admin review did not identify the candidate image.");

  const missingReason = await api(`/api/admin/images/${duplicate.id}/review`, adminCookie, "PATCH", { action: "approve" });
  assert(missingReason.response.status === 409, "Duplicate approval without a reason must be rejected.");
  const approved = await api(`/api/admin/images/${duplicate.id}/review`, adminCookie, "PATCH", {
    action: "approve", duplicate_override_reason: "운영 E2E에서 서로 다른 권리 이미지로 승인",
  });
  assert(approved.response.status === 200, `Duplicate override failed: ${JSON.stringify(approved.data)}`);
  assert(approved.data.image.duplicate_review_status === "overridden" && approved.data.image.is_published, "Duplicate override state is incorrect.");
  const { data: audit } = await admin.from("admin_audit_logs").select("id").eq("target_id", duplicate.id).eq("action", "image.duplicate_override_approved").maybeSingle();
  assert(audit?.id, "Duplicate override audit log is missing.");
  console.log("✓ same photographer exact duplicate: blocked with 409 DUPLICATE_UPLOAD");
  console.log("✓ cross photographer exact duplicate: admin candidate shown and reasoned override audited");
} catch (error) {
  failure = error;
} finally {
  const cleanupErrors = [];
  async function cleanup(label, operation) {
    try { const result = await operation(); if (result?.error) throw result.error; }
    catch (error) { cleanupErrors.push(`${label}: ${error instanceof Error ? error.message : error}`); }
  }
  if (imageIds.length) {
    await cleanup("events", () => admin.from("user_events").delete().in("image_id", imageIds));
    await cleanup("audit", () => admin.from("admin_audit_logs").delete().in("target_id", imageIds));
    await cleanup("images", () => admin.from("images").delete().in("id", imageIds));
  }
  if (storagePaths.size) {
    const paths = [...storagePaths];
    await cleanup("originals", () => admin.storage.from("images-original").remove(paths));
    await cleanup("previews", () => admin.storage.from("images-preview").remove([...paths, ...paths.map((path) => `thumbs/${path}`)]));
  }
  if (userIds.length) {
    await cleanup("fingerprints", () => admin.from("image_fingerprints").delete().in("photographer_id", userIds));
    await cleanup("sessions", () => admin.from("upload_sessions").delete().in("user_id", userIds));
  }
  for (const id of [...userIds].reverse()) await cleanup("auth user", () => admin.auth.admin.deleteUser(id));
  if (cleanupErrors.length) failure = new AggregateError([failure, ...cleanupErrors], "E2E cleanup failed");
  else console.log("✓ temporary accounts, images, fingerprints, sessions and storage cleaned up");
}

if (failure) throw failure;
