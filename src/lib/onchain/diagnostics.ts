// Pure builder for onchain (Base USDC) testnet wiring diagnostics.
// The route fetches on-chain values and feeds them here; this module stays
// network-free so it is unit-testable.

export type DiagnosticStatus = "pass" | "fail" | "warn" | "info";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: DiagnosticStatus;
  detail: string;
  expected?: string;
  actual?: string;
}

export interface OnchainDiagnosticsResult {
  checks: DiagnosticCheck[];
  summary: { pass: number; fail: number; warn: number; info: number; ok: boolean };
}

export interface OnchainDiagnosticConfigInput {
  enabled: boolean;
  chainId: number;
  escrowAddress: string;
  usdcAddress: string;
  treasuryAddress: string;
  operatorAddress: string;
  platformFeeBps: number;
  usdcPerKrw: number;
}

/** A single on-chain read outcome: either a value or an error string. */
export interface DiagnosticRead<T> {
  value: T | null;
  error: string | null;
}

export interface OnchainDiagnosticReads {
  rpcChainId: DiagnosticRead<number>;
  escrowBytecodePresent: DiagnosticRead<boolean>;
  escrowUsdc: DiagnosticRead<string>;
  escrowTreasury: DiagnosticRead<string>;
  escrowPlatformFeeBps: DiagnosticRead<number>;
  escrowOwner: DiagnosticRead<string>;
  operatorAllowed: DiagnosticRead<boolean>;
  usdcDecimals: DiagnosticRead<number>;
  usdcSymbol: DiagnosticRead<string>;
}

