import fs from "node:fs";

const envPath = new URL("../.env.local", import.meta.url);
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

function envValue(name) {
  const match = envText.match(new RegExp(`^${name}=(.*)$`, "m"));
  return match?.[1]?.trim() ?? process.env[name] ?? "";
}

const url = envValue("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = envValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceKey = envValue("SUPABASE_SERVICE_ROLE_KEY");

function keyState(value) {
  if (!value) return "missing";
  return `set len=${value.length}`;
}

console.log("Local Supabase env:");
console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${url || "missing"}`);
console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${keyState(anonKey)}`);
console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${keyState(serviceKey)}`);

if (!url) {
  console.error("NEXT_PUBLIC_SUPABASE_URL is missing.");
  process.exit(1);
}

let healthUrl;
try {
  healthUrl = new URL("/rest/v1/", url);
} catch {
  console.error(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${url}`);
  process.exit(1);
}

try {
  const response = await fetch(healthUrl, {
    headers: anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {},
  });
  console.log(`- REST health: HTTP ${response.status}`);
  if (response.status >= 200 && response.status < 500) {
    console.log("Local Supabase is reachable.");
    process.exit(0);
  }
  console.error("Local Supabase responded with an unexpected server error.");
  process.exit(1);
} catch (error) {
  console.error(`Local Supabase is not reachable at ${healthUrl.origin}.`);
  console.error(error instanceof Error ? error.message : String(error));
  console.error("Start it with: npm run supabase:start");
  process.exit(1);
}
