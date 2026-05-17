/**
 * scripts/migrate-prod.mjs
 * Supabase Management API를 통해 프로덕션 DB에 마이그레이션을 순서대로 실행합니다.
 *
 * 사용법:
 *   1. .env.local에 SUPABASE_ACCESS_TOKEN 추가
 *      (발급: https://supabase.com/dashboard/account/tokens)
 *   2. node scripts/migrate-prod.mjs
 */

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── env 로드 (.env.local) ──────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(join(__dir, "../.env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local 없으면 기존 process.env 사용
  }
}

loadEnv();

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

if (!ACCESS_TOKEN) {
  console.error(
    "❌ SUPABASE_ACCESS_TOKEN이 없습니다.\n" +
    "   https://supabase.com/dashboard/account/tokens 에서 발급 후\n" +
    "   .env.local에 SUPABASE_ACCESS_TOKEN=sbp_xxx 형식으로 추가하세요."
  );
  process.exit(1);
}

// project ref 추출: https://jelspkusznubqcbjsucw.supabase.co → jelspkusznubqcbjsucw
const match = SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
if (!match) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL에서 project ref를 추출할 수 없습니다:", SUPABASE_URL);
  process.exit(1);
}
const PROJECT_REF = match[1];
const API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

console.log(`\n🚀 프로젝트: ${PROJECT_REF}`);
console.log(`   API:      ${API_URL}\n`);

// ── SQL 실행 ──────────────────────────────────────────────────────────────
async function runSql(sql, label) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  // 성공 응답은 rows 배열 또는 빈 배열
  return res.json().catch(() => ({}));
}

// ── 마이그레이션 파일 목록 (순서 중요) ───────────────────────────────────
const MIGRATIONS_DIR = join(__dir, "../supabase/migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort(); // 파일명 오름차순 = 001, 002, ... 순서

console.log(`📂 마이그레이션 파일 ${files.length}개:\n`);
files.forEach((f) => console.log(`   ${f}`));
console.log();

// ── 실행 ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

for (const file of files) {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8").trim();
  if (!sql) {
    console.log(`⏭  ${file} — 비어있음, 건너뜀`);
    continue;
  }

  process.stdout.write(`⏳ ${file} ... `);
  try {
    await runSql(sql, file);
    console.log("✅ 완료");
    passed++;
  } catch (err) {
    console.log(`❌ 실패\n   ${err.message}`);
    failed++;
    // 치명적 오류가 아니면 계속 진행 (IF NOT EXISTS로 안전하게 작성됨)
  }
}

console.log(`\n──────────────────────────────`);
console.log(`✅ 성공: ${passed}  ❌ 실패: ${failed}`);
if (failed > 0) {
  console.log("\n실패한 항목은 Supabase SQL Editor에서 직접 확인하세요.");
}
