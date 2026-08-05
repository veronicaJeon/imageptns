#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const PHASH_SIZE = 32;
const HASH_SIZE = 8;

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    const key = trimmed.slice(0, separator);
    let value = trimmed.slice(separator + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return [[key, value.replace(/\\n/g, "\n")]];
  }));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dct(pixels, u, v) {
  let sum = 0;
  for (let y = 0; y < PHASH_SIZE; y += 1) {
    for (let x = 0; x < PHASH_SIZE; x += 1) {
      sum += pixels[y * PHASH_SIZE + x]
        * Math.cos(((2 * x + 1) * u * Math.PI) / (2 * PHASH_SIZE))
        * Math.cos(((2 * y + 1) * v * Math.PI) / (2 * PHASH_SIZE));
    }
  }
  return sum;
}

async function fingerprint(input, rotation) {
  const normalizedRotation = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
  const metadata = await sharp(input).metadata();
  const swapsDimensions = normalizedRotation === 90 || normalizedRotation === 270;
  const pPixels = await sharp(input).rotate().rotate(normalizedRotation).resize(PHASH_SIZE, PHASH_SIZE, { fit: "fill" }).greyscale().raw().toBuffer();
  const dPixels = await sharp(input).rotate().rotate(normalizedRotation).resize(HASH_SIZE + 1, HASH_SIZE, { fit: "fill" }).greyscale().raw().toBuffer();
  const coefficients = [];
  for (let v = 0; v < HASH_SIZE; v += 1) for (let u = 0; u < HASH_SIZE; u += 1) coefficients.push(dct(pPixels, u, v));
  const threshold = median(coefficients.slice(1));
  const phash = coefficients.map((value, index) => index === 0 || value >= threshold ? "1" : "0").join("");
  let dhash = "";
  for (let y = 0; y < HASH_SIZE; y += 1) {
    for (let x = 0; x < HASH_SIZE; x += 1) {
      dhash += dPixels[y * (HASH_SIZE + 1) + x] > dPixels[y * (HASH_SIZE + 1) + x + 1] ? "1" : "0";
    }
  }
  return {
    original_sha256: createHash("sha256").update(input).digest("hex"),
    phash,
    dhash,
    width: swapsDimensions ? metadata.autoOrient.height : metadata.autoOrient.width,
    height: swapsDimensions ? metadata.autoOrient.width : metadata.autoOrient.height,
  };
}

const confirmed = process.argv.includes("--confirm-production");
const envPath = process.argv.find((arg) => arg.startsWith("--env="))?.slice(6) ?? ".env.production.local";
if (!confirmed) throw new Error("Run with --confirm-production after reviewing the target environment.");

const fileEnv = parseEnv(await readFile(envPath, "utf8"));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? fileEnv.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Production Supabase URL/service role key is missing.");
const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

let offset = 0;
let inserted = 0;
let skipped = 0;
let failed = 0;
while (true) {
  const { data: images, error } = await supabase
    .from("images")
    .select("id, photographer_id, storage_path_original, storage_path_full, upload_rotation_degrees")
    .order("created_at", { ascending: true })
    .range(offset, offset + 49);
  if (error) throw error;
  if (!images?.length) break;

  for (const image of images) {
    const { data: existing } = await supabase.from("image_fingerprints").select("id").eq("image_id", image.id).maybeSingle();
    if (existing) { skipped += 1; continue; }
    const path = image.storage_path_original ?? image.storage_path_full;
    if (!path || !image.photographer_id) { skipped += 1; continue; }
    try {
      const { data: file, error: downloadError } = await supabase.storage.from("images-original").download(path);
      if (downloadError || !file) throw downloadError ?? new Error("Original not found");
      const computed = await fingerprint(Buffer.from(await file.arrayBuffer()), image.upload_rotation_degrees);
      const { error: insertError } = await supabase.from("image_fingerprints").insert({
        image_id: image.id,
        photographer_id: image.photographer_id,
        ...computed,
        algorithm_version: "phash-dhash-v1",
      });
      if (insertError?.code === "23505") skipped += 1;
      else if (insertError) throw insertError;
      else inserted += 1;
    } catch (error) {
      failed += 1;
      console.error(`fingerprint backfill failed for image ${image.id}:`, error instanceof Error ? error.message : error);
    }
  }
  offset += images.length;
}

console.log(JSON.stringify({ inserted, skipped, failed }));
if (failed > 0) process.exitCode = 1;
