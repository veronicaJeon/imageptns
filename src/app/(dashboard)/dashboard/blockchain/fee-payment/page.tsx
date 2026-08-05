"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loadPaymentWidget, type PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";

interface FeeOrderItem {
  imageId: string;
  feeKrw: number;
  title: string | null;
  assetId: string | null;
}

interface FeeOrder {
  id: string;
  tossOrderId: string;
  unitFeeKrw: number;
  imageCount: number;
  amountKrw: number;
  status: string;
  billingName: string | null;
  billingEmail: string | null;
}

function formatKRW(value: number) {
  return "₩" + Number(value || 0).toLocaleString("ko-KR");
}

function FeePaymentContent() {
  const searchParams = useSearchParams();
  const feeOrderId = searchParams.get("order");

  const [order, setOrder] = useState<FeeOrder | null>(null);
  const [items, setItems] = useState<FeeOrderItem[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(feeOrderId));
  const [widgetReady, setWidgetReady] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);
  const shownError = error ?? (!feeOrderId ? "결제할 수수료 주문 정보가 없습니다." : null);

  useEffect(() => {
    if (!feeOrderId) return;
    let active = true;
    fetch(`/api/onchain/registration-fee/${feeOrderId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "수수료 주문을 불러오지 못했습니다.");
        return data as { order: FeeOrder; items: FeeOrderItem[] };
      })
      .then((data) => {
        if (!active) return;
        setOrder(data.order);
        setItems(data.items);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [feeOrderId]);

  useEffect(() => {
    if (!order || order.status !== "pending" || typeof window === "undefined") return;
    let mounted = true;
    loadPaymentWidget(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!, order.billingEmail || "@@ANONYMOUS")
      .then((widget) => {
        if (!mounted) return;
        widgetRef.current = widget;
        widget.renderPaymentMethods("#fee-toss-widget", { value: order.amountKrw }, { variantKey: "DEFAULT" });
        widget.renderAgreement("#fee-toss-agreement", { variantKey: "AGREEMENT" });
        setWidgetReady(true);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      mounted = false;
    };
  }, [order]);

  async function pay() {
    const widget = widgetRef.current;
    if (!widget || !order) return;
    setPaying(true);
    try {
      await widget.requestPayment({
        orderId: order.tossOrderId,
        orderName:
          order.imageCount === 1
            ? "Arweave 셀프등록 수수료"
            : `Arweave 셀프등록 수수료 외 ${order.imageCount - 1}건`,
        customerName: order.billingName || "Photographer",
        customerEmail: order.billingEmail || undefined,
        successUrl: `${window.location.origin}/api/onchain/registration-fee/confirm`,
        failUrl: `${window.location.origin}/dashboard/blockchain?fee=fail`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "결제를 시작하지 못했습니다.");
      setPaying(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <Link href="/dashboard/blockchain" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary">
          ← 블록체인 이미지
        </Link>
        <h1 className="mt-3 font-headline text-2xl font-extrabold tracking-tight text-on-surface">셀프등록 수수료 결제</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          판매 전 이미지를 Arweave에 등록 요청하려면 사진작가 부담 수수료 결제가 필요합니다. 결제 완료 후 관리자 검토를 거쳐 등록됩니다.
        </p>
      </div>

      {shownError && (
        <div className="mb-5 flex items-start gap-2 border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-base">error</span>
          {shownError}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : !order ? (
        <p className="text-sm text-outline">주문 정보를 찾을 수 없습니다.</p>
      ) : order.status !== "pending" ? (
        <div className="rounded border border-outline-variant bg-surface-container-lowest p-6 text-sm text-on-surface-variant">
          <p className="font-bold text-on-surface">
            {order.status === "paid"
              ? "이미 결제가 완료된 주문입니다."
              : order.status === "refunded"
                ? "환불된 주문입니다."
                : order.status === "canceled"
                  ? "취소된 주문입니다."
                  : "결제할 수 없는 주문 상태입니다."}
          </p>
          <Link href="/dashboard/blockchain" className="mt-3 inline-block font-bold text-primary hover:underline">
            블록체인 이미지로 돌아가기
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <div id="fee-toss-widget" className="min-h-[120px]" />
            <div id="fee-toss-agreement" className="mt-4" />
            {!widgetReady && (
              <div className="flex items-center justify-center gap-2 py-8 text-outline">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-outline border-t-transparent" />
                <span className="text-xs">결제 위젯 로딩 중...</span>
              </div>
            )}
            <button
              onClick={pay}
              disabled={!widgetReady || paying}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded bg-primary py-4 text-sm font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {paying ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span className="material-symbols-outlined text-base">lock</span>
              )}
              {formatKRW(order.amountKrw)} 결제하기
            </button>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest p-6 shadow-ghost">
              <h2 className="mb-5 font-headline font-bold text-on-surface">수수료 내역</h2>
              <div className="mb-5 flex max-h-64 flex-col gap-3 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.imageId} className="flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-on-surface">{item.title ?? "Untitled"}</p>
                      <p className="font-mono text-[10px] text-outline">{item.assetId ?? "-"}</p>
                    </div>
                    <p className="shrink-0 font-bold text-on-surface">{formatKRW(item.feeKrw)}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-outline-variant/20 pt-4 text-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>건당 수수료</span><span>{formatKRW(order.unitFeeKrw)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>대상 이미지</span><span>{order.imageCount}건</span>
                </div>
                <div className="flex justify-between border-t border-outline-variant/20 pt-2 text-base font-bold">
                  <span className="text-on-surface">합계</span>
                  <span className="text-primary">{formatKRW(order.amountKrw)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeePaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <FeePaymentContent />
    </Suspense>
  );
}