function addrEq(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

export function buildOnchainDiagnostics(
  config: OnchainDiagnosticConfigInput,
  reads: OnchainDiagnosticReads,
): OnchainDiagnosticsResult {
  const checks: DiagnosticCheck[] = [];

  // 0. Feature flag (informational — UI gate is intentionally not enforced)
  checks.push({
    id: "feature_flag",
    label: "NEXT_PUBLIC_ONCHAIN_ENABLED",
    status: config.enabled ? "info" : "warn",
    detail: config.enabled
      ? "온체인 플래그 true"
      : "플래그가 false입니다(현재 UI 게이트엔 미사용이라 동작엔 영향 없음).",
    actual: String(config.enabled),
  });

  // 1. RPC reachability + chain id
  if (reads.rpcChainId.error) {
    checks.push({ id: "network", label: "RPC 연결 / 네트워크", status: "fail", detail: `RPC 호출 실패: ${reads.rpcChainId.error}` });
  } else if (reads.rpcChainId.value !== config.chainId) {
    checks.push({
      id: "network",
      label: "RPC 연결 / 네트워크",
      status: "fail",
      detail: "RPC가 설정된 체인과 다른 네트워크에 연결됩니다.",
      expected: String(config.chainId),
      actual: String(reads.rpcChainId.value),
    });
  } else {
    checks.push({ id: "network", label: "RPC 연결 / 네트워크", status: "pass", detail: `chainId ${config.chainId} 연결 OK`, actual: String(config.chainId) });
  }

  // 2. Escrow address has contract bytecode
  if (reads.escrowBytecodePresent.error) {
    checks.push({ id: "escrow_contract", label: "Escrow 컨트랙트 존재", status: "fail", detail: `bytecode 조회 실패: ${reads.escrowBytecodePresent.error}` });
  } else if (reads.escrowBytecodePresent.value !== true) {
    checks.push({
      id: "escrow_contract",
      label: "Escrow 컨트랙트 존재",
      status: "fail",
      detail: "escrow 주소에 컨트랙트 코드가 없습니다(미배포이거나 주소 오류).",
      actual: config.escrowAddress,
    });
  } else {
    checks.push({ id: "escrow_contract", label: "Escrow 컨트랙트 존재", status: "pass", detail: "escrow 주소에 컨트랙트 배포 확인", actual: config.escrowAddress });
  }

  // 3. escrow.usdc() matches configured USDC address
  if (reads.escrowUsdc.error) {
    checks.push({ id: "escrow_usdc", label: "Escrow USDC 주소 일치", status: "fail", detail: `escrow.usdc() 조회 실패: ${reads.escrowUsdc.error}` });
  } else if (!addrEq(reads.escrowUsdc.value, config.usdcAddress)) {
    checks.push({
      id: "escrow_usdc",
      label: "Escrow USDC 주소 일치",
      status: "fail",
      detail: "escrow가 참조하는 USDC와 env의 USDC 주소가 다릅니다.",
      expected: config.usdcAddress,
      actual: reads.escrowUsdc.value ?? "-",
    });
  } else {
    checks.push({ id: "escrow_usdc", label: "Escrow USDC 주소 일치", status: "pass", detail: "escrow.usdc() == env USDC", actual: config.usdcAddress });
  }

  // 4. USDC token is a readable ERC20
  if (reads.usdcDecimals.error || reads.usdcSymbol.error) {
    checks.push({
      id: "usdc_token",
      label: "USDC 토큰 ERC20 read",
      status: "fail",
      detail: `USDC 주소에서 ERC20 read 실패: ${reads.usdcDecimals.error ?? reads.usdcSymbol.error}`,
      actual: config.usdcAddress,
    });
  } else if (reads.usdcDecimals.value !== 6) {
    checks.push({
      id: "usdc_token",
      label: "USDC 토큰 ERC20 read",
      status: "warn",
      detail: `${reads.usdcSymbol.value} decimals=${reads.usdcDecimals.value} — 표준 USDC(6)와 다릅니다. 금액 계산 확인 필요.`,
      expected: "6",
      actual: String(reads.usdcDecimals.value),
    });
  } else {
    checks.push({ id: "usdc_token", label: "USDC 토큰 ERC20 read", status: "pass", detail: `${reads.usdcSymbol.value} (decimals 6) 확인`, actual: `${reads.usdcSymbol.value}/6` });
  }

  // 5. Operator authorization (setOperator) — operator allowed OR operator is owner
  if (reads.operatorAllowed.error) {
    checks.push({ id: "operator", label: "Operator 권한", status: "fail", detail: `operators(operator) 조회 실패: ${reads.operatorAllowed.error}`, actual: config.operatorAddress });
  } else {
    const isOwner = addrEq(config.operatorAddress, reads.escrowOwner.value);
    if (reads.operatorAllowed.value === true || isOwner) {
      checks.push({
        id: "operator",
        label: "Operator 권한",
        status: "pass",
        detail: isOwner && reads.operatorAllowed.value !== true
          ? "operator 주소가 컨트랙트 owner라 권한 보유(setOperator 불필요)."
          : "operator 권한 승인됨(setOperator 적용).",
        actual: config.operatorAddress,
      });
    } else {
      checks.push({
        id: "operator",
        label: "Operator 권한",
        status: "fail",
        detail: "operator 미승인. owner 지갑으로 setOperator(operator, true)를 호출해야 등록(registerAsset)이 가능합니다.",
        actual: config.operatorAddress,
      });
    }
  }

  // 6. Treasury drift between env and contract (contract is authoritative)
  if (reads.escrowTreasury.error) {
    checks.push({ id: "treasury", label: "Treasury 주소 정합", status: "warn", detail: `escrow.treasury() 조회 실패: ${reads.escrowTreasury.error}` });
  } else if (!addrEq(reads.escrowTreasury.value, config.treasuryAddress)) {
    checks.push({
      id: "treasury",
      label: "Treasury 주소 정합",
      status: "warn",
      detail: "env treasury와 컨트랙트 treasury가 다릅니다(수수료는 컨트랙트 값으로 전송됨).",
      expected: config.treasuryAddress,
      actual: reads.escrowTreasury.value ?? "-",
    });
  } else {
    checks.push({ id: "treasury", label: "Treasury 주소 정합", status: "pass", detail: "env == contract treasury", actual: config.treasuryAddress });
  }

  // 7. Platform fee bps drift
  if (reads.escrowPlatformFeeBps.error) {
    checks.push({ id: "platform_fee", label: "Platform fee bps 정합", status: "warn", detail: `escrow.platformFeeBps() 조회 실패: ${reads.escrowPlatformFeeBps.error}` });
  } else if (reads.escrowPlatformFeeBps.value !== config.platformFeeBps) {
    checks.push({
      id: "platform_fee",
      label: "Platform fee bps 정합",
      status: "warn",
      detail: "env ONCHAIN_PLATFORM_FEE_BPS와 컨트랙트 값이 다릅니다(정산 분배는 컨트랙트 값 기준).",
      expected: String(config.platformFeeBps),
      actual: String(reads.escrowPlatformFeeBps.value),
    });
  } else {
    checks.push({ id: "platform_fee", label: "Platform fee bps 정합", status: "pass", detail: "env == contract platformFeeBps", actual: String(config.platformFeeBps) });
  }

  // 8. Owner (informational)
  checks.push({
    id: "owner",
    label: "Escrow owner",
    status: reads.escrowOwner.error ? "warn" : "info",
    detail: reads.escrowOwner.error ? `owner() 조회 실패: ${reads.escrowOwner.error}` : "컨트랙트 owner (setOperator/treasury 변경 권한)",
    actual: reads.escrowOwner.value ?? "-",
  });

  // 9. Quote (informational — static MVP rate)
  checks.push({
    id: "quote",
    label: "USDC/KRW 견적",
    status: "info",
    detail: "정적 env 견적(ONCHAIN_USDC_PER_KRW). live quote provider 미연동.",
    actual: String(config.usdcPerKrw),
  });

  const summary = {
    pass: checks.filter((c) => c.status === "pass").length,
    fail: checks.filter((c) => c.status === "fail").length,
    warn: checks.filter((c) => c.status === "warn").length,
    info: checks.filter((c) => c.status === "info").length,
    ok: checks.every((c) => c.status !== "fail"),
  };

  return { checks, summary };
}
