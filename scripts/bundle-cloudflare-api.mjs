import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundleServer } from "../node_modules/@opennextjs/cloudflare/dist/cli/build/bundle-server.js";
import {
  getNormalizedOptions,
  retrieveCompiledConfig,
} from "../node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/utils.js";

const cwd = process.cwd();
const functionName = process.argv[2] ?? "api";
if (!/^[A-Za-z][A-Za-z0-9]*$/.test(functionName)) {
  throw new Error(`Invalid OpenNext function name: ${functionName}`);
}
const functionsDirectory = join(cwd, ".open-next", "server-functions");
const defaultDirectory = join(functionsDirectory, "default");
const functionDirectory = join(functionsDirectory, functionName);
const defaultBackupDirectory = join(functionsDirectory, ".default-backup");

if (!existsSync(defaultDirectory) || !existsSync(functionDirectory)) {
  throw new Error(`OpenNext default and ${functionName} server functions must exist before bundling`);
}
if (existsSync(defaultBackupDirectory)) {
  throw new Error(`Refusing to overwrite stale bundle backup: ${defaultBackupDirectory}`);
}

renameSync(defaultDirectory, defaultBackupDirectory);
renameSync(functionDirectory, defaultDirectory);

try {
  const { config } = await retrieveCompiledConfig();
  const options = getNormalizedOptions(config);
  await bundleServer(options, { minify: true, sourceDir: cwd });
} finally {
  renameSync(defaultDirectory, functionDirectory);
  renameSync(defaultBackupDirectory, defaultDirectory);
}

for (const filename of ["handler.mjs", "handler.mjs.meta.json"]) {
  const outputPath = join(functionDirectory, filename);
  const output = readFileSync(outputPath, "utf8").replaceAll(
    ".open-next/server-functions/default",
    `.open-next/server-functions/${functionName}`,
  );
  writeFileSync(outputPath, output);
}
