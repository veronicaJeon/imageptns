import { createHash } from "node:crypto";

export const CHECKOUT_TERMS_VERSION = "2026-08-05-v1";

export const CHECKOUT_CONSENT_TEXT_KO =
  "주문 내용, 라이선스 조건, 취소·환불 정책을 확인했으며 원본 다운로드 권한 제공이 시작된 디지털 콘텐츠는 관계 법령과 사전 고지·동의에 따라 청약철회가 제한될 수 있음에 동의합니다.";

export const CHECKOUT_CONSENT_TEXT_EN =
  "I have reviewed the order, license terms, and cancellation/refund policy, and understand that withdrawal may be restricted after original-file access begins where permitted by law and disclosed in advance.";

export function allowIncompleteDisclosureForBeta(value = process.env.ALLOW_INCOMPLETE_DISCLOSURE_BETA) {
  return value === "true";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  }
  return value;
}

export function checkoutRequestHash(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");
}

export function checkoutRequiresPublishedDisclosure(paymentProvider: string, totalKrw: number) {
  return (paymentProvider === "bank_transfer" || paymentProvider === "toss") && totalKrw > 0;
}
