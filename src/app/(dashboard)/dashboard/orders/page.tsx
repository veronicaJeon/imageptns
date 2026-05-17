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

export default function OrdersPage() {
  const { t } = useLang();
  const ord = t.dashboard.orders;
  const c   = ord.cols;

  const [orders, setOrders]       = useState<any[]>([]);
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
  const rows = orders.flatMap((order: any) =>
    (order.order_items ?? []).map((item: any) => ({
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
                <tr key={row.itemId} className="hover:bg-surface-container-low transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {row.src ? (
                        <img src={row.src} alt={row.title} width={56} height={40} className="object-cover rounded shrink-0 w-14 h-10" />
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
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-on-surface-variant capitalize">{row.license}</td>
                  <td className="px-6 py-4 text-on-surface-variant">{row.date}</td>
                  <td className="px-6 py-4 font-semibold text-on-surface">{formatKRW(row.totalKrw)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${STATUS_STYLES[row.status] ?? ""}`}>
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </span>
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
