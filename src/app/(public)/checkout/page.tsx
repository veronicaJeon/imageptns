"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { useCart } from "@/lib/store/cart";
import { useAuth } from "@/lib/store/auth";
import { loadPaymentWidget, type PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

export default function CheckoutPage() {
  const { t } = useLang();
  const ch = t.checkout;
  const { items } = useCart();
  const { user, loading: authLoading, init } = useAuth();
  const router = useRouter();

  useEffect(() => { init(); }, [init]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login?next=/checkout");
    }
  }, [authLoading, user, router]);

  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const vat      = Math.round(subtotal * 0.1);
  const total    = subtotal + vat;

  const [billing, setBilling]   = useState({ name: "", email: "", company: "" });
  const [loading, setLoading]   = useState(false);
  const [widgetReady, setWidgetReady] = useState(false);
  const widgetRef = useRef<PaymentWidgetInstance | null>(null);

  // Pre-fill billing from user profile
  useEffect(() => {
    if (user) {
      setBilling((b) => ({
        ...b,
        name:  b.name  || user.full_name || "",
        email: b.email || user.email     || "",
      }));
    }
  }, [user]);

  function setB(k: keyof typeof billing) {
    return (v: string) => setBilling((p) => ({ ...p, [k]: v }));
  }

  // Load Toss widget when total is ready
  useEffect(() => {
    if (!total || typeof window === "undefined") return;

    let mounted = true;
    loadPaymentWidget(
      process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!,
      billing.email || "@@ANONYMOUS"
    ).then((widget) => {
      if (!mounted) return;
      widgetRef.current = widget;
      widget.renderPaymentMethods("#toss-payment-widget", { value: total }, { variantKey: "DEFAULT" });
      widget.renderAgreement("#toss-agreement-widget", { variantKey: "AGREEMENT" });
      setWidgetReady(true);
    }).catch(console.error);

    return () => { mounted = false; };
  // Re-init if total changes
  }, [total]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!billing.name || !billing.email) return;
    if (!widgetRef.current) return;
    setLoading(true);

    try {
      // 1. Create order in DB
      const prepRes = await fetch("/api/checkout/prepare", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ id: i.id, license: i.license, price: i.price })),
          billing,
        }),
      });
      if (!prepRes.ok) throw new Error("주문 생성 실패");
      const { orderId, orderName } = await prepRes.json();

      // 2. Launch Toss payment (widget handles payment UI)
      await widgetRef.current.requestPayment({
        orderId,
        orderName,
        customerName:  billing.name,
        customerEmail: billing.email,
        successUrl: `${window.location.origin}/api/checkout/confirm`,
        failUrl:    `${window.location.origin}/checkout/fail`,
      });
    } catch (err: any) {
      console.error(err);
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="pt-36 pb-24 flex items-center justify-center min-h-screen">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="pt-36 pb-24 px-6 bg-surface min-h-screen flex flex-col items-center justify-center gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl">shopping_cart</span>
        <p>Your cart is empty.</p>
        <Link href="/library" className="text-primary font-bold text-sm hover:underline">Browse Library</Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 px-6 md:px-8 bg-surface min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-10">{ch.title}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

          {/* Payment form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 flex flex-col gap-8">

            {/* Billing info */}
            <div>
              <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-5">{ch.billingTitle}</h2>
              <div className="flex flex-col gap-4">
                {[
                  { key: "name",    label: ch.name,    placeholder: "Jane Smith",          type: "text" },
                  { key: "email",   label: ch.email,   placeholder: "you@example.com",     type: "email" },
                  { key: "company", label: ch.company, placeholder: "Acme Publishing Co.", type: "text" },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key} className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-outline uppercase tracking-widest">{label}</label>
                    <input
                      type={type}
                      value={billing[key as keyof typeof billing]}
                      onChange={(e) => setB(key as keyof typeof billing)(e.target.value)}
                      placeholder={placeholder}
                      required={key !== "company"}
                      className="h-12 bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 text-sm text-on-surface placeholder:text-outline outline-none transition-all"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Toss Payments Widget */}
            <div>
              <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-5">{ch.paymentMethod}</h2>
              <div id="toss-payment-widget" className="min-h-[100px]" />
              <div id="toss-agreement-widget" className="mt-4" />
              {!widgetReady && (
                <div className="flex items-center justify-center py-8 text-outline gap-2">
                  <span className="w-5 h-5 border-2 border-outline border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs">결제 위젯 로딩 중...</span>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !widgetReady}
              className="w-full py-4 bg-primary text-white font-bold text-sm uppercase tracking-widest rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><span className="material-symbols-outlined text-base">lock</span>{ch.submitBtn} · {formatKRW(total)}</>
              }
            </button>

            <p className="text-[10px] text-outline text-center">{ch.secureNote}</p>
          </form>

          {/* Order summary */}
          <div className="lg:col-span-5">
            <div className="bg-surface-container-lowest shadow-ghost p-6 sticky top-28">
              <h2 className="font-headline font-bold text-on-surface mb-6">{ch.orderSummary}</h2>

              <div className="flex flex-col gap-4 mb-6 max-h-64 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3">
                    <Image src={item.src} alt={item.title} width={56} height={40} className="object-cover rounded shrink-0" unoptimized />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-on-surface truncate">{item.title}</p>
                      <p className="text-[10px] text-outline capitalize">{item.license}</p>
                    </div>
                    <p className="text-xs font-bold text-on-surface shrink-0">{formatKRW(item.price)}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-outline-variant/20 pt-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>{t.cart.subtotal}</span><span>{formatKRW(subtotal)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>{t.cart.vat}</span><span>{formatKRW(vat)}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-outline-variant/20">
                  <span className="text-on-surface">{t.cart.total}</span>
                  <span className="text-primary">{formatKRW(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
