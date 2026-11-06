import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { storageBinaryBody } from "@/lib/supabase/storage-body";
import {
  imageStorageObjectKey,
  imageStorageProvider,
  type ImageStorageBucket,
} from "./image-path";

type AdminClient = ReturnType<typeof createAdminClient>;

interface R2ObjectBody {
  size: number;
  httpEtag: string;
  httpMetadata?: { contentType?: string };
  body: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  writeHttpMetadata(headers: Headers): void;
}

interface R2PutResult {
  size: number;
}

export interface ImageR2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<{ size: number } | null>;
  put(
    key: string,
    value: ReadableStream<Uint8Array> | ArrayBuffer | ArrayBufferView | Blob | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<R2PutResult>;
  delete(keys: string | string[]): Promise<void>;
}

export class ImageStorageUnavailableError extends Error {
  constructor(message = "R2 image storage is unavailable") {
    super(message);
    this.name = "ImageStorageUnavailableError";
  }
}

export async function imageR2Bucket(): Promise<ImageR2Bucket | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext<Record<string, unknown>, unknown>({ async: true });
    return (context.env as { IMAGE_STORAGE?: ImageR2Bucket }).IMAGE_STORAGE ?? null;
  } catch {
    return null;
  }
}

export function r2ImageStorageRequested(environment: NodeJS.ProcessEnv = process.env) {
  return environment.R2_IMAGE_STORAGE_ENABLED === "true";
}

export async function r2ImageStorageAvailable() {
  return r2ImageStorageRequested() && Boolean(await imageR2Bucket());
}

export async function putImageObject(
  admin: AdminClient,
  bucket: ImageStorageBucket,
  path: string,
  value: Buffer | ArrayBuffer | Blob,
  options: { contentType: string; cacheControl?: string },
) {
  if (imageStorageProvider(path) === "supabase") {
    const body = value instanceof Blob
      ? value
      : value instanceof ArrayBuffer
        ? value
        : storageBinaryBody(value);
    const maxAge = options.cacheControl?.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1];
    const { error } = await admin.storage.from(bucket).upload(path, body, {
      contentType: options.contentType,
      upsert: true,
      ...(maxAge ? { cacheControl: maxAge } : {}),
    });
    if (error) throw error;
    return;
  }

  const r2 = await imageR2Bucket();
  if (!r2) throw new ImageStorageUnavailableError();
  await r2.put(imageStorageObjectKey(bucket, path), value, {
    httpMetadata: {
      contentType: options.contentType,
      cacheControl: options.cacheControl,
    },
  });
}

export async function downloadImageObject(
  admin: AdminClient,
  bucket: ImageStorageBucket,
  path: string,
) {
  if (imageStorageProvider(path) === "supabase") {
    const { data, error } = await admin.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error("Stored image was not found");
    return data;
  }

  const r2 = await imageR2Bucket();
  if (!r2) throw new ImageStorageUnavailableError();
  const object = await r2.get(imageStorageObjectKey(bucket, path));
  if (!object) throw new Error("Stored image was not found");
  return new Blob([await object.arrayBuffer()], {
    type: object.httpMetadata?.contentType ?? "application/octet-stream",
  });
}

export async function removeImageObjects(
  admin: AdminClient,
  bucket: ImageStorageBucket,
  paths: string[],
) {
  const supabasePaths = paths.filter((path) => imageStorageProvider(path) === "supabase");
  const r2Paths = paths.filter((path) => imageStorageProvider(path) === "r2");

  if (supabasePaths.length > 0) {
    const { error } = await admin.storage.from(bucket).remove(supabasePaths);
    if (error) throw error;
  }
  if (r2Paths.length > 0) {
    const r2 = await imageR2Bucket();
    if (!r2) throw new ImageStorageUnavailableError();
    await r2.delete(r2Paths.map((path) => imageStorageObjectKey(bucket, path)));
  }
}

export async function getR2ImageObject(bucket: ImageStorageBucket, path: string) {
  const r2 = await imageR2Bucket();
  if (!r2) throw new ImageStorageUnavailableError();
  return r2.get(imageStorageObjectKey(bucket, path));
}
