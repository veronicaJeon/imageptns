import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import decodeJpeg, { init as initJpeg } from "@jsquash/jpeg/decode.js";
import decodePng, { init as initPng } from "@jsquash/png/decode.js";
import resize, { initResize } from "@jsquash/resize";
import decodeWebp, { init as initWebp } from "@jsquash/webp/decode.js";
import {
  createPortableImageFingerprint,
  PORTABLE_FINGERPRINT_ALGORITHM,
} from "../src/lib/images/portable-fingerprint.ts";

const apply = process.argv.includes("--apply");
const confirmedProduction = process.argv.includes("--confirm-production");
if (apply && !confirmedProduction) {
  throw new Error("Refusing to update fingerprints without --confirm-production");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase credentials are unavailable");

const compile = async (path) => WebAssembly.compile(await fs.readFile(path));
const [jpegWasm, pngWasm, webpWasm, resizeModule] = await Promise.all([
  compile("node_modules/@jsquash/jpeg/codec/dec/mozjpeg_dec.wasm"),
  compile("node_modules/@jsquash/png/codec/pkg/squoosh_png_bg.wasm"),
  compile("node_modules/@jsquash/webp/codec/dec/webp_dec.wasm"),
  compile("node_modules/@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm"),
]);
await Promise.all([
  initJpeg(jpegWasm),
  initPng(pngWasm),
  initWebp(webpWasm),
  initResize(resizeModule),
]);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: fingerprints, error: fingerprintError } = await admin
  .from("image_fingerprints")
  .select("id, image_id, original_sha256")
  .not("image_id", "is", null)
  .order("created_at", { ascending: true });
if (fingerprintError) throw fingerprintError;

const imageIds = (fingerprints ?? []).map((row) => row.image_id);
const { data: images, error: imageError } = await admin
  .from("images")
  .select("id, storage_path_original, file_format, upload_rotation_degrees")
  .in("id", imageIds);
if (imageError) throw imageError;
const imageById = new Map((images ?? []).map((image) => [image.id, image]));

function contentTypeFor(format) {
  const normalized = String(format ?? "").toUpperCase();
  if (normalized === "JPG" || normalized === "JPEG") return "image/jpeg";
  if (normalized === "PNG") return "image/png";
  if (normalized === "WEBP") return "image/webp";
  throw new Error(`Unsupported stored image format: ${normalized || "unknown"}`);
}

async function decode(bytes, contentType) {
  if (contentType === "image/jpeg") return decodeJpeg(bytes, { preserveOrientation: true });
  if (contentType === "image/png") return decodePng(bytes);
  if (contentType === "image/webp") return decodeWebp(bytes);
  throw new Error(`Unsupported content type: ${contentType}`);
}

async function sha256(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

let verified = 0;
let updated = 0;
for (const row of fingerprints ?? []) {
  const image = imageById.get(row.image_id);
  if (!image?.storage_path_original) throw new Error(`Missing original path for image ${row.image_id}`);

  const { data: original, error: downloadError } = await admin.storage
    .from("images-original")
    .download(image.storage_path_original);
  if (downloadError || !original) {
    throw new Error(`Could not download original for image ${row.image_id}: ${downloadError?.message ?? "not found"}`);
  }

  const bytes = await original.arrayBuffer();
  const contentType = contentTypeFor(image.file_format);
  const fingerprint = await createPortableImageFingerprint({
    originalBytes: bytes,
    decoded: await decode(bytes, contentType),
    rotationDegrees: image.upload_rotation_degrees ?? 0,
    sha256,
    resize: (source, width, height) => resize(source, {
      width,
      height,
      method: "lanczos3",
      fitMethod: "stretch",
      premultiply: true,
      linearRGB: true,
    }),
  });

  if (fingerprint.originalSha256 !== row.original_sha256) {
    throw new Error(`Original digest changed for image ${row.image_id}`);
  }
  verified += 1;

  if (apply) {
    const { error: updateError } = await admin
      .from("image_fingerprints")
      .update({
        phash: fingerprint.phash,
        dhash: fingerprint.dhash,
        width: fingerprint.width,
        height: fingerprint.height,
        algorithm_version: fingerprint.algorithmVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (updateError) throw new Error(`Could not update fingerprint ${row.id}: ${updateError.message}`);
    updated += 1;
  }

  if (verified % 10 === 0 || verified === fingerprints.length) {
    console.log(`${apply ? "updated" : "verified"} ${verified}/${fingerprints.length}`);
  }
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  algorithm: PORTABLE_FINGERPRINT_ALGORITHM,
  verified,
  updated,
}));
