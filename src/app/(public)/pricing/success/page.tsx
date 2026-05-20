"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

/**
 * /pricing/success?customerKey=...&authKey=...&plan=...&annual=...
 *
 * Toss 빌링키 발급 완료 콜백 페이지.
 * URL에서 customerKey, authKey 를 받아 /api/subscription/billing-auth 를 호출한다.
 */
function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const customerKey = searchParams.get("customerKey") ?? "";
  const authKey     = searchParams.get("authKey")     ?? "";
  const plan        = searchParams.get("plan")        ?? "";
  const annual      = searchParams.get("annual") === "true";
  const missingParams = !customerKey || !authKey || !plan;

  const [status, setStatus] = useState<"loading" | "ok" | "error">(
    missingParams ? "error" : "loading",
  );
  const [errorMsg, setErrorMsg] = useState(missingParams ? "잘못된 접근입니다." : "");

  useEffect(() => {
    if (missingParams) return;

    fetch("/api/subscription/billing-auth", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerKey, authKey, plan, annual }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? "구독 처리 실패");
        }
        setStatus("ok");
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        setStatus("error");
      });
  }, [annual, authKey, customerKey, missingParams, plan]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface gap-4">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-on-surface-variant text-sm">구독을 처리하고 있습니다…</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-8">
            <span className="material-symbols-outlined text-5xl text-error">error</span>
          </div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-3 tracking-tight">
            구독 처리 실패
          </h1>
          <p className="text-on-surface-variant text-sm mb-8">{errorMsg}</p>
          <button
            onClick={() => router.push("/pricing")}
            className="px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            요금제로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-surface">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
          <span className="material-symbols-outlined text-5xl text-primary">check_circle</span>
        </div>
        <h1 className="font-headline text-3xl font-extrabold text-on-surface mb-3 tracking-tight">
          구독이 시작되었습니다!
        </h1>
        <p className="text-on-surface-variant text-sm mb-10 leading-relaxed">
          선택하신 플랜이 활성화되었습니다. 대시보드에서 구독 현황을 확인하세요.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard/settings"
            className="px-8 py-4 bg-primary text-white font-bold text-xs uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            대시보드 설정
          </Link>
          <Link
            href="/library"
            className="px-8 py-4 border border-outline-variant text-on-surface font-bold text-xs uppercase tracking-widest rounded hover:bg-surface-container-low transition-colors"
          >
            라이브러리 둘러보기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SubscriptionSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
