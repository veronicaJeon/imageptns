# 온체인 운영 출시 남은 큰 과업

이 문서는 Base USDC 결제/증명/정산 기능을 실제 운영 수준으로 올리기 위한 남은 개발 배치와 병렬 에이전트 역할을 정리한다. 상세 리스크는 `docs/onchain-production-risk-register.md`, 실행 체크리스트는 `docs/onchain-production-readiness.md`를 기준으로 삼는다.

## 현재 병렬 진행 배치

### Agent A - 구매자 결제 회복 UX

- 담당 파일: `src/app/(dashboard)/dashboard/orders/page.tsx`
- 목표: 구매자 주문 내역에서 `base_usdc` pending 주문에 tx hash를 다시 입력하고 `/api/onchain/checkout/confirm`으로 재확인할 수 있게 한다.
- 완료 기준: 구매자가 checkout 화면을 떠난 뒤에도 주문 내역에서 직접 복구를 시도할 수 있고, 성공/실패 상태가 화면에 명확히 표시된다.

### Agent B - stale pending 운영 리포트

- 담당 파일: `src/app/api/cron/onchain-pending-report/route.ts`, 필요 시 `src/lib/security/cron.ts`
- 목표: 오래된 `base_usdc` pending 주문을 조회하는 report-only cron endpoint를 만든다.
- 완료 기준: 운영자가 자동 스케줄러나 수동 호출로 stale 주문 수, 대표 주문, 재확인 필요 상태를 확인할 수 있고 DB 상태는 변경하지 않는다.

### Agent C - 온체인 운영 이벤트 로그

- 담당 파일: `supabase/migrations/013_onchain_events.sql`, `src/lib/onchain/events.ts`, 온체인 관련 API route
- 목표: checkout prepare, checkout confirm, claim confirm, proof review 흐름에 best-effort 이벤트 로그를 남긴다.
- 완료 기준: 이벤트 기록 실패가 사용자 흐름을 막지 않고, 이후 관리자 분석/알림/감사 로그의 기반 데이터가 쌓인다.

## 완료된 추가 배치

- `checkout/confirm` rate limit과 반복 실패 backoff를 주문 단위로 추가했다.
- 주문별 static USDC/KRW quote snapshot과 15분 quote expiry를 추가했다.
- 관리자 온체인 화면에서 pending 주문 purchase tx hash를 직접 재확인할 수 있게 했다.
- 관리자 온체인 화면에서 DB `earnings_ledger`와 contract `claimable(address)`를 사진가별로 대조한다.

## 다음 개발 배치

### Batch 1 - 결제 신뢰성

- pending 주문 만료 정책을 확정하고, 자동 리포트에서 action-needed 상태를 분리한다.
- 동일 이미지/라이선스 중복 구매를 카트와 checkout 양쪽에서 막거나 명시적으로 경고한다.
- static `ONCHAIN_USDC_PER_KRW`를 live quote provider로 교체하고 provider 장애 시 fallback 정책을 적용한다.

### Batch 2 - 운영 대시보드 고도화

- 관리자 온체인 화면에 tx hash 기반 재확인 결과와 stale pending report 결과를 연결한다.
- RPC 상태, operator wallet 잔액, proof 실패율, claim 실패율을 운영 지표로 노출한다.
- proof failed/pending stuck 항목을 재시도 큐처럼 다룰 수 있게 상태와 실패 사유를 구조화한다.

### Batch 3 - 회계/정산 무결성

- 주문 완료, 다운로드 권한, onchain ledger 업데이트가 갈라졌을 때 복구하는 repair job을 만든다.
- claim 전 preflight check를 넣어 contract와 DB 상태 불일치를 사용자에게 명확히 안내한다.

### Batch 4 - 알림과 감사

- proof 실패, 결제 확인 실패, stale pending, claim 성공/실패 알림을 추가한다.
- 관리자 활동 로그와 onchain event feed를 결합해 운영 감사 로그로 조회 가능하게 한다.
- 운영용 CSV export 범위를 결제/정산/세금 처리 요구사항에 맞춰 확장한다.

### Batch 5 - 정책/법무/재무 연결

- crypto checkout VAT/세금 정책을 주문 모델에 반영한다.
- 환불/취소/분쟁 정책을 contract settlement 흐름과 맞춘다.
- 사진가 지갑 변경 정책을 확정하고, 기존 proof/claim 귀속을 사용자가 오해하지 않도록 잠금/검증 UX를 만든다.

## 테스트넷 의존 배치

- `ImagePartnersEscrow`를 Base Sepolia에 배포한다.
- Supabase migrations `010`, `011`, `012`, `013`, `014` 이후 신규 migration을 대상 프로젝트에 적용한다.
- photographer wallet, buyer wallet, treasury wallet로 실제 Base Sepolia 구매와 claim을 한 번씩 끝까지 실행한다.
- approval 중 proof registration 실패, checkout confirm 실패, pending 재확인, claim confirm 실패를 의도적으로 재현한다.
- 테스트 결과를 runbook에 기록하고 운영 전 차단 이슈를 P0/P1로 재분류한다.

## 메인넷 전 의사결정

- Base mainnet launch flag와 공개 일정을 정한다.
- production RPC provider, rate limit budget, fallback 정책을 정한다.
- operator key custody와 treasury custody를 정한다.
- live USDC/KRW quote source와 quote expiry 정책을 정한다.
- crypto checkout VAT/영수증/회계 export 정책을 확정한다.
- onchain license proof, failed transaction, refund, payout timing legal copy를 확정한다.
- mainnet 전 smart contract audit 또는 external review 범위를 정한다.

## 병렬 작업 원칙

- 각 에이전트는 담당 파일만 수정하고, 공유 API나 migration 번호가 필요하면 통합 단계에서 조정한다.
- 통합 전에는 `git diff --stat`, helper test, typecheck, targeted lint, full build를 순서대로 확인한다.
- docs는 에이전트 결과를 통합한 뒤 체크리스트 상태만 갱신한다.
