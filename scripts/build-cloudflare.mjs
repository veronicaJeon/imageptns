import { existsSync, readFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
import { parseEnv } from "node:util";

const cwd = process.cwd();
const devVarsPath = join(cwd, ".dev.vars");

function cleanEnvValue(value) {
  return value
    .replace(/\\n$/g, "")
    .replace(/\n$/g, "")
    .trim();
}

const buildEnv = { ...process.env };
buildEnv.CLOUDFLARE_BUILD = "1";

if (existsSync(devVarsPath)) {
  const devVars = parseEnv(readFileSync(devVarsPath, "utf8"));
  for (const [key, value] of Object.entries(devVars)) {
    buildEnv[key] = cleanEnvValue(value);
  }
}

try {
  buildEnv.APP_RELEASE_SHA ||= execFileSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
  }).trim();
  buildEnv.APP_RELEASE_REF ||= execFileSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf8",
  }).trim();
} catch {
  // Release metadata is optional outside a Git checkout.
}

const executable = join(
  cwd,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "opennextjs-cloudflare.cmd" : "opennextjs-cloudflare",
);
const child = spawn(executable, ["build"], {
  cwd,
  env: buildEnv,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Cloudflare build could not start:", error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
