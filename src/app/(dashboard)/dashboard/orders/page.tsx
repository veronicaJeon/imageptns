"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { buildOrderStatusSteps, type TimelineState } from "@/lib/ux/status";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-primary/10 text-primary",
  pending:   "bg-amber-50 text-amber-500 dark:bg-amber-900/20",
  refunded:  "bg-surface-container-high text-outline",
  failed:    "bg-error/10 text-error",
};

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

function explorerTxUrl(chainId: number | null, txHash: string | null) {
  if (!chainId || !txHash) return null;
  const baseUrl = chainId === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org";
  return `${baseUrl}/tx/${txHash}`;
}

interface OrderImage {
  id: string;
  title: string | null;
  asset_id: string | null;
  storage_path_preview: string | null;
  lifecycle_status: string | null;
  deleted_at: string | null;
}

interface OrderItem {
  id: string;
  license_code: string;
  price_krw: number;
  image_lifecycle_status: string | null;
  image_deleted_at: string | null;
  image_deletion_notice: string | null;
  image: OrderImage | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  total_krw: number;
  payment_provider: string | null;
  chain_id: number | null;
  payment_token: string | null;
  payment_tx_hash: string | null;
  contract_order_id: string | null;
  crypto_amount: number | string | null;
  crypto_status: string | null;
  order_items: OrderItem[] | null;
}

interface OrderRow {
  orderId: string;
  orderNumber: string;
  status: string;
  date: string;
  totalKrw: number;
  itemId: string;
  license: string;
  priceKrw: number;
  imageId: string | undefined;
  title: string;
  src: string;
  assetId: string;
  imageLifecycleStatus: string | null;
  imageDeletedAt: string | null;
  imageDeletionNotice: string | null;
  paymentProvider: string | null;
  chainId: number | null;
  paymentToken: string | null;
  paymentTxHash: string | null;
  contractOrderId: string | null;
  cryptoAmount: number | string | null;
  cryptoStatus: string | null;
  isFirstItemInOrder: boolean;
}

const LICENSE_SUMMARY: Record<string, string> = {
  editorial: "뉴스, 기사, 교육 목적 사용",
  commercial: "광고, 마케팅, 상업 목적 사용",
  extended: "확장 인쇄, 상품화, 전 매체 사용",
};

const TIMELINE_STYLES: Record<TimelineState, string> = {
  done: "bg-primary text-on-primary",
  current: "bg-amber-400 text-black",
  pending: "bg-surface-container-high text-outline",
  failed: "bg-error text-on-error",
};

