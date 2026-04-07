"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function FailContent() {
  const searchParams = useSearchParams();
  const code         = searchParams.get("code") ?? "UNKNOWN";

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-8">
          <span className="material-symbols-outlined text-5xl text-error">cancel</span>
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3 tracking-tight">
          결제에 실패했습니다
        </h1>
        <p className="text-outline text-xs mb-2 font-mono">오류 코드: {code}</p>
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          결제가 처리되지 않았습니다. 카드 정보를 확인하거나 다시 시도해 주세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/checkout"
            className="px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            다시 시도
          </Link>
          <Link
            href="/support"
            className="px-8 py-4 border border-outline-variant text-on-surface font-bold text-xs uppercase tracking-widest rounded hover:bg-surface-container-low transition-colors"
          >
            고객 지원
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailPage() {
  return (
    <Suspense>
      <FailContent />
    </Suspense>
  );
}
