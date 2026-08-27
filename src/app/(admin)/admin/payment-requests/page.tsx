"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AdminButton,
  AdminChip,
  adminStatusTone,
} from "@/components/admin/AdminPrimitives";
import { cn } from "@/lib/utils/cn";

interface PaymentRequest {
  id: string;
  order_number: string;
  billing_name: string | null;
  billing_email: string | null;
  billing_company: string | null;
  subtotal_krw: number;
  vat_krw: number;
  total_krw: number;
  status: string;
  offline_payment_status: string;
  created_at: string;
  completed_at: string | null;
  offline_payment_requested_at: string | null;
  offline_payment_reviewed_at: string | null;
  buyer: { id: string; full_name: string | null; avatar_url: string | null } | null;
  order_items: {
    id: string;
    license_code: string;
    price_krw: number;
    image: { id: string; title: string | null; asset_id: string | null; storage_path_preview: string | null } | null;
  }[];
  order_email_outbox: {
    event_type: string;
    status: "pending" | "sending" | "sent" | "failed";
    attempt_count: number;
    last_error: string | null;
    sent_at: string | null;
    updated_at: string;
  }[];
}

function formatKRW(value: number) {
  return `₩${value.toLocaleString("ko-KR")}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_LABELS: Record<string, string> = {
  requested: "입금확인 대기",
  approved: "승인됨",
  canceled: "취소됨",
  not_applicable: "-",
};

type RequestTab = "pending" | "processed" | "all";

function isPendingRequest(request: PaymentRequest) {
  return request.status === "pending" && request.offline_payment_status === "requested";
}

function isOverdueRequest(request: PaymentRequest) {
  const requestedAt = request.offline_payment_requested_at ?? request.created_at;
  return isPendingRequest(request) && Date.now() - new Date(requestedAt).getTime() >= 24 * 60 * 60 * 1000;
}

export default function AdminPaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [tab, setTab] = useState<RequestTab>("pending");

  const pendingCount = useMemo(() => requests.filter(isPendingRequest).length, [requests]);
  const processedCount = requests.length - pendingCount;
  const visibleRequests = useMemo(() => requests.filter((request) => (
    tab === "all" || (tab === "pending" ? isPendingRequest(request) : !isPendingRequest(request))
  )), [requests, tab]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/payment-requests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "결제요청 목록을 불러오지 못했습니다.");
      setRequests(data.requests ?? []);
    } catch (error) {
      alert(error instanceof Error ? error.message : "결제요청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  async function handleAction(orderId: string, action: "approve" | "cancel" | "resend") {
    if (action === "resend") {
      if (!confirm("전송되지 않은 주문 이메일을 다시 보낼까요?")) return;
      setProcessingId(orderId);
      try {
        const res = await fetch("/api/admin/payment-requests", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, action }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "이메일 재전송에 실패했습니다.");
        await loadRequests();
      } catch (error) {
        alert(error instanceof Error ? error.message : "이메일 재전송에 실패했습니다.");
      } finally {
        setProcessingId(null);
      }
      return;
    }
    const note = action === "approve"
      ? prompt("승인 메모를 입력하세요.", "입금 확인")
      : prompt("취소 사유를 입력하세요.", "오요청 또는 입금 미확인");
    if (note === null) return;
    if (!confirm(action === "approve" ? "입금 확인 후 주문을 확정할까요?" : "이 계좌이체 요청을 취소할까요?")) return;

    setProcessingId(orderId);
    try {
      const res = await fetch("/api/admin/payment-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, note }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "요청 처리에 실패했습니다.");
      await loadRequests();
    } catch (error) {
      alert(error instanceof Error ? error.message : "요청 처리에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] p-4 md:p-8 lg:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">입금 확인 요청</h1>
        <p className="mt-1 text-sm text-outline">구매자의 계좌이체 요청을 확인하고 실제 입금 확인 후 주문 확정 또는 취소 처리합니다.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-surface-container-lowest p-1 shadow-ghost sm:w-fit">
        {([
          { key: "pending", label: `확인 대기 ${pendingCount}` },
          { key: "processed", label: `처리 완료 ${processedCount}` },
          { key: "all", label: `전체 ${requests.length}` },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:px-4",
              tab === key ? "bg-primary text-white" : "text-on-surface-variant hover:bg-surface-container-high",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : visibleRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-outline">
          <span className="material-symbols-outlined text-5xl">{tab === "pending" ? "check_circle" : "receipt_long"}</span>
          <p>{tab === "pending" ? "입금 확인 대기 요청이 없습니다." : "해당 요청이 없습니다."}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {visibleRequests.map((request) => {
            const pending = isPendingRequest(request);
            const overdue = isOverdueRequest(request);
            const failedEmails = request.order_email_outbox?.filter((email) => email.status === "failed") ?? [];
            const pendingEmails = request.order_email_outbox?.filter((email) => email.status === "pending" || email.status === "sending") ?? [];
            return (
              <article
                key={request.id}
                className={cn(
                  "rounded-lg border bg-surface-container-lowest p-5 shadow-ghost",
                  overdue ? "border-error/50" : "border-outline-variant/30",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-headline text-lg font-extrabold text-on-surface">{request.order_number}</p>
                      <AdminChip tone={adminStatusTone(request.offline_payment_status)}>
                        {STATUS_LABELS[request.offline_payment_status] ?? request.offline_payment_status}
                      </AdminChip>
                      {overdue && <AdminChip tone="danger">24시간 초과</AdminChip>}
                    </div>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {request.billing_name || request.buyer?.full_name || "이름 없음"} · {request.billing_email || "이메일 없음"}
                      {request.billing_company ? ` · ${request.billing_company}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-outline">요청일 {formatDate(request.offline_payment_requested_at ?? request.created_at)}</p>
                    {failedEmails.length > 0 ? (
                      <p className="mt-2 text-xs font-bold text-red-600">주문 이메일 전송 실패 {failedEmails.length}건</p>
                    ) : pendingEmails.length > 0 ? (
                      <p className="mt-2 text-xs font-bold text-amber-600">주문 이메일 전송 대기 {pendingEmails.length}건</p>
                    ) : request.order_email_outbox?.length > 0 ? (
                      <p className="mt-2 text-xs font-bold text-green-700">주문 이메일 전송 완료</p>
                    ) : null}
                  </div>
                  <div className="text-left lg:text-right">
                    <p className="text-xs font-bold uppercase tracking-widest text-outline">입금 요청 금액</p>
                    <p className="mt-1 text-2xl font-black text-primary">{formatKRW(request.total_krw)}</p>
                    <p className="mt-1 text-xs text-outline">소계 {formatKRW(request.subtotal_krw)} · VAT {formatKRW(request.vat_krw)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {request.order_items.map((item) => (
                    <div key={item.id} className="flex gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-3">
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-surface-container-high">
                        {item.image?.storage_path_preview ? (
                          <Image src={item.image.storage_path_preview} alt={item.image.title ?? ""} width={120} height={80} className="h-full w-full object-cover" unoptimized />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="material-symbols-outlined text-outline">image</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-on-surface">{item.image?.title ?? "이미지"}</p>
                        <p className="mt-0.5 text-xs text-outline">{item.image?.asset_id ?? item.image?.id}</p>
                        <p className="mt-1 text-xs text-on-surface-variant">{item.license_code} · {formatKRW(item.price_krw)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  {(failedEmails.length > 0 || pendingEmails.length > 0) && (
                    <AdminButton
                      type="button"
                      onClick={() => handleAction(request.id, "resend")}
                      disabled={processingId === request.id}
                      variant="secondary"
                      size="md"
                    >
                      이메일 재전송
                    </AdminButton>
                  )}
                  {pending ? (
                    <>
                      <AdminButton
                        type="button"
                        onClick={() => handleAction(request.id, "cancel")}
                        disabled={processingId === request.id}
                        variant="danger"
                        size="md"
                      >
                        취소
                      </AdminButton>
                      <AdminButton
                        type="button"
                        onClick={() => handleAction(request.id, "approve")}
                        disabled={processingId === request.id}
                        variant="primary"
                        size="md"
                      >
                        주문 확정
                      </AdminButton>
                    </>
                  ) : (
                    <p className="text-xs text-outline">처리일 {formatDate(request.offline_payment_reviewed_at ?? request.completed_at)}</p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
