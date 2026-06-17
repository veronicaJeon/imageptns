"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { useAuth } from "@/lib/store/auth";

/** 플랜 ID → Toss 빌링 페이지에서 사용할 slug */
const PLAN_SLUGS: Record<number, string> = {
  0: "basic",
  1: "pro",
  2: "enterprise",
};

/** Toss JS SDK 동적 로드 (window.TossPayments 노출) */
function useTossSDK() {
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || typeof window === "undefined") return;
    if ((window as Window & { TossPayments?: unknown }).TossPayments) {
      loaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.tosspayments.com/v1/payment";
    script.async = true;
    script.onload = () => { loaded.current = true; };
    document.head.appendChild(script);
    return () => {
      // script 태그는 제거하지 않음 — 전역 SDK 공유
    };
  }, []);
}

export default function PricingPage() {
  const { t } = useLang();
  const p = t.pricing;
  const router = useRouter();
  const { user, loading: authLoading, init } = useAuth();
  const [annual, setAnnual] = useState(false);
  const [subscribing, setSubscribing] = useState<number | null>(null);

  useTossSDK();

  useEffect(() => {
    init();
  }, [init]);

  async function handleSubscribe(planIndex: number) {
    // 엔터프라이즈는 문의 화면으로 연결
    if (planIndex === 2) {
      router.push("/contact");
      return;
    }

    // 미로그인 → 로그인 페이지로
    if (!authLoading && !user) {
      router.push("/login?next=/pricing");
      return;
    }

    // 아직 auth 로딩 중이면 대기
    if (authLoading || !user) return;

    const plan = PLAN_SLUGS[planIndex];
    if (!plan) return;

    setSubscribing(planIndex);

    try {
      const toss = (window as Window & { TossPayments?: (key: string) => {
        requestBillingAuth: (method: "카드", params: {
          customerKey: string;
          successUrl: string;
          failUrl: string;
          customerEmail?: string;
          customerName?: string;
        }) => Promise<void>;
      } }).TossPayments;

      if (!toss) {
        alert("결제 모듈을 로드하는 중입니다. 잠시 후 다시 시도해주세요.");
        setSubscribing(null);
        return;
      }

      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "";
      // customerKey: 사용자별 고정 키 (userId 기반)
      const customerKey = user.id;

      const origin = window.location.origin;
      const successUrl = `${origin}/pricing/success?plan=${plan}&annual=${annual}&customerKey=${encodeURIComponent(customerKey)}`;
      const failUrl    = `${origin}/pricing?error=billing_cancelled`;

      await toss(clientKey).requestBillingAuth("카드", {
        customerKey,
        successUrl,
        failUrl,
        customerEmail: user.email,
        customerName:  user.full_name || user.email,
      });
    } catch (err) {
      console.error("[pricing] billing auth error", err);
    } finally {
      setSubscribing(null);
    }
  }

  return (
    <>
      {/* ── Hero ── */}
      <section className="pt-36 pb-16 px-6 bg-surface text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-4">
            {p.hero.headline}
          </h1>
          <p className="text-on-surface-variant mb-8">{p.hero.sub}</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-surface-container-low rounded-full p-1">
            <button
              onClick={() => setAnnual(false)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${!annual ? "bg-surface-container-lowest shadow text-on-surface" : "text-on-surface-variant"}`}
            >
              {p.toggle.monthly}
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${annual ? "bg-surface-container-lowest shadow text-on-surface" : "text-on-surface-variant"}`}
            >
              {p.toggle.annual}
              <span className="text-[10px] font-black text-primary-container bg-primary px-2 py-0.5 rounded-full">
                {p.toggle.discount}
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Plans ── */}
      <section className="pb-24 px-6 md:px-8 bg-surface">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {p.plans.map((plan, i) => {
            const featured = i === 1;
            const isEnterprise = i === 2;
            const isLoading = subscribing === i;

            return (
              <div
                key={plan.name}
                className={[
                  "flex flex-col p-8 shadow-ghost",
                  featured
                    ? "bg-primary text-white scale-[1.02] md:-mt-4"
                    : "bg-surface-container-lowest text-on-surface",
                ].join(" ")}
              >
                <p
                  className={`text-xs font-bold uppercase tracking-widest mb-4 ${featured ? "text-primary-container" : "text-outline"}`}
                >
                  {plan.name}
                </p>
                <div className="mb-2">
                  <span className="font-headline text-4xl font-extrabold">
                    {annual ? plan.priceAnn : plan.price}
                  </span>
                  {plan.price !== "Custom" && plan.price !== "맞춤 견적" && (
                    <span
                      className={`text-sm ml-1 ${featured ? "text-white/60" : "text-outline"}`}
                    >
                      /mo
                    </span>
                  )}
                </div>
                <p
                  className={`text-sm mb-8 ${featured ? "text-white/70" : "text-on-surface-variant"}`}
                >
                  {plan.desc}
                </p>

                <ul className="flex flex-col gap-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <span
                        className={`material-symbols-outlined text-base mt-0.5 shrink-0 ${featured ? "text-primary-container" : "text-primary"}`}
                      >
                        check_circle
                      </span>
                      <span
                        className={featured ? "text-white/90" : "text-on-surface-variant"}
                      >
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>

                {isEnterprise ? (
                  <Link
                    href="/contact"
                    className={[
                      "block text-center py-3 text-xs font-bold uppercase tracking-widest rounded transition-all",
                      featured
                        ? "bg-white text-primary hover:bg-zinc-100"
                        : "bg-primary text-white hover:opacity-90",
                    ].join(" ")}
                  >
                    {plan.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(i)}
                    disabled={isLoading || (subscribing !== null && subscribing !== i)}
                    className={[
                      "block w-full text-center py-3 text-xs font-bold uppercase tracking-widest rounded transition-all disabled:opacity-60",
                      featured
                        ? "bg-white text-primary hover:bg-zinc-100"
                        : "bg-primary text-white hover:opacity-90",
                    ].join(" ")}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span
                          className={`w-4 h-4 border-2 border-t-transparent rounded-full animate-spin ${featured ? "border-primary" : "border-white"}`}
                        />
                        처리 중…
                      </span>
                    ) : (
                      plan.cta
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Enterprise CTA ── */}
      <section className="py-20 px-6 bg-surface-container-low text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-headline text-2xl font-extrabold text-on-surface mb-3">
            {p.enterprise.title}
          </h2>
          <p className="text-on-surface-variant mb-8">{p.enterprise.sub}</p>
          <Link
            href="/contact"
            className="inline-block px-8 py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity"
          >
            {p.enterprise.btn}
          </Link>
        </div>
      </section>
    </>
  );
}
