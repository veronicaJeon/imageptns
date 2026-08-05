import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const outputPath = process.argv[2];
const backlogPath = process.argv[3] ?? "docs/operations-backlog.md";

if (!outputPath) {
  console.error("Usage: node scripts/derive-maintenance-candidates.mjs <output.json> [backlog.md]");
  process.exit(2);
}

const results = JSON.parse(process.env.MAINTENANCE_RESULTS ?? "{}");

const checkDefinitions = {
  install: ["P0", "의존성 설치 복구", "lockfile과 레지스트리 오류를 재현하고 `npm ci`가 통과하도록 수정한다."],
  audit: ["P0", "High 이상 의존성 취약점 조치", "취약 경로와 호환성 영향을 확인한 뒤 최소 버전 변경 PR을 준비한다."],
  typecheck: ["P1", "TypeScript 오류 수정", "실패 로그의 최초 원인을 수정하고 회귀 테스트를 추가한다."],
  lint: ["P1", "Lint 오류 수정", "오류 규칙을 만족하는 최소 변경을 만들고 동작 변경 여부를 검토한다."],
  test: ["P1", "자동 테스트 실패 수정", "실패 테스트를 재현하고 제품 결함인지 테스트 결함인지 구분해 수정한다."],
  build: ["P0", "프로덕션 빌드 실패 수정", "운영과 동일한 환경에서 빌드를 복구하고 Preview에서 핵심 경로를 확인한다."],
  supabase_cli: ["P1", "Supabase 검증 도구 복구", "고정 CLI 설치 실패 원인을 수정해 DB 검증을 다시 활성화한다."],
  database_start: ["P0", "Fresh DB migration 실패 수정", "빈 DB에서 실패 migration을 순방향 migration으로 수정하고 기존 운영 적용 여부를 확인한다."],
  database_lint: ["P0", "DB schema lint 오류 수정", "오류 함수·정책을 최소 migration으로 수정하고 RLS 회귀를 검증한다."],
  health: ["P0", "운영 health 이상 복구", "실패한 구성요소를 재현하고 사용자 영향·롤백 여부를 먼저 판단한다."],
  smoke: ["P0", "공개 핵심 경로 장애 복구", "실패 경로와 HTTP 상태를 확인하고 Preview 검증 후 운영 반영한다."],
  checkout_readiness: ["P0", "계좌이체 공개 경계 복구", "계좌·공시·베타 플래그의 모순을 해소하고 주문 E2E를 재실행한다."],
};

function candidateId(source, title) {
  return `MNT-${createHash("sha256").update(`${source}:${title}`).digest("hex").slice(0, 10).toUpperCase()}`;
}

function makeCandidate({ source, priority, title, evidence, proposal, acceptance, changeClass }) {
  return {
    id: candidateId(source, title),
    source,
    priority,
    title,
    evidence,
    proposal,
    acceptance,
    changeClass,
  };
}

const candidates = [];

for (const [key, definition] of Object.entries(checkDefinitions)) {
  if (results[key] && results[key] !== "success") {
    const [priority, title, proposal] = definition;
    candidates.push(makeCandidate({
      source: `check:${key}`,
      priority,
      title,
      evidence: `72시간 점검의 \`${key}\` 결과가 \`${results[key]}\`입니다.`,
      proposal,
      acceptance: `${key} 점검이 통과하고 관련 회귀 테스트와 변경 문서가 갱신된다.`,
      changeClass: "code-or-configuration",
    }));
  }
}

if (results.branch_protection && results.branch_protection !== "verified") {
  candidates.push(makeCandidate({
    source: "check:branch-protection",
    priority: "P0",
    title: "main 브랜치와 운영 배포 승인 게이트 설정",
    evidence: `브랜치 보호 확인 결과가 \`${results.branch_protection}\`입니다.`,
    proposal: "저장소 관리자가 필수 CI, PR 승인, Production environment 승인자를 설정한다.",
    acceptance: "워크플로 토큰 또는 관리자 증거로 main 보호와 Production 승인 설정을 확인한다.",
    changeClass: "external-approval",
  }));
}

const backlogDocument = readFileSync(backlogPath, "utf8");
const currentReviewStart = backlogDocument.indexOf("## 2026-08-05 공개 오픈 재검토");
const currentReviewTail = currentReviewStart >= 0
  ? backlogDocument.slice(currentReviewStart + 1)
  : backlogDocument;
const nextSectionOffset = currentReviewTail.indexOf("\n## ");
const backlog = nextSectionOffset >= 0
  ? currentReviewTail.slice(0, nextSectionOffset)
  : currentReviewTail;
const incompletePattern = /(대기|필요|결함|검토|정책|권한|훈련|도입|구축)/;

for (const line of backlog.split("\n")) {
  if (!line.startsWith("| P0") && !line.startsWith("| P1")) continue;
  const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
  if (cells.length < 4) continue;
  const [priority, status, title, nextAction] = cells;
  if (!incompletePattern.test(status)) continue;

  candidates.push(makeCandidate({
    source: `backlog:${title}`,
    priority,
    title,
    evidence: `운영 백로그 상태: \`${status}\`.`,
    proposal: nextAction,
    acceptance: "운영 백로그의 완료 기준을 충족하고 재검증 가능한 근거와 날짜를 문서에 기록한다.",
    changeClass: /(정보|권한|정책|훈련)/.test(status) ? "external-approval" : "code-or-configuration",
  }));
}

const deduplicated = candidates.filter((candidate) => !(
  candidate.source === "check:branch-protection"
  && candidates.some((other) => other !== candidate && /main.*(브랜치|Production|배포)/.test(other.title))
));

const unique = [...new Map(deduplicated.map((candidate) => [candidate.id, candidate])).values()]
  .sort((a, b) => a.priority.localeCompare(b.priority) || a.title.localeCompare(b.title));

writeFileSync(outputPath, `${JSON.stringify(unique, null, 2)}\n`);
console.log(`Derived ${unique.length} active maintenance candidate(s).`);
