export type TimelineState = "done" | "current" | "pending" | "failed";

export interface TimelineStep {
  key: string;
  label: string;
  description: string;
  state: TimelineState;
}

interface OrderStatusInput {
  status: string;
  paymentProvider?: string | null;
  cryptoStatus?: string | null;
  paymentTxHash?: string | null;
}

interface UploadProofInput {
  status: string;
  proofStatus?: string | null;
}

export function buildOrderStatusSteps(order: OrderStatusInput): TimelineStep[] {
  const isOnchain = order.paymentProvider === "base_usdc";
  const paymentDone = order.status === "completed" || Boolean(order.paymentTxHash) || order.cryptoStatus === "confirmed";
  const paymentFailed = order.status === "failed" || order.cryptoStatus === "failed";
  const confirmationDone = !isOnchain || order.cryptoStatus === "confirmed" || order.status === "completed";

  return [
    {
      key: "created",
      label: "주문 생성",
      description: "주문과 라이선스 항목이 저장되었습니다.",
      state: "done",
    },
    {
      key: "payment",
      label: isOnchain ? "지갑 결제" : "결제 승인",
      description: isOnchain ? "구매자 지갑에서 결제 트랜잭션을 전송합니다." : "카드/간편결제 승인을 확인합니다.",
      state: paymentFailed ? "failed" : paymentDone ? "done" : "current",
    },
    {
      key: "confirmation",
      label: isOnchain ? "온체인 확인" : "구매 확정",
      description: isOnchain ? "트랜잭션과 주문 금액을 대조해 구매를 확정합니다." : "결제 완료 후 다운로드 권한을 발급합니다.",
      state: paymentFailed ? "failed" : confirmationDone ? "done" : paymentDone || isOnchain ? "current" : "pending",
    },
    {
      key: "download",
      label: "다운로드 가능",
      description: "구매한 원본 파일을 다운로드할 수 있습니다.",
      state: order.status === "completed" ? "done" : paymentFailed ? "failed" : "pending",
    },
  ];
}

export function buildUploadProofSteps(upload: UploadProofInput): TimelineStep[] {
  const approved = upload.status === "approved";
  const rejected = upload.status === "rejected";
  const proofRegistered = upload.proofStatus === "registered";
  const proofFailed = upload.proofStatus === "failed";
  const proofActive =
    upload.proofStatus === "available" ||
    upload.proofStatus === "requested" ||
    upload.proofStatus === "pending";

  return [
    {
      key: "upload",
      label: "업로드",
      description: "원본과 프리뷰 파일이 플랫폼에 저장되었습니다.",
      state: "done",
    },
    {
      key: "review",
      label: "관리자 심사",
      description: "품질, 권리, 메타데이터를 검토합니다.",
      state: rejected ? "failed" : approved ? "done" : "current",
    },
    {
      key: "proof",
      label: "Arweave 자격증명",
      description: "첫 판매 이후 또는 사진작가 셀프 등록 요청으로 관리자 일괄 등록을 거쳐 원본과 해시를 Arweave에 기록합니다.",
      state: proofRegistered ? "done" : proofFailed ? "failed" : proofActive ? "current" : approved ? "pending" : "pending",
    },
  ];
}
