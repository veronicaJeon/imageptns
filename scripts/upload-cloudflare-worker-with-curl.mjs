import { basename, join } from "node:path";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const [configPath] = process.argv.slice(2);

if (!configPath) {
  throw new Error(
    "Usage: node scripts/upload-cloudflare-worker-with-curl.mjs <wrangler-config>",
  );
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const credentialsPath = [
  process.env.WRANGLER_HOME && join(process.env.WRANGLER_HOME, "config/default.toml"),
  process.env.XDG_CONFIG_HOME && join(process.env.XDG_CONFIG_HOME, ".wrangler/config/default.toml"),
  process.env.HOME && join(process.env.HOME, "Library/Preferences/.wrangler/config/default.toml"),
  process.env.HOME && join(process.env.HOME, ".config/.wrangler/config/default.toml"),
].find((candidate) => {
  if (!candidate) return false;
  try {
    readFileSync(candidate);
    return true;
  } catch {
    return false;
  }
});

if (!credentialsPath) {
  throw new Error("No Wrangler credentials file found");
}

const credentials = readFileSync(credentialsPath, "utf8");
const oauthToken = credentials.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];

if (!oauthToken) {
  throw new Error(`No Wrangler OAuth token found in ${credentialsPath}`);
}

const bindings = [
  ...Object.entries(config.vars ?? {}).map(([name, text]) => ({
    type: "plain_text",
    name,
    text: String(text),
  })),
  ...(config.services ?? []).map(({ binding, service, environment }) => ({
    type: "service",
    name: binding,
    service,
    ...(environment ? { environment } : {}),
  })),
  ...(config.r2_buckets ?? []).map(
    ({ binding, bucket_name, jurisdiction, raw }) => ({
      type: "r2_bucket",
      name: binding,
      bucket_name,
      ...(jurisdiction ? { jurisdiction } : {}),
      ...(raw ? { raw } : {}),
    }),
  ),
];

if (!config.account_id) {
  throw new Error(`No account_id configured in ${configPath}`);
}

const outputDirectory = mkdtempSync(join(tmpdir(), `${config.name}-upload-`));
const bundleResult = spawnSync(
  "npx",
  ["wrangler", "deploy", "--config", configPath, "--dry-run", "--outdir", outputDirectory],
  { encoding: "utf8", stdio: "inherit" },
);

if (bundleResult.error) throw bundleResult.error;
if (bundleResult.status !== 0) process.exit(bundleResult.status ?? 1);

const moduleName = basename(config.main).replace(/\.[^.]+$/, ".js");
const bundlePath = join(outputDirectory, moduleName);
const metadata = {
  main_module: moduleName,
  bindings,
  compatibility_date: config.compatibility_date,
  compatibility_flags: config.compatibility_flags,
  placement: config.placement,
  observability: config.observability,
};
const endpoint =
  `https://api.cloudflare.com/client/v4/accounts/${config.account_id}` +
  `/workers/scripts/${config.name}?excludeScript=true&bindings_inherit=strict`;

let result;
try {
  result = spawnSync(
    "curl",
    [
      "--silent",
      "--show-error",
      "--fail-with-body",
      "--http1.1",
      "--retry",
      "4",
      "--retry-all-errors",
      "--connect-timeout",
      "15",
      "--max-time",
      "180",
      "--request",
      "PUT",
      endpoint,
      "--header",
      `Authorization: Bearer ${oauthToken}`,
      "--header",
      "Expect:",
      "--form-string",
      `metadata=${JSON.stringify(metadata)}`,
      "--form",
      `${moduleName}=@${bundlePath};type=application/javascript+module`,
    ],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}

if (result.error) throw result.error;

let response;
try {
  response = JSON.parse(result.stdout);
} catch {
  response = null;
}

if (result.status !== 0 || response?.success !== true) {
  const details = response?.errors ?? result.stderr.trim() ?? "Unknown Cloudflare API error";
  throw new Error(`Cloudflare upload failed: ${JSON.stringify(details)}`);
}

console.log(
  JSON.stringify({
    worker: config.name,
    version: response.result?.deployment_id ?? response.result?.id ?? null,
    startupTimeMs: response.result?.startup_time_ms ?? null,
  }),
);
