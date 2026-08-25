# Codex 유지보수 개발 작업

> 상태: 기준
> 실행 주체: Codex Scheduled task
> 실행 환경: Image Partners Git 저장소의 격리 worktree

## 예약 작업 설정

Codex 앱의 Scheduled에서 다음 값으로 standalone 작업을 만든다.

- 이름: `Image Partners 승인 유지보수 개발`
- 프로젝트: `/Users/simini/Documents/Imgptns/imageptns`
- 주기: 매일, 한국시간 10:10
- 실행 환경: 새 격리 worktree
- 모델·추론: 기본값
- 프롬프트:

  ```text
  Image Partners 저장소의 docs/codex-maintenance-runbook.md와
  .github/codex/prompts/maintenance-implementation.md를 읽고 그대로 수행하세요.
  먼저 운영관리자 관점의 읽기 전용 일일 점검을 수행하세요. main·운영 SHA, health,
  공개 이미지 무결성, 처리 지연, 임베딩·이메일·서버 오류, 최근 핵심 활동을 확인하고
  재현 가능한 새 문제는 중복 없이 최대 3건의 approval-required 유지보수 후보로 기록하세요.
  열린 codex-ready 후보가 있으면 우선순위에 따라 최대 한 건만 재현·구현·검증하세요.
  안전한 코드 변경은 테스트 통과 후 전용 브랜치와 draft PR로 제출하되 PR을 병합하거나
  운영 배포·운영 DB 변경·데이터 삭제는 하지 마세요. 새 문제도 승인 후보도 없으면
  정상 근거와 관찰 지표를 Scheduled 실행 결과로 보고하세요.
  ```

로컬 작업이므로 예약 시각에 Mac과 Codex 앱이 실행 중이어야 한다. 작업 생성 뒤 첫 실행은 수동으로 한 번 시작해 GitHub 조회, worktree 격리, 테스트와 draft PR 권한을 확인한다.

## 목적

Codex가 매일 운영관리자 관점의 읽기 전용 진단을 수행하고, 재현 가능한 새 문제를 승인 대기 후보로 기록한다. 구현이 승인된 항목은 한 건씩 재현·수정·검증해 검토용 draft PR로 전달한다. GitHub Actions의 결정론적 감시·주간 코드 검사와 Codex의 맥락 기반 운영 진단을 함께 사용한다.

## 일일 운영관리자 점검

구현 후보 유무와 관계없이 다음을 먼저 확인한다.

1. 원격 `main` SHA와 현재 Production release SHA·ref가 일치하는지 확인한다.
2. `/api/health`의 DB, 공개·비공개 Storage, 순환 미리보기, AI, 일일 운영 점검 최신성을 확인한다.
3. 승인 공개 이미지의 미리보기·분석 사본·현재 임베딩 누락과 실패를 개인정보 없이 집계한다.
4. 이미지 검토, 사진가 신청, 일반 문의, 촬영 의뢰와 입금 확인의 SLA 초과 건수를 집계한다.
5. 이메일 실패, 최근 서버 오류, 가입·업로드·주문·다운로드 활동과 갑작스러운 변화 또는 장기 무활동을 확인한다.
6. 최근 GitHub monitor·주간 점검·Grok·Gemini 결과를 참고하되, AI 의견은 코드·DB·운영 근거로 독립 재현한 뒤에만 후보로 채택한다.

새 문제는 기존 열린 이슈와 고정 표식을 대조해 중복을 피하고 한 실행에 최대 3건만
`maintenance-candidate`, `approval-required`, 우선순위 라벨로 생성·갱신한다. 제목, 관찰
시각, 수치, 재현 절차, 사용자·운영 영향, 제안 조치와 완료 기준을 기록한다. 후보 생성은
구현 승인이 아니므로 `codex-ready`를 자동으로 붙이지 않는다.

## 후보 선택

1. 원격 `main`과 GitHub 이슈를 조회할 수 있는지 확인한다.
2. 열린 이슈 중 `maintenance-candidate`, `maintenance-approved`, `codex-ready` 라벨이 모두 있고 `maintenance-in-progress` 라벨이 없는 항목만 대상으로 한다.
3. P0를 P1보다 먼저, 같은 우선순위에서는 오래 승인된 후보를 먼저 선택한다.
4. 한 실행에서는 후보 하나만 처리한다.
5. 구현 후보가 없으면 코드를 바꾸지 않고 일일 운영관리자 점검과 최대 3건의 근거 기반 후보 기록까지만 수행한다. GitHub나 운영 읽기 진단에 접근할 수 없으면 정확한 차단 원인을 보고한다.

## 구현 절차

