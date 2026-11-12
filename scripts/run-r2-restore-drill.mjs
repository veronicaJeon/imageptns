import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const suffix = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const workerName = `imagepartners-restore-drill-${suffix}`;
const bucketName = `imagepartners-restore-drill-${suffix}`;
const token = randomBytes(32).toString("hex");
const directory = mkdtempSync(join(tmpdir(), "imagepartners-r2-drill-"));
const configPath = join(directory, "wrangler.jsonc");
const workerPath = new URL("./r2-restore-drill-worker.mjs", import.meta.url).pathname;
let workerCreated = false;
let bucketCreated = false;
let workerUrl = null;
let authHeaders = null;
let sourceKey = null;
let restoreKey = null;
let cleanupVerified = false;

function command(args, options = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

try {
  command(["r2", "bucket", "create", bucketName]);
  bucketCreated = true;
  writeFileSync(configPath, JSON.stringify({
    name: workerName,
    main: workerPath,
    compatibility_date: "2026-11-02",
    workers_dev: true,
    r2_buckets: [
      { binding: "SOURCE_BUCKET", bucket_name: "imagepartners-images" },
      { binding: "TARGET_BUCKET", bucket_name: bucketName },
    ],
  }, null, 2), { mode: 0o600 });

  const deployment = command(["deploy", "--config", configPath]);
  workerCreated = true;
  command(["secret", "put", "RESTORE_DRILL_TOKEN", "--config", configPath], { input: `${token}\n` });
  workerUrl = deployment.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0]
    ?? `https://${workerName}.soniformusic.workers.dev`;
  authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  let copyResponse;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    copyResponse = await fetch(`${workerUrl}/copy`, { method: "POST", headers: authHeaders, body: "{}" });
    if (copyResponse.status !== 403) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  let copy = await copyResponse.json();
  if (!copyResponse.ok || !copy.ok) throw new Error(`R2 restore copy failed: ${copy.error ?? copyResponse.status}`);

  if (!copy.restored) {
    const seedResponse = await fetch(`${workerUrl}/seed`, { method: "POST", headers: authHeaders, body: "{}" });
    const seed = await seedResponse.json();
    if (!seedResponse.ok || !seed.ok) throw new Error(`R2 restore seed failed: ${seed.error ?? seedResponse.status}`);
    sourceKey = seed.sourceKey;
    copyResponse = await fetch(`${workerUrl}/copy`, { method: "POST", headers: authHeaders, body: "{}" });
    copy = await copyResponse.json();
    if (!copyResponse.ok || !copy.ok || !copy.restored) {
      throw new Error(`R2 seeded restore copy failed: ${copy.error ?? copyResponse.status}`);
    }
  }

  if (copy.restored) {
    restoreKey = copy.restoreKey;
    const cleanupResponse = await fetch(`${workerUrl}/cleanup`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ restoreKey, sourceKey }),
    });
    const cleanup = await cleanupResponse.json();
    if (!cleanupResponse.ok || !cleanup.ok) throw new Error(`R2 restore cleanup failed: ${cleanup.error ?? cleanupResponse.status}`);
    cleanupVerified = true;
  }

  console.log(JSON.stringify({
    ok: true,
    sourceObjectCount: copy.objectCount,
    sourceTotalBytes: copy.totalBytes,
    restored: copy.restored,
    sampleBytes: copy.sampleBytes ?? null,
    sampleHashMatched: copy.restored ? copy.sourceHash === copy.restoredHash : null,
    sourceKeyHash: copy.sourceKeyHash ?? null,
    usedSyntheticSource: Boolean(sourceKey),
    cleanupVerified: true,
  }, null, 2));
} finally {
  if (!cleanupVerified && workerUrl && authHeaders && (restoreKey || sourceKey)) {
    try {
      await fetch(`${workerUrl}/cleanup`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ restoreKey, sourceKey }),
      });
    } catch {}
  }
  if (workerCreated) {
    try { command(["delete", workerName, "--force"]); } catch {}
  }
  if (bucketCreated) {
    try { command(["r2", "bucket", "delete", bucketName]); } catch {}
  }
  rmSync(directory, { recursive: true, force: true });
}
