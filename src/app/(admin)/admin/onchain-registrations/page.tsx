"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AdminButton, AdminChip, AdminInlineMetrics, AdminListSurface } from "@/components/admin/AdminPrimitives";
import { canAdminRegisterImage } from "@/lib/onchain/registration";
import { buildRegistrationFeeReceiptHtml } from "@/lib/receipts/registration-fee";

type RegistrationFilter = "requested" | "pending" | "registered" | "failed" | "available" | "all";

interface AdminRegistrationImage {
  id: string;
  asset_id: string | null;
  title: string;
  category: string | null;
  sales_count: number | null;
  status: string;
  storage_path_preview: string | null;
  file_format: string | null;
  file_size_mb: number | null;
  copyright_license: string | null;
  free_usage_policy: string | null;
  authorship_declaration: "ai_generated" | "human_original" | null;
  proof_status: string | null;
  proof_requested_at: string | null;
  proof_registered_at: string | null;
  proof_arweave_original_tx_id: string | null;
  proof_arweave_metadata_tx_id: string | null;
  proof_arweave_manifest_tx_id: string | null;
  proof_arweave_confirmed_at: string | null;
  proof_failure_reason: string | null;
  proof_request_fee_payer: string | null;
  proof_request_kind: string | null;
  proof_request_fee_krw: number | null;
  proof_request_payment_status: string | null;
  photographer:
    | { id: string; full_name: string | null; wallet_address: string | null }
    | { id: string; full_name: string | null; wallet_address: string | null }[]
    | null;
}

interface FeeOrderItem {
  imageId: string;
  feeKrw: number;
  title: string | null;
  assetId: string | null;
}

interface FeeOrder {
  id: string;
  photographerId: string;
  photographerName: string | null;
  tossOrderId: string;
  paymentKey: string | null;
  unitFeeKrw: number;
  imageCount: number;
  amountKrw: number;
  status: string;
  billingName: string | null;
  billingEmail: string | null;
  createdAt: string;
  paidAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  cancelReason: string | null;
  items: FeeOrderItem[];
}

interface RegistrationBatch {
  id: string;
  status: string;
  image_count: number;
  total_bytes: number;
  arweave_manifest_tx_id: string | null;
  arweave_confirmed_at: string | null;
  graph_verified_at: string | null;
  error_message: string | null;
  created_at: string;
}

const FILTERS: { key: RegistrationFilter; label: string }[] = [
  { key: "requested", label: "요청됨" },
  { key: "pending", label: "등록 중" },
  { key: "failed", label: "실패" },
  { key: "available", label: "등록가능" },
  { key: "registered", label: "완료" },
  { key: "all", label: "전체" },
];

const STATUS_LABELS: Record<string, string> = {
  available: "등록가능",
  requested: "요청됨",
  pending: "Arweave 등록 중",
  registered: "등록완료",
  failed: "실패",
  not_registered: "증명 전",
};

const STATUS_STYLES: Record<string, string> = {
  available: "border-primary/20 bg-primary/10 text-primary",
  requested: "border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-900/20 dark:text-blue-200",
  pending: "border-amber-200/70 bg-amber-50 text-amber-600 dark:border-amber-400/20 dark:bg-amber-900/20 dark:text-amber-200",
  registered: "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200",
  failed: "border-error/20 bg-error/10 text-error",
  not_registered: "border-outline-variant/60 bg-surface-container-low text-outline",
};

const CHIP_CLASS = "inline-flex h-6 items-center rounded-full border px-2.5 text-[10px] font-bold leading-none";

function firstPhotographer(image: AdminRegistrationImage) {
  return Array.isArray(image.photographer) ? image.photographer[0] : image.photographer;
}

