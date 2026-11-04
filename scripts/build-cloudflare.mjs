import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { join, relative, sep } from "node:path";
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

function collectApiRoutes(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectApiRoutes(path);
    if (!entry.isFile() || entry.name !== "route.ts") return [];
    return [relative(join(cwd, "src"), path).split(sep).join("/").replace(/\.ts$/, "")];
  });
}

const allApiRoutes = collectApiRoutes(join(cwd, "src", "app", "api")).sort();
const isAdminApiRoute = (route) => (
  route.startsWith("app/api/admin/") || route.startsWith("app/api/cron/")
);
writeFileSync(
  join(cwd, "open-next.api-routes.json"),
  `${JSON.stringify(allApiRoutes.filter((route) => !isAdminApiRoute(route)), null, 2)}\n`,
);
writeFileSync(
  join(cwd, "open-next.admin-api-routes.json"),
  `${JSON.stringify(allApiRoutes.filter(isAdminApiRoute), null, 2)}\n`,
);

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
  const exitCode = code ?? (signal ? 1 : 0);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  try {
    for (const functionName of ["api", "adminApi"]) {
      execFileSync(
        process.execPath,
        [join(cwd, "scripts", "bundle-cloudflare-api.mjs"), functionName],
        { cwd, env: buildEnv, stdio: "inherit" },
      );
    }
  } catch {
    process.exitCode = 1;
  }
});
