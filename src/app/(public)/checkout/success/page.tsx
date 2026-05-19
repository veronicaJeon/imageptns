"use client";

import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense, useMemo, useState } from "react";
import { useCart } from "@/lib/store/cart";

interface SuccessOrderItem {
  id: string;
  license_code: string;
  image: {
    id: string;
    title: string | null;
    storage_path_preview: string | null;
    asset_id: string | null;
  } | null;
}

interface SuccessOrder {
  order_number: string;
  status: string;
  order_items: SuccessOrderItem[] | null;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber  = searchParams.get("order") ?? "";
  const { clear }    = useCart();
  const [orders, setOrders] = useState<SuccessOrder[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    clear();
  }, [clear]);

  useEffect(() => {
    fetch("/api/orders")
      .then((res) => res.ok ? res.json() : null)
      .then((data: { orders?: SuccessOrder[] } | null) => setOrders(data?.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrder(false));
  }, []);

  const completedOrder = useMemo(() => {
    const completed = orders.filter((order) => order.status === "completed");
    if (orderNumber) {
      return completed.find((order) => order.order_number === orderNumber) ?? null;
    }
    return completed[0] ?? null;
  }, [orderNumber, orders]);

  async function handleDownload(orderItemId: string) {
    setDownloading(orderItemId);
    try {
      const res = await fetch(`/api/download/${orderItemId}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(data?.error ?? "원본 파일 다운로드 링크를 만들지 못했습니다.");
        return;
      }
      const { url } = await res.json() as { url: string };
      window.open(url, "_blank");
    } finally {
      setDownloading(null);
    }
  }

  const purchasedItems = completedOrder?.order_items ?? [];

  return (
    <div className="min-h-screen px-6 py-32 bg-surface">
      <div className="mx-auto max-w-3xl text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
          <span className="material-symbols-outlined text-5xl text-primary">check_circle</span>
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3 tracking-tight">
          결제가 완료되었습니다
        </h1>
        {orderNumber && (
          <p className="text-outline text-sm mb-2">주문번호: <span className="font-mono font-bold text-on-surface">{orderNumber}</span></p>
        )}
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          구매하신 이미지는 지금 바로 다운로드할 수 있고, 대시보드 &rarr; 주문 내역에서도 다시 받을 수 있습니다.
        </p>

        <div className="mb-10 bg-surface-container-lowest text-left shadow-ghost">
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/20 px-5 py-4">
            <div>
              <p className="text-sm font-bold text-on-surface">구매한 원본 파일</p>
              <p className="mt-1 text-xs text-outline">다운로드 링크는 서버에서 안전하게 서명되어 새 창으로 열립니다.</p>
            </div>
            {loadingOrder && <span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
          </div>

          {!loadingOrder && purchasedItems.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-outline">
              결제는 완료됐지만 이 화면에서 주문 항목을 불러오지 못했습니다. 주문 내역에서 다운로드를 확인해주세요.
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/20">
              {purchasedItems.map((item) => (
                <div key={item.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-low">
                      {item.image?.storage_path_preview ? (
                        <Image
                          src={item.image.storage_path_preview}
                          alt={item.image.title ?? ""}
                          width={80}
                          height={56}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="material-symbols-outlined text-outline">image</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-on-surface">{item.image?.title ?? "Purchased image"}</p>
                      <p className="mt-1 text-xs text-outline">
                        {item.license_code} license
                        {item.image?.asset_id ? ` · ${item.image.asset_id}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(item.id)}
                    disabled={downloading === item.id}
                    className="inline-flex items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-xs font-bold uppercase tracking-widest text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {downloading === item.id ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-base">download</span>
                    )}
                    원본 다운로드
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/orders"
            className="px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            주문 내역 보기
          </Link>
          <Link
            href="/library"
            className="px-8 py-4 border border-outline-variant text-on-surface font-bold text-xs uppercase tracking-widest rounded hover:bg-surface-container-low transition-colors"
          >
            라이브러리로
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
