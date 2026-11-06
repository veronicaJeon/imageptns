import { readFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { parseEnv } from "node:util";

const configPath = process.argv[2];

if (!configPath) {
  throw new Error("Usage: node scripts/upload-cloudflare-secrets.mjs <wrangler-config>");
}

const buildOnlyPrefixes = ["NX_", "TURBO_", "VERCEL"];
const plainTextVariableNames = new Set([
  "OPERATIONS_DAILY_REVIEW_ENABLED",
  "R2_IMAGE_STORAGE_ENABLED",
]);
const source = parseEnv(readFileSync(".dev.vars", "utf8"));
const secrets = Object.fromEntries(
  Object.entries(source).filter(
    ([key]) => !buildOnlyPrefixes.some((prefix) => key.startsWith(prefix))
      && !plainTextVariableNames.has(key),
  ),
);

const releaseSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const releaseRef = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
  encoding: "utf8",
}).trim();

Object.assign(secrets, {
  APP_RELEASE_REF: releaseRef,
  APP_RELEASE_SHA: releaseSha,
  RELEASE_COMMIT_SHA: releaseSha,
});

const result = spawnSync("npx", ["wrangler", "secret", "bulk", "--config", configPath], {
  encoding: "utf8",
  input: JSON.stringify(secrets),
  stdio: ["pipe", "inherit", "inherit"],
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
