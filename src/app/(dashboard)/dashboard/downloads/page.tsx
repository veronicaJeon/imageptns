"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";

interface DownloadOrderImage {
  id: string | null;
  title: string | null;
  storage_path_preview: string | null;
  asset_id: string | null;
}

interface DownloadOrderItem {
  id: string;
  license_code: string;
  image: DownloadOrderImage | null;
}

interface DownloadOrder {
  id: string;
  order_number: string;
  completed_at: string | null;
  status: string;
  order_items: DownloadOrderItem[] | null;
}

export default function DownloadsPage() {
  const [orders, setOrders]   = useState<DownloadOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then(({ orders }: { orders?: DownloadOrder[] }) =>
        setOrders((orders ?? []).filter((order) => order.status === "completed"))
      )
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

  const items = orders.flatMap((order) =>
    (order.order_items ?? []).map((item) => ({
      orderId:     order.id,
      orderNumber: order.order_number,
      completedAt: order.completed_at,
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
      <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-8 tracking-tight">
        Downloads
      </h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">download</span>
          <p>구매한 이미지가 없습니다.</p>
          <Link href="/library" className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            Browse Library
          </Link>
        </div>
      ) : (
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["Image", "License", "Purchased", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.map((row) => {
                const date = row.completedAt
                  ? new Date(row.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                return (
                  <tr key={row.itemId} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-10 bg-surface-container-low rounded shrink-0 overflow-hidden flex items-center justify-center">
                          {row.src ? (
                            <Image
                              src={thumbnailUrlFromPreviewUrl(row.src, 160, 120)}
                              alt={row.title}
                              width={160}
                              height={120}
                              className="w-full h-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="material-symbols-outlined text-outline text-sm">image</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          {row.imageId ? (
                            <Link href={`/library/${row.imageId}`} className="text-on-surface font-medium hover:text-primary transition-colors truncate block max-w-[200px]">
                              {row.title}
                            </Link>
                          ) : (
                            <p className="text-on-surface font-medium truncate max-w-[200px]">{row.title}</p>
                          )}
                          {row.assetId && <p className="text-xs text-outline">{row.assetId}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant capitalize">{row.license}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{date}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDownload(row.itemId)}
                        disabled={downloading === row.itemId}
                        className="flex items-center gap-1 text-xs font-bold text-primary hover:opacity-70 transition-opacity disabled:opacity-50"
                      >
                        {downloading === row.itemId
                          ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-base">download</span>
                        }
                        Download
                      </button>
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
