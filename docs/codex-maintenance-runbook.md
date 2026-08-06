# Codex 유지보수 개발 작업

> 상태: 기준
> 실행 주체: Codex Scheduled task
> 실행 환경: Image Partners Git 저장소의 격리 worktree

## 예약 작업 설정

Codex 앱의 Scheduled에서 다음 값으로 standalone 작업을 만든다.

- 이름: `Image Partners 승인 유지보수 개발`
- 프로젝트: `/Users/simini/Documents/Imgptns/imageptns`
- 주기: 3일마다, 한국시간 10:10
- 실행 환경: 새 격리 worktree
- 모델·추론: 기본값
- 프롬프트:

  ```text
  Image Partners 저장소의 docs/codex-maintenance-runbook.md와
  .github/codex/prompts/maintenance-implementation.md를 읽고 그대로 수행하세요.
  이번 실행에서는 열린 codex-ready 유지보수 후보를 우선순위에 따라 최대 한 건만
  재현·구현·검증하세요. 안전한 코드 변경은 테스트 통과 후 전용 브랜치와 draft PR로
  제출하되 PR을 병합하거나 운영 배포·운영 DB 변경·데이터 삭제는 하지 마세요.
  후보가 없거나 추가 승인이 필요하면 코드를 바꾸지 말고 정확한 근거와 요청사항을
  Scheduled 실행 결과로 보고하세요.
  ```

로컬 작업이므로 예약 시각에 Mac과 Codex 앱이 실행 중이어야 한다. 작업 생성 뒤 첫 실행은 수동으로 한 번 시작해 GitHub 조회, worktree 격리, 테스트와 draft PR 권한을 확인한다.

## 목적

GitHub Actions가 72시간마다 만든 개선 후보 가운데 사람이 구현을 승인한 항목을 Codex가 한 건씩 재현·수정·검증하고 검토용 draft PR로 전달한다. 검사와 후보 도출은 GitHub Actions, 실제 개발 판단과 구현은 Codex가 담당한다.

## 후보 선택

1. 원격 `main`과 GitHub 이슈를 조회할 수 있는지 확인한다.
2. 열린 이슈 중 `maintenance-candidate`, `maintenance-approved`, `codex-ready` 라벨이 모두 있고 `maintenance-in-progress` 라벨이 없는 항목만 대상으로 한다.
3. P0를 P1보다 먼저, 같은 우선순위에서는 오래 승인된 후보를 먼저 선택한다.
4. 한 실행에서는 후보 하나만 처리한다.
5. 후보가 없거나 GitHub에 접근할 수 없으면 코드를 바꾸지 않고 점검 결과와 필요한 조치를 보고한다.

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

## 실패와 반복 처리

- 테스트가 실패하면 실패 상태의 코드를 원격에 올리지 않는다. 가능한 범위에서 원인을 수정하고, 해결하지 못하면 변경 요약과 차단 원인을 보고한다.
- API·GitHub·네트워크 접근이 막히면 로컬 코드를 임의 변경하지 않고 필요한 권한을 보고한다.
- 이미 같은 후보의 PR이 있으면 새 PR을 만들지 않고 기존 PR 상태를 보고한다.
- 병합으로 후보 이슈가 닫히면 다음 실행에서 다음 `codex-ready` 후보를 선택한다.
- 예약 작업 결과는 Codex Scheduled 실행 기록에 남기고, 원격 변경을 만들었다면 이슈와 PR에도 재현 가능한 근거를 남긴다.
