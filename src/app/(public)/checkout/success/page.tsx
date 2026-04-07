"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { useCart } from "@/lib/store/cart";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber  = searchParams.get("order") ?? "";
  const { clear }    = useCart();

  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="max-w-md w-full text-center">
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
          구매하신 이미지는 대시보드 &rarr; 주문 내역에서 다운로드할 수 있습니다.
        </p>
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
