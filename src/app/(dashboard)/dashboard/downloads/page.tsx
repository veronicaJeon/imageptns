"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";

interface DownloadOrderImage {
  id: string | null;
  title: string | null;
  storage_path_preview: string | null;
  asset_id: string | null;
  lifecycle_status: string | null;
  deleted_at: string | null;
}

interface DownloadOrderItem {
  id: string;
  license_code: string;
  subscription_covered: boolean | null;
  subscription_plan: string | null;
  image_lifecycle_status: string | null;
  image_deleted_at: string | null;
  image_deletion_notice: string | null;
  downloads: { id: string; expires_at: string | null; download_count: number | null }[] | null;
  image: DownloadOrderImage | null;
}

interface DownloadOrder {
  id: string;
  order_number: string;
  completed_at: string | null;
  status: string;
  order_items: DownloadOrderItem[] | null;
}

const PAGE_DOWNLOAD_LIMIT = 20;

export default function DownloadsPage() {
  const { lang } = useLang();
  const copy = lang === "ko"
    ? {
        title: "다운로드",
        empty: "구매한 이미지가 없습니다.",
        browse: "라이브러리 보기",
        headers: ["이미지", "라이선스", "구매일", "만료일", ""],
        subscriptionDownload: "무료다운",
        downloadCount: (count: number) => `다운로드 ${count}회`,
        download: "다운로드",
        downloadAll: "전체 다운로드",
        downloadingAll: "다운로드 준비 중...",
        limitNotice: (count: number, total: number) => `최근 ${count}개만 표시 중입니다. 전체 ${total}개 중 나머지는 주문 내역에서 확인해 주세요.`,
      }
    : {
        title: "Downloads",
        empty: "You have not purchased any images yet.",
        browse: "Browse Library",
        headers: ["Image", "License", "Purchased", "Expires", ""],
        subscriptionDownload: "free download",
        downloadCount: (count: number) => `${count} downloads`,
        download: "Download",
        downloadAll: "Download all",
        downloadingAll: "Preparing downloads...",
        limitNotice: (count: number, total: number) => `Showing the latest ${count} items out of ${total}. Check Orders for older items.`,
      };
  const [orders, setOrders]   = useState<DownloadOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);

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

  async function downloadZip(orderItemIds: string[]) {
    const res = await fetch("/api/download/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderItemIds }),
    });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Download failed" }));
      throw new Error(error ?? "Download failed");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `imagepartners-downloads-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const items = orders.flatMap((order) =>
    (order.order_items ?? []).map((item) => ({
      orderId:     order.id,
      orderNumber: order.order_number,
      completedAt: order.completed_at,
      itemId:      item.id,
      license:     item.license_code,
      subscriptionCovered: Boolean(item.subscription_covered),
      subscriptionPlan: item.subscription_plan,
      downloadExpiresAt: item.downloads?.[0]?.expires_at ?? null,
      downloadCount: item.downloads?.[0]?.download_count ?? 0,
      imageId:     item.image?.id,
      title:       item.image?.title ?? "",
      src:         item.image?.storage_path_preview ?? "",
      assetId:     item.image?.asset_id ?? "",
      imageLifecycleStatus: item.image_lifecycle_status ?? item.image?.lifecycle_status ?? "active",
      imageDeletedAt: item.image_deleted_at ?? item.image?.deleted_at ?? null,
      imageDeletionNotice: item.image_deletion_notice,
    }))
  );
  const visibleItems = items.slice(0, PAGE_DOWNLOAD_LIMIT);

  async function handleDownloadAll() {
    if (visibleItems.length === 0 || batchDownloading) return;
    setBatchDownloading(true);
    try {
      await downloadZip(visibleItems.map((item) => item.itemId));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Download failed");
    } finally {
      setBatchDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">
          {copy.title}
        </h1>
        {items.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadAll}
            disabled={batchDownloading}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {batchDownloading
              ? <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : <span className="material-symbols-outlined text-base">download</span>
            }
            {batchDownloading ? copy.downloadingAll : copy.downloadAll}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">download</span>
          <p>{copy.empty}</p>
          <Link href="/library" className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            {copy.browse}
          </Link>
        </div>
      ) : (
        <div className="bg-surface-container-lowest shadow-ghost overflow-x-auto">
          {items.length > visibleItems.length && (
            <p className="px-6 pt-4 text-xs text-outline">
              {copy.limitNotice(visibleItems.length, items.length)}
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {copy.headers.map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold uppercase tracking-widest text-outline px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {visibleItems.map((row) => {
                const date = row.completedAt
                  ? new Date(row.completedAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "—";
                const imageUnavailable = row.imageLifecycleStatus && row.imageLifecycleStatus !== "active";
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
                          {row.imageId && !imageUnavailable ? (
                            <Link href={`/library/${row.imageId}`} className="text-on-surface font-medium hover:text-primary transition-colors truncate block max-w-[200px]">
                              {row.title}
                            </Link>
                          ) : (
                            <p className="text-on-surface font-medium truncate max-w-[200px]">{row.title}</p>
                          )}
                          {row.assetId && <p className="text-xs text-outline">{row.assetId}</p>}
                          {row.imageDeletionNotice && (
                            <p className="mt-1 max-w-xs text-[10px] leading-relaxed text-error">{row.imageDeletionNotice}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant capitalize">
                      <p>{row.license}</p>
                      {row.subscriptionCovered && (
                        <p className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          {row.subscriptionPlan ?? "subscription"} {copy.subscriptionDownload}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant">{date}</td>
                    <td className="px-6 py-4 text-on-surface-variant">
                      {row.downloadExpiresAt
                        ? new Date(row.downloadExpiresAt).toLocaleDateString(lang === "ko" ? "ko-KR" : "en-US", { year: "2-digit", month: "2-digit", day: "2-digit" })
                        : "-"}
                      <p className="mt-1 text-[10px] text-outline">{copy.downloadCount(row.downloadCount)}</p>
                    </td>
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
                        {copy.download}
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
