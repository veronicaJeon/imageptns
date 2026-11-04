import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundleServer } from "../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js";
import {
  getNormalizedOptions,
  retrieveCompiledConfig,
} from "../node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/utils.js";

const cwd = process.cwd();
const functionsDirectory = join(cwd, ".open-next", "server-functions");
const defaultDirectory = join(functionsDirectory, "default");
const apiDirectory = join(functionsDirectory, "api");
const defaultBackupDirectory = join(functionsDirectory, ".default-backup");

if (!existsSync(defaultDirectory) || !existsSync(apiDirectory)) {
  throw new Error("OpenNext default and API server functions must exist before API bundling");
}
if (existsSync(defaultBackupDirectory)) {
  throw new Error(`Refusing to overwrite stale bundle backup: ${defaultBackupDirectory}`);
}

renameSync(defaultDirectory, defaultBackupDirectory);
renameSync(apiDirectory, defaultDirectory);

try {
  const { config } = await retrieveCompiledConfig();
  const options = getNormalizedOptions(config);
  await bundleServer(options, { minify: true, sourceDir: cwd });
} finally {
  renameSync(defaultDirectory, apiDirectory);
  renameSync(defaultBackupDirectory, defaultDirectory);
}

for (const filename of ["handler.mjs", "handler.mjs.meta.json"]) {
  const outputPath = join(apiDirectory, filename);
  const output = readFileSync(outputPath, "utf8").replaceAll(
    ".open-next/server-functions/default",
    ".open-next/server-functions/api",
  );
  writeFileSync(outputPath, output);
}
