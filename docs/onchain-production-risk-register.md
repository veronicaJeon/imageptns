# 온체인 결제 운영 리스크 및 추가 개발 대상

이 문서는 현재 구현된 Base USDC 결제/증명/정산 기능을 실제 운영에 적용할 때 문제가 될 수 있는 지점을 정리한다. 항목은 코드 기준으로 확인된 리스크와 운영 전에 필요한 추가 개발 대상으로 구성한다.

## P0 - Mainnet 전에 반드시 닫을 항목

1. **정적 USDC/KRW 환율**
   - 현재 `ONCHAIN_USDC_PER_KRW` 환경값으로 KRW 가격을 USDC로 고정 환산한다.
   - 주문별 quote snapshot과 15분 quote expiry는 추가되어, 주문 생성 후 금액 근거는 추적 가능하다.
   - 가격 변동이 큰 구간에서는 구매자 과소/과대 결제와 정산 불일치가 발생할 수 있다.
   - 추가 개발: 실시간 quote provider, 관리자 quote 상태 모니터링.

2. **VAT/세금 처리 미완성**
   - Base USDC 결제는 현재 `vat = 0`으로 두고 license proceeds만 escrow에 넣는다.
   - 국내 운영에서 세금계산/영수증/부가세 정책과 충돌할 수 있다.
   - 추가 개발: crypto checkout 세금 정책 확정, 세금 분리 수취 또는 별도 결제, 영수증/회계 export.

3. **컨트랙트 감사 및 배포 권한 관리**
   - escrow contract는 로컬 테스트를 통과했지만 외부 감사/메인넷 검증 전이다.
   - operator private key가 서버 환경변수 hot key로 사용된다.
   - 추가 개발: audit, owner/operator multisig, key rotation, 배포 주소 검증, contract verification.

4. **결제 확인 endpoint 남용 방지**
   - `/api/onchain/checkout/confirm`은 구매자 세션 또는 주문별 confirmation token을 요구하도록 보강했다.
   - 주문 단위 confirmation attempt/backoff가 추가되어 반복 실패 호출은 429로 지연된다.
   - 추가 개발: IP/user 단위 rate limit, request logging.

5. **stale pending order 재처리**
   - 구매자가 order prepare 후 지갑 승인/구매/confirm 중 이탈하면 `base_usdc` pending order가 남는다.
   - 구매자 주문 내역과 관리자 온체인 화면에서 tx hash 재확인을 지원한다.
   - 추가 개발: pending order 만료 cron/action-needed 상태 전환.

6. **proof 등록 실패 복구**
   - admin approval 중 operator/RPC 문제가 생기면 `proof_status = failed`가 된다.
   - 현재 재시도는 승인 버튼을 다시 누르는 방식에 가깝고, 실패 원인/재시도 큐가 약하다.
   - 추가 개발: 실패 proof 전용 retry action, 실패 사유 저장, stuck `pending` watchdog.

## P1 - 운영 안정화에 필요한 항목

1. **onchain/offchain 회계 대조**
   - DB의 `earnings_ledger.claimable_amount`와 contract `claimable(address)`가 다를 수 있다.
   - 관리자 온체인 화면에서 photographer별 DB/contract 차이를 표시한다.
   - 추가 개발: claim 전 preflight check, scheduled reconciliation alert.

2. **refund/cancel 정책**
   - contract purchase는 완료되면 photographer claimable과 treasury fee가 즉시 할당된다.
   - 환불, 취소, 저작권 분쟁 대응 경로가 없다.
   - 추가 개발: refund policy, admin refund ledger, claim 전 hold period 또는 dispute window.

3. **다운로드 entitlement와 결제 완료의 원자성**
   - order completed trigger가 downloads/earnings를 생성하고, 서버가 이후 ledger를 onchain claimable로 업데이트한다.
   - 중간 실패 시 주문 완료와 onchain ledger 상태가 갈라질 수 있다.
   - 추가 개발: idempotent repair job, failed ledger update alert, order completion transaction boundary 재검토.

4. **사진가 지갑 변경 정책**
   - proof 등록은 approval 시점의 photographer wallet으로 올라간다.
   - 이후 프로필 지갑 변경 시 기존 proof/claim 귀속과 사용자가 기대하는 수령 지갑이 달라질 수 있다.
   - 추가 개발: wallet lock/verification, 변경 이력, 기존 asset wallet 변경 불가 안내.

5. **중복 카트/중복 구매 UX**
   - 같은 이미지/라이선스가 여러 번 들어가면 구매 금액과 contract calldata도 중복된다.
   - 추가 개발: cart dedupe, 이미 구매한 asset/license 경고, 중복 구매 정책.

6. **RPC 장애 및 지갑 UX**
   - frontend와 server 모두 RPC에 의존한다.
   - 추가 개발: RPC fallback, user-visible retry state, admin RPC health indicator.

## P2 - 확장 전에 정리할 항목

1. **토큰/체인 확장 경계**
   - DB는 provider/token/chain 필드를 갖지만 UI는 Base USDC 전용이다.
   - 추가 개발: provider registry, token metadata table, per-chain explorer/decimals config.

2. **운영 감사 로그**
   - admin approval, proof registration, payout action, claim confirmation의 actor/action 로그가 부족하다.
   - 추가 개발: audit_log table, admin activity feed, export.

3. **알림/메일**
   - onchain proof failure, pending confirmation, claimable USDC, claim success에 대한 사용자 알림이 없다.
   - 추가 개발: notification jobs, email templates, dashboard notification center.

4. **테스트 커버리지**
   - contract tests는 있으나 Next API는 통합 테스트가 부족하다.
   - 추가 개발: API route tests with mocked viem/Supabase, Base checkout E2E smoke, claim confirmation regression tests.

## 이번 라운드에서 반영한 화면 요구

- Buyer dashboard: Base USDC 주문 상태와 최근 온체인 주문을 확인한다.
- Photographer dashboard: proof 등록 상태, wallet 준비 상태, claimable USDC를 확인한다.
- Admin dashboard: proof/payment/claim 운영 지표와 즉시 확인해야 할 주의 항목을 확인한다.