function arweaveUrl(txId: string) {
  return `https://arweave.net/${txId}`;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB`;
}

const PAYMENT_LABELS: Record<string, string> = {
  none: "수수료 없음",
  pending: "수수료 결제대기",
  paid: "수수료 결제완료",
  refunded: "수수료 환불",
};

const FEE_STATUS_LABELS: Record<string, string> = {
  pending: "결제대기",
  paid: "결제완료",
  failed: "결제실패",
  canceled: "취소",
  refunded: "환불",
};

function canRegister(image: AdminRegistrationImage) {
  return canAdminRegisterImage({
    proofStatus: image.proof_status,
    proofRequestKind: image.proof_request_kind,
    proofRequestPaymentStatus: image.proof_request_payment_status,
  });
}

function canVerify(image: AdminRegistrationImage) {
  return Boolean(
    image.proof_arweave_original_tx_id ||
    image.proof_arweave_metadata_tx_id ||
    image.proof_arweave_manifest_tx_id,
  );
}

export default function AdminOnchainRegistrationsPage() {
  const [filter, setFilter] = useState<RegistrationFilter>("requested");
  const [images, setImages] = useState<AdminRegistrationImage[]>([]);
  const [batches, setBatches] = useState<RegistrationBatch[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<"register" | "verify" | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feeOrders, setFeeOrders] = useState<FeeOrder[]>([]);
  const [feeActioning, setFeeActioning] = useState<string | null>(null);

  const fetchRows = useCallback(async (nextFilter: RegistrationFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/onchain-registrations?status=${nextFilter}`);
      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "목록을 불러오지 못했습니다.");
      setImages(data.images ?? []);
      setBatches(data.batches ?? []);
      setSelected((prev) => prev.filter((id) => (data.images ?? []).some((image: AdminRegistrationImage) => image.id === id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFeeOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/registration-fees");
      if (!res.ok) return;
      const data = await res.json();
      setFeeOrders(data.orders ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    fetchRows(filter);
  }, [filter, fetchRows]);

  useEffect(() => {
    fetchFeeOrders();
  }, [fetchFeeOrders]);

  async function feeAction(feeOrderId: string, action: "cancel" | "refund") {
    const label = action === "cancel" ? "취소" : "환불";
    if (!window.confirm(`이 수수료 주문을 ${label}하시겠습니까?`)) return;
    setFeeActioning(feeOrderId);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/registration-fees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, feeOrderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `${label}에 실패했습니다.`);
      setMessage(`수수료 주문을 ${label} 처리했습니다.`);
      await Promise.all([fetchFeeOrders(), fetchRows(filter)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setFeeActioning(null);
    }
  }

  function printFeeReceipt(order: FeeOrder) {
    const html = buildRegistrationFeeReceiptHtml({
      orderNumber: order.tossOrderId,
      paidAt: order.paidAt,
      billingName: order.billingName,
      billingEmail: order.billingEmail,
      paymentProvider: "toss",
      paymentKey: order.paymentKey,
      unitFeeKrw: order.unitFeeKrw,
      imageCount: order.imageCount,
      amountKrw: order.amountKrw,
      items: order.items.map((item) => ({ title: item.title ?? "", assetId: item.assetId ?? "", feeKrw: item.feeKrw })),
    });
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const selectedImages = useMemo(
    () => images.filter((image) => selected.includes(image.id)),
    [images, selected],
  );
  const selectedTotalMb = selectedImages.reduce((sum, image) => sum + (Number(image.file_size_mb) || 0), 0);
  const selectedTotalBytes = Math.round(selectedTotalMb * 1024 * 1024);
  const registerableIds = images.filter(canRegister).map((image) => image.id);
  const allRegisterableChecked = registerableIds.length > 0 && registerableIds.every((id) => selected.includes(id));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleRegisterable() {
    setSelected(allRegisterableChecked ? [] : registerableIds);
  }

  async function runAction(action: "register" | "verify") {
    if (selected.length === 0) return;
    setActioning(action);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/onchain-registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, imageIds: selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "처리에 실패했습니다.");

      if (action === "register") {
        const confirmedCount = (data.results ?? []).filter((result: { confirmed?: boolean }) => result.confirmed).length;
        setMessage(`Arweave 업로드 완료. batch ${data.batchId} / GraphQL 확인 ${confirmedCount}개`);
      } else {
        const confirmedCount = (data.results ?? []).filter((result: { confirmed?: boolean }) => result.confirmed).length;
        setMessage(`GraphQL 검증 완료. 컨펌 ${confirmedCount}개`);
      }
      await fetchRows(filter);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActioning(null);
    }
  }

  if (forbidden) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-10 text-outline">
        <span className="material-symbols-outlined text-6xl text-error">lock</span>
        <p className="font-headline text-xl font-extrabold text-on-surface">접근 권한이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface">온체인 등록 이미지</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          사진작가가 요청한 판매 완료 또는 셀프 등록 이미지를 Arweave에 일괄 등록하고 GraphQL 컨펌 결과를 기록합니다.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 border-b border-outline-variant/20">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              setFilter(item.key);
              setSelected([]);
              setMessage(null);
            }}
            className={`-mb-px border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
              filter === item.key
                ? "border-primary text-primary"
                : "border-transparent text-outline hover:text-on-surface"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <AdminListSurface className="mb-5 flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <AdminInlineMetrics
          items={[
            { label: "선택", value: `${selected.length}개` },
            { label: "총 용량", value: `${selectedTotalMb.toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB` },
            { label: "총 바이트", value: selectedTotalBytes.toLocaleString("ko-KR") },
          ]}
        />
        <div className="flex flex-wrap gap-2">
          <AdminButton
            onClick={() => runAction("verify")}
            disabled={selected.length === 0 || actioning !== null || !selectedImages.some(canVerify)}
            variant="secondary"
            size="md"
          >
            {actioning === "verify" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <span className="material-symbols-outlined text-base">fact_check</span>}
            GraphQL 검증
          </AdminButton>
          <AdminButton
            onClick={() => runAction("register")}
            disabled={selected.length === 0 || actioning !== null || !selectedImages.every(canRegister)}
            variant="primary"
            size="md"
          >
            {actioning === "register" ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <span className="material-symbols-outlined text-base">upload</span>}
            Arweave 일괄 등록
          </AdminButton>
        </div>
      </AdminListSurface>

      {message && (
        <div className="mb-5 flex items-start gap-2 border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-primary">
          <span className="material-symbols-outlined text-base">verified</span>
          {message}
        </div>
      )}
      {error && (
        <div className="mb-5 flex items-start gap-2 border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
          <span className="material-symbols-outlined text-base">error</span>
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[36vh] items-center justify-center">
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : images.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-outline">
          <span className="material-symbols-outlined text-5xl">verified</span>
          <p className="text-sm">현재 조건에 맞는 등록 이미지가 없습니다.</p>
        </div>
      ) : (
        <AdminListSurface className="mb-10 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="px-5 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={allRegisterableChecked}
                    onChange={toggleRegisterable}
                    disabled={registerableIds.length === 0}
                    aria-label="등록 가능 전체 선택"
                  />
                </th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">이미지</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">사진작가</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">상태</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">판매/용량</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">TxID</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">요청/확인</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {images.map((image) => {
                const status = image.proof_status ?? "not_registered";
                const photographer = firstPhotographer(image);
                return (
                  <tr key={image.id} className="hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(image.id)}
                        onChange={() => toggle(image.id)}
                        aria-label={`${image.title} 선택`}
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-low">
                          {image.storage_path_preview ? (
                            <Image src={image.storage_path_preview} alt={image.title} width={64} height={48} className="h-full w-full object-cover" />
                          ) : (
                            <span className="material-symbols-outlined text-outline">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-[220px] truncate font-semibold text-on-surface">{image.title}</p>
                          <p className="mt-0.5 font-mono text-[11px] text-outline">{image.asset_id ?? "-"}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <AdminChip tone="neutral">
                              {image.authorship_declaration === "ai_generated" ? "AI 이미지" : "오리지널 보증"}
                            </AdminChip>
                            {image.file_format && (
                              <AdminChip tone="neutral">
                                {image.file_format}
                              </AdminChip>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-on-surface">{photographer?.full_name ?? "-"}</p>
                      <p className="mt-0.5 max-w-[170px] truncate font-mono text-[10px] text-outline">{photographer?.wallet_address ?? "지갑 없음"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`${CHIP_CLASS} ${STATUS_STYLES[status] ?? "border-outline-variant/60 bg-surface-container-low text-outline"}`}>
                        {STATUS_LABELS[status] ?? status}
                      </span>
                      {image.proof_failure_reason && (
                        <p className="mt-1 max-w-[220px] text-[10px] text-error line-clamp-2">{image.proof_failure_reason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">
                      <AdminInlineMetrics
                        items={[
                          { label: "판매", value: `${image.sales_count ?? 0}건` },
                          { label: "용량", value: `${(image.file_size_mb ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} MB` },
                        ]}
                      />
                      {image.proof_request_kind === "self_funded" && (
                        <div className="mt-1 flex flex-col gap-1">
                          <AdminChip tone="neutral" className="w-fit">
                            사진작가 부담 ₩{(image.proof_request_fee_krw ?? 0).toLocaleString("ko-KR")}
                          </AdminChip>
                          <span
                            className={`${CHIP_CLASS} w-fit ${
                              image.proof_request_payment_status === "paid"
                                ? "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200"
                                : image.proof_request_payment_status === "pending"
                                  ? "border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-900/20 dark:text-orange-200"
                                  : "border-outline-variant/60 bg-surface-container-low text-outline"
                            }`}
                          >
                            {PAYMENT_LABELS[image.proof_request_payment_status ?? "none"] ?? image.proof_request_payment_status}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {image.proof_arweave_original_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_original_tx_id)} target="_blank" rel="noreferrer" className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}>
                            원본
                          </a>
                        )}
                        {image.proof_arweave_metadata_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_metadata_tx_id)} target="_blank" rel="noreferrer" className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}>
                            메타데이터
                          </a>
                        )}
                        {image.proof_arweave_manifest_tx_id && (
                          <a href={arweaveUrl(image.proof_arweave_manifest_tx_id)} target="_blank" rel="noreferrer" className={`${CHIP_CLASS} border-primary/20 bg-primary/10 text-primary hover:border-primary/40`}>
                            매니페스트
                          </a>
                        )}
                        {!canVerify(image) && <span className="text-xs text-outline">-</span>}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">
                      <p>{formatDate(image.proof_requested_at)}</p>
                      <p className="text-outline">{formatDate(image.proof_arweave_confirmed_at ?? image.proof_registered_at)}</p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminListSurface>
      )}

      <div>
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-outline">최근 등록 배치</p>
        <AdminListSurface className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">Batch</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">상태</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">수량/용량</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">Manifest</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">검증</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-outline">등록 배치가 없습니다.</td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-surface-container-low">
                    <td className="px-5 py-4 font-mono text-xs text-on-surface">{batch.id}</td>
                    <td className="px-5 py-4">
                      <span className={`${CHIP_CLASS} ${STATUS_STYLES[batch.status] ?? "border-outline-variant/60 bg-surface-container-low text-outline"}`}>
                        {batch.status}
                      </span>
                      {batch.error_message && <p className="mt-1 max-w-[260px] text-[10px] text-error line-clamp-2">{batch.error_message}</p>}
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{batch.image_count}개 / {formatBytes(batch.total_bytes)}</td>
                    <td className="px-5 py-4">
                      {batch.arweave_manifest_tx_id ? (
                        <a href={arweaveUrl(batch.arweave_manifest_tx_id)} target="_blank" rel="noreferrer" className="font-mono text-xs text-primary hover:opacity-70">
                          {batch.arweave_manifest_tx_id}
                        </a>
                      ) : (
                        <span className="text-outline">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">
                      <p>GraphQL {formatDate(batch.graph_verified_at)}</p>
                      <p className="text-outline">Confirmed {formatDate(batch.arweave_confirmed_at)}</p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminListSurface>
      </div>

      <div className="mt-10">
        <p className="mb-4 text-xs font-bold uppercase tracking-widest text-outline">사진작가 부담 셀프등록 수수료</p>
        <AdminListSurface className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">사진작가</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">금액</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">이미지</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">상태</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">결제일</th>
                <th className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {feeOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-outline">수수료 결제 내역이 없습니다.</td>
                </tr>
              ) : (
                feeOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-surface-container-low">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-on-surface">{order.photographerName ?? "-"}</p>
                      <p className="text-[10px] text-outline">{order.billingEmail ?? "-"}</p>
                    </td>
                    <td className="px-5 py-4 text-on-surface">
                      <p className="font-bold">₩{order.amountKrw.toLocaleString("ko-KR")}</p>
                      <p className="text-[10px] text-outline">건당 ₩{order.unitFeeKrw.toLocaleString("ko-KR")}</p>
                    </td>
                    <td className="px-5 py-4 text-on-surface-variant">{order.imageCount}건</td>
                    <td className="px-5 py-4">
                      <span
                        className={`${CHIP_CLASS} ${
                          order.status === "paid"
                            ? "border-emerald-200/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-900/20 dark:text-emerald-200"
                            : order.status === "pending"
                              ? "border-orange-200/70 bg-orange-50 text-orange-700 dark:border-orange-400/20 dark:bg-orange-900/20 dark:text-orange-200"
                              : order.status === "refunded"
                                ? "border-blue-200/70 bg-blue-50 text-blue-600 dark:border-blue-400/20 dark:bg-blue-900/20 dark:text-blue-200"
                                : "border-outline-variant/60 bg-surface-container-low text-outline"
                        }`}
                      >
                        {FEE_STATUS_LABELS[order.status] ?? order.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-on-surface-variant">{formatDate(order.paidAt ?? order.createdAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {order.status === "paid" && (
                          <button
                            onClick={() => printFeeReceipt(order)}
                            className="rounded border border-outline-variant px-2.5 py-1 text-[10px] font-bold text-on-surface-variant hover:border-primary hover:text-primary"
                          >
                            영수증
                          </button>
                        )}
                        {order.status === "pending" && (
                          <button
                            onClick={() => feeAction(order.id, "cancel")}
                            disabled={feeActioning === order.id}
                            className="rounded border border-outline-variant px-2.5 py-1 text-[10px] font-bold text-on-surface-variant hover:border-error hover:text-error disabled:opacity-50"
                          >
                            취소
                          </button>
                        )}
                        {order.status === "paid" && (
                          <button
                            onClick={() => feeAction(order.id, "refund")}
                            disabled={feeActioning === order.id}
                            className="rounded border border-error/40 px-2.5 py-1 text-[10px] font-bold text-error hover:bg-error/5 disabled:opacity-50"
                          >
                            환불
                          </button>
                        )}
                        {!["pending", "paid"].includes(order.status) && <span className="text-xs text-outline">-</span>}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AdminListSurface>
      </div>
    </div>
  );
}