function OrderTimeline({ row }: { row: OrderRow }) {
  const steps = buildOrderStatusSteps({
    status: row.status,
    paymentProvider: row.paymentProvider,
    cryptoStatus: row.cryptoStatus,
    paymentTxHash: row.paymentTxHash,
  });

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-4">
      {steps.map((step, index) => (
        <div key={step.key} className="flex gap-2 min-w-0">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TIMELINE_STYLES[step.state]}`}>
            {step.state === "done" ? "✓" : step.state === "failed" ? "!" : index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-on-surface">{step.label}</p>
            <p className="text-[10px] leading-relaxed text-outline">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OrdersPage() {
  const { t } = useLang();
  const ord = t.dashboard.orders;
  const recovery = ord.recovery;
  const c   = ord.cols;

  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [recoveryTxHashes, setRecoveryTxHashes] = useState<Record<string, string>>({});
  const [confirmingOrderIds, setConfirmingOrderIds] = useState<Record<string, boolean>>({});

  const refreshOrders = useCallback(async () => {
    const res = await fetch("/api/orders");
    if (!res.ok) {
      throw new Error("Failed to refresh orders");
    }
    const data = (await res.json()) as { orders?: Order[] };
    setOrders(data.orders ?? []);
  }, []);

  useEffect(() => {
    refreshOrders()
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [refreshOrders]);

  async function handleDownload(orderItemId: string) {
    setDownloading(orderItemId);
    try {
      const res = await fetch(`/api/download/${orderItemId}`);
      if (!res.ok) {
        const { error } = await res.json();
        alert(error ?? "Download failed");
        return;
      }
      const { url } = await res.json();
      window.open(url, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  function handleRecoveryTxHashChange(orderDbId: string, txHash: string) {
    setRecoveryTxHashes((prev) => ({ ...prev, [orderDbId]: txHash }));
  }

  async function handleConfirmOnchain(orderDbId: string) {
    const txHash = recoveryTxHashes[orderDbId]?.trim() ?? "";
    if (!txHash) {
      alert(recovery.missingTx);
      return;
    }

    setConfirmingOrderIds((prev) => ({ ...prev, [orderDbId]: true }));
    try {
      const res = await fetch("/api/onchain/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderDbId, txHash }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
        const error = typeof data?.error === "string" && data.error.trim()
          ? data.error
          : recovery.confirmFailed;
        alert(error);
        return;
      }

      try {
        await refreshOrders();
      } catch {
        alert(recovery.refreshFailed);
      }

      setRecoveryTxHashes((prev) => {
        const next = { ...prev };
        delete next[orderDbId];
        return next;
      });
    } catch {
      alert(recovery.networkFailed);
    } finally {
      setConfirmingOrderIds((prev) => {
        const next = { ...prev };
        delete next[orderDbId];
        return next;
      });
    }
  }

  // Flatten orders → rows per item
  const rows: OrderRow[] = orders.flatMap((order) =>
    (order.order_items ?? []).map((item, itemIndex) => ({
      orderId:     order.id,
      orderNumber: order.order_number,
      status:      order.status,
      date:        new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      totalKrw:    order.total_krw,
      itemId:      item.id,
      license:     item.license_code,
      priceKrw:     item.price_krw,
      imageId:     item.image?.id,
      title:       item.image?.title ?? "",
      src:         item.image?.storage_path_preview ?? "",
      assetId:     item.image?.asset_id ?? "",
      imageLifecycleStatus: item.image_lifecycle_status ?? item.image?.lifecycle_status ?? "active",
      imageDeletedAt: item.image_deleted_at ?? item.image?.deleted_at ?? null,
      imageDeletionNotice: item.image_deletion_notice,
      paymentProvider: order.payment_provider,
      chainId: order.chain_id,
      paymentToken: order.payment_token,
      paymentTxHash: order.payment_tx_hash,
      contractOrderId: order.contract_order_id,
      cryptoAmount: order.crypto_amount,
      cryptoStatus: order.crypto_status,
      isFirstItemInOrder: itemIndex === 0,
    }))
  );

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-8 tracking-tight">{ord.title}</h1>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">receipt_long</span>
          <p>{ord.empty}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {[c.image, c.license, c.date, c.amount, c.status, ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.map((row) => {
                const canRecoverBaseUsdc = row.isFirstItemInOrder && row.paymentProvider === "base_usdc" && row.cryptoStatus === "pending";
                const isConfirming = Boolean(confirmingOrderIds[row.orderId]);
                const imageUnavailable = row.imageLifecycleStatus && row.imageLifecycleStatus !== "active";

                return (
                <tr key={row.itemId} className="hover:bg-surface-container-low transition-colors align-top">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {row.src ? (
                        <Image src={row.src} alt={row.title} width={56} height={40} className="object-cover rounded shrink-0 w-14 h-10" />
                      ) : (
                        <div className="w-14 h-10 bg-surface-container-low rounded shrink-0 flex items-center justify-center">
                          <span className="material-symbols-outlined text-outline text-sm">image</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        {row.imageId && !imageUnavailable ? (
                          <Link href={`/library/${row.imageId}`} className="text-on-surface font-medium hover:text-primary transition-colors truncate block max-w-[180px]">{row.title}</Link>
                        ) : (
                          <p className="text-on-surface font-medium truncate max-w-[180px]">{row.title}</p>
                        )}
                        <p className="text-xs text-outline">{row.orderNumber}</p>
                        {imageUnavailable && (
                          <p className="mt-1 rounded bg-error/10 px-2 py-1 text-[10px] font-bold text-error">
                            판매중지/삭제 고지
                          </p>
                        )}
                        {row.paymentProvider === "base_usdc" && (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
                            <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-200 px-2 py-0.5 rounded-full">
                              Base USDC
                            </span>
                            {row.cryptoStatus && (
                              <span className="bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-full">
                                {row.cryptoStatus}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant capitalize">
                    <p>{row.license}</p>
                    <p className="mt-1 text-xs text-outline">{formatKRW(row.priceKrw)}</p>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant">{row.date}</td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-on-surface">{formatKRW(row.totalKrw)}</p>
                    {row.paymentProvider === "base_usdc" && row.cryptoAmount && (
                      <p className="text-xs text-outline mt-1">{row.cryptoAmount} USDC</p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[row.status] ?? ""}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
                    {row.paymentProvider === "base_usdc" && (
                      <div className="mt-3 flex flex-col gap-1 text-[10px] text-outline font-mono max-w-[220px]">
                        {row.paymentTxHash && (
                          <a
                            href={explorerTxUrl(row.chainId, row.paymentTxHash) ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary hover:opacity-70 transition-opacity truncate"
                          >
                            tx {row.paymentTxHash}
                          </a>
                        )}
                        {row.contractOrderId && <span className="truncate">order {row.contractOrderId}</span>}
                        {row.paymentToken && <span className="truncate">token {row.paymentToken}</span>}
                      </div>
                    )}
                    {row.isFirstItemInOrder && <OrderTimeline row={row} />}
                    {row.isFirstItemInOrder && row.paymentProvider === "base_usdc" && row.cryptoStatus === "pending" && (
                      <div className="mt-3 max-w-md rounded-lg border border-amber-300/50 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                        지갑 결제를 완료했는데 다운로드가 열리지 않으면, 지갑의 트랜잭션 해시를 오른쪽 복구 입력창에 붙여넣어 구매 확정을 다시 요청하세요.
                      </div>
                    )}
                    {row.status === "completed" && (
                      <div className="mt-3 max-w-md rounded-lg bg-surface-container-low px-3 py-2 text-[11px] leading-relaxed text-on-surface-variant">
                        <span className="font-bold text-on-surface">라이선스:</span>{" "}
                        {LICENSE_SUMMARY[row.license] ?? "구매한 라이선스 조건에 따라 사용 가능합니다."}
                      </div>
                    )}
                    {row.imageDeletionNotice && (
                      <div className="mt-3 max-w-md rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[11px] leading-relaxed text-error">
                        {row.imageDeletionNotice}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {row.status === "completed" && (
                      <button
                        onClick={() => handleDownload(row.itemId)}
                        disabled={downloading === row.itemId}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:opacity-70 transition-opacity disabled:opacity-50"
                      >
                        {downloading === row.itemId
                          ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-base">download</span>
                        }
                        {ord.download}
                      </button>
                    )}
                    {canRecoverBaseUsdc && (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void handleConfirmOnchain(row.orderId);
                        }}
                        className="flex w-56 max-w-full items-center gap-2"
                      >
                        <input
                          type="text"
                          value={recoveryTxHashes[row.orderId] ?? ""}
                          onChange={(event) => handleRecoveryTxHashChange(row.orderId, event.target.value)}
                          placeholder={recovery.txPlaceholder}
                          aria-label={`${recovery.txLabel} ${row.orderNumber}`}
                          disabled={isConfirming}
                          autoComplete="off"
                          spellCheck={false}
                          className="min-w-0 flex-1 rounded-md border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface outline-none transition-colors placeholder:text-outline focus:border-primary disabled:opacity-60"
                        />
                        <button
                          type="submit"
                          disabled={isConfirming}
                          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-80 disabled:opacity-50"
                        >
                          <span className="inline-flex min-w-14 justify-center">
                            {isConfirming ? recovery.retrying : recovery.retry}
                          </span>
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
