"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

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
}

interface OrderItem {
  id: string;
  license_code: string;
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
  imageId: string | undefined;
  title: string;
  src: string;
  assetId: string;
  paymentProvider: string | null;
  chainId: number | null;
  paymentToken: string | null;
  paymentTxHash: string | null;
  contractOrderId: string | null;
  cryptoAmount: number | string | null;
  cryptoStatus: string | null;
}

export default function OrdersPage() {
  const { t } = useLang();
  const ord = t.dashboard.orders;
  const c   = ord.cols;

  const [orders, setOrders]       = useState<Order[]>([]);
  const [loading, setLoading]     = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(({ orders }) => setOrders(orders ?? []))
      .finally(() => setLoading(false));
  }, []);

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

  // Flatten orders → rows per item
  const rows: OrderRow[] = orders.flatMap((order) =>
    (order.order_items ?? []).map((item) => ({
      orderId:     order.id,
      orderNumber: order.order_number,
      status:      order.status,
      date:        new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      totalKrw:    order.total_krw,
      itemId:      item.id,
      license:     item.license_code,
      imageId:     item.image?.id,
      title:       item.image?.title ?? "",
      src:         item.image?.storage_path_preview ?? "",
      assetId:     item.image?.asset_id ?? "",
      paymentProvider: order.payment_provider,
      chainId: order.chain_id,
      paymentToken: order.payment_token,
      paymentTxHash: order.payment_tx_hash,
      contractOrderId: order.contract_order_id,
      cryptoAmount: order.crypto_amount,
      cryptoStatus: order.crypto_status,
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
              {rows.map((row) => (
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
                        {row.imageId ? (
                          <Link href={`/library/${row.imageId}`} className="text-on-surface font-medium hover:text-primary transition-colors truncate block max-w-[180px]">{row.title}</Link>
                        ) : (
                          <p className="text-on-surface font-medium truncate max-w-[180px]">{row.title}</p>
                        )}
                        <p className="text-xs text-outline">{row.orderNumber}</p>
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
                  <td className="px-6 py-4 text-on-surface-variant capitalize">{row.license}</td>
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