1. `AGENTS.md`, 후보 이슈, `docs/system-definition.md`, `docs/document-driven-development.md`, 이 문서와 관련 도메인 문서를 읽는다.
2. 이슈의 `maintenance-candidate:MNT-…` 표식, 완료 기준, 변경 분류와 승인 라벨을 다시 확인한다.
3. 현재 코드와 테스트로 문제를 재현한다. 근거가 오래됐거나 이미 해결됐다면 변경하지 않고 이슈에 재검토 근거를 남긴다.
4. 가장 작은 일관된 코드·테스트·문서 변경을 구현한다. 사용자 변경이 있는 작업 사본을 덮어쓰지 않는다.
5. 최소 다음 검증을 실행한다.

   ```bash
   npm audit --omit=dev --audit-level=high
   npm run typecheck
   npm run lint
   npm test
   npm run build
   ```

6. DB 변경이 필요하면 새 순방향 migration과 로컬 검증까지만 작성한다. 운영 DB에는 적용하지 않는다.
7. 검증이 통과하면 `codex/maintenance-mnt-…` 브랜치에 커밋하고 draft PR을 만든다. PR은 후보 이슈를 연결하고 변경·검증·위험·별도 승인 항목을 기록한다.
8. PR 생성 뒤 이슈에 `maintenance-in-progress` 라벨을 추가하고 `codex-ready` 라벨을 제거한다.

## 승인 경계

Codex가 예약 실행에서 해도 되는 작업:

- 저장소와 공개 운영 상태의 읽기 진단
- 소스·테스트·문서 수정
- 새 순방향 migration 파일 작성과 로컬 DB 검증
- 전용 브랜치 커밋·푸시와 draft PR 생성
- 후보 이슈에 진행 결과와 추가 결정 요청 기록

Codex가 예약 실행에서 하지 않는 작업:

- PR 병합
- 운영 배포
- 운영 DB migration 적용
- 운영 데이터 수정·삭제
- 자격증명 생성·교체 또는 외부 서비스 권한 확대
- 가격·수익배분·법적 공개 여부처럼 승인되지 않은 사업 결정 추정

후자의 작업이 필요하면 구현 가능한 안전한 부분까지만 PR에 담고 정확한 승인 요청을 남긴다.

## 운영 릴리스 규칙

예약 실행 자체는 운영 릴리스를 승인하지 않는다. 다만 같은 작업에서 사용자가 이후에
`운영 반영`, `운영 배포` 또는 이에 준하는 명시적 지시를 하면, 그 지시는 검증된 변경을
`main`에 병합하고 **그 main 커밋을** Production에 배포하는 전체 릴리스 절차의 승인으로
해석한다. 별도로 "PR 병합"이라는 표현을 다시 요구하지 않는다.

운영 릴리스는 다음 순서를 지킨다.

1. draft PR의 변경 범위, CI, migration, 미해결 리뷰와 병합 가능 상태를 다시 확인한다.
2. draft를 해제하고 PR을 `main`에 병합한다.
3. 원격 `main`을 다시 조회해 병합된 커밋을 포함하는지 확인하고 릴리스 SHA를 고정한다.
4. 운영 migration이 있으면 반드시 migration 파일이 `main`에 들어간 뒤에만 사전 점검하고,
   문서화된 호환 순서에 따라 순방향으로 적용한다.
5. Vercel Git 연동 배포를 우선 사용한다. CLI 수동 배포가 필요해도 깨끗한 `origin/main`
   worktree의 고정된 릴리스 SHA에서만 Production 배포한다.
6. 배포 SHA, Vercel deployment ID, migration 상태와 운영 smoke test 결과를 기록한다.

feature 브랜치, 미병합 PR, dirty worktree 또는 `main`에 없는 로컬 커밋을 Production에
직접 배포하지 않는다. 병합 권한·필수 검사·리뷰·migration 안전성 중 하나라도 충족되지
않으면 운영 배포도 진행하지 않고 정확한 차단 사유를 보고한다. 긴급한 예외 배포가 정말
필요하면 사용자가 feature 브랜치 직접 배포와 main 불일치를 각각 명시적으로 승인해야 하며,
즉시 main 정합성 복구 계획을 함께 남긴다.

## 실패와 반복 처리

- 테스트가 실패하면 실패 상태의 코드를 원격에 올리지 않는다. 가능한 범위에서 원인을 수정하고, 해결하지 못하면 변경 요약과 차단 원인을 보고한다.
- API·GitHub·네트워크 접근이 막히면 로컬 코드를 임의 변경하지 않고 필요한 권한을 보고한다.
- 이미 같은 후보의 PR이 있으면 새 PR을 만들지 않고 기존 PR 상태를 보고한다.
- 병합으로 후보 이슈가 닫히면 다음 실행에서 다음 `codex-ready` 후보를 선택한다.
- 예약 작업 결과는 Codex Scheduled 실행 기록에 남기고, 원격 변경을 만들었다면 이슈와 PR에도 재현 가능한 근거를 남긴다.
