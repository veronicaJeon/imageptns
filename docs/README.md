# Image Partners 문서 안내

이 디렉터리는 제품 동작을 추측하지 않고 재현 가능한 근거로 개발·운영하기 위한 문서 집합이다.

## 반드시 읽을 문서

1. [시스템 정의서](./system-definition.md) — 현재 승인된 제품·시스템 기준
2. [문서 기반 개발 규칙](./document-driven-development.md) — 변경 제안부터 배포까지의 절차
3. [운영 잔여 과제](./operations-backlog.md) — 미완료 과제, 우선순위, 검증 근거
4. [공개 오픈 준비도 검토](./opening-readiness-review.md) — 오픈 게이트와 3일 유지보수 루틴 제안
5. [72시간 유지보수 루틴](./maintenance-routine.md) — 개선 후보 도출·승인 대기열·수정·배포 결과 누적 절차

## 영역별 세부 규격

| 영역 | 기준 문서 |
| --- | --- |
| 사용자 화면 용어 | [서비스 표준 용어](./service-terminology.md) |
| 이미지 상태·노출 | [이미지 상태와 화면 노출 기준](./image-state-visibility.md) |
| 중복 이미지 | [중복 이미지 탐지·차단 제안](./duplicate-image-detection-proposal.md) |
| 운영정책 | [운영정책 문서함](./operating-policy-handbook.md) |
| UI·디자인 | [디자인 시스템 가이드](./design-system-guidelines.md) |
| 모니터링·장애대응 | [운영 모니터링 기준](./operations-monitoring.md) |
| 정기 유지보수 | [72시간 유지보수 루틴](./maintenance-routine.md) |
| 배포 | [운영 배포 인수인계](./production-deployment-handoff.md), [Vercel 배포 런북](./vercel-deployment-runbook.md) |
| 온체인 | [운영 준비도](./onchain-production-readiness.md), [위험 등록부](./onchain-production-risk-register.md) |

`docs/superpowers/specs`와 `docs/superpowers/plans`는 당시 설계·구현 기록이다. 현재 동작과 충돌하면 시스템 정의서, 최신 도메인 규격, 실제 마이그레이션 및 검증된 운영 동작을 우선 대조하고 충돌을 결함으로 기록한다.

## 문서 상태 표기

- `기준`: 현재 구현과 운영에서 지켜야 하는 규격
- `초안`: 결정 전 제안이며 구현 근거로 단독 사용하지 않음
- `계획`: 승인된 미래 작업이나 아직 현재 동작은 아님
- `기록`: 당시 의사결정·배포 증거이며 현재 상태를 보장하지 않음

문서에는 확인일과 근거를 남긴다. 비밀키, 개인정보, 비공개 원본 URL 및 운영 환경값은 기록하지 않는다.
