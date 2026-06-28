"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cartStatementThumbnailUrl, collectCartStatementThumbnailUrls } from "@/lib/cart/print";
import { useLang } from "@/lib/i18n/store";
import { getLicensePrice, LicenseType, useCart } from "@/lib/store/cart";

const STATEMENT_COPY = {
  ko: {
    locale: "ko-KR",
    defaultUsageCondition: "저작자 표시 필요",
    statementTitle: "장바구니 견적서",
    quoteNumber: "견적번호",
    issuedAt: "발행일",
    itemCount: "항목",
    itemCountSuffix: "건",
    statementHeaders: ["No.", "이미지", "상품명 / 에셋 ID", "저작자 표시", "선택 옵션", "금액"],
    statementNotice: "본 견적서는 장바구니 기준 확인용 문서입니다. 실제 결제 금액과 라이선스 조건은 결제 시점의 상품 가격정책 및 저작권 정책을 기준으로 확정됩니다.",
    print: "PDF 인쇄",
    backToCart: "장바구니로 돌아가기",
    empty: "견적서로 인쇄할 장바구니 항목이 없습니다.",
  },
  en: {
    locale: "en-US",
    defaultUsageCondition: "Credit required",
    statementTitle: "Cart estimate",
    quoteNumber: "Quote no.",
    issuedAt: "Issued",
    itemCount: "Items",
    itemCountSuffix: "",
    statementHeaders: ["No.", "Image", "Product / Asset ID", "Credit line", "Selected option", "Amount"],
    statementNotice: "This estimate is based on the current cart. Final pricing and license terms are confirmed at checkout according to the active product and copyright policies.",
    print: "Print PDF",
    backToCart: "Back to cart",
    empty: "There are no cart items to print.",
  },
} as const;

function formatKRW(n: number, locale: string) {
  return "₩" + n.toLocaleString(locale);
}

function itemCreditLine(item: { creditLine?: string; photographer?: string }) {
  return item.creditLine || `${item.photographer || "unassigned"} / Image Partners`;
}

function itemUsageConditions(item: { usageConditions?: string[] }, fallback: string) {
  return item.usageConditions?.length ? item.usageConditions : [fallback];
}

function CartStatementInner() {
  const params = useSearchParams();
  const shouldAutoPrint = params.get("print") === "1";
  const { t, lang } = useLang();
  const c = t.cart;
  const copy = STATEMENT_COPY[lang];
  const { items } = useCart();
  const [origin] = useState(() => typeof window === "undefined" ? "" : window.location.origin);
  const [licensePrices, setLicensePrices] = useState<Partial<Record<LicenseType, number>>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const printedRef = useRef(false);
  const cartImageIds = items.map((item) => item.id).join(",");
  const issuedAt = useMemo(() => new Date(), []);
  const quoteNumber = `CART-${issuedAt.toISOString().slice(0, 10).replaceAll("-", "")}`;

  useEffect(() => {
    const params = new URLSearchParams();
    if (cartImageIds) params.set("imageIds", cartImageIds);
    fetch(`/api/license-types?${params.toString()}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data: { licenses?: { code: LicenseType; price_krw: number }[]; overrides?: { image_id: string; license_code: LicenseType; price_krw: number }[] } | null) => {
        if (!data?.licenses) return;
        setLicensePrices(Object.fromEntries(data.licenses.map((license) => [license.code, license.price_krw])));
        setPriceOverrides(Object.fromEntries((data.overrides ?? []).map((override) => [`${override.image_id}:${override.license_code}`, override.price_krw])));
      })
      .catch(() => {});
  }, [cartImageIds]);

  function displayPrice(license: LicenseType, imageId?: string) {
    return (imageId ? priceOverrides[`${imageId}:${license}`] : undefined) ?? licensePrices[license] ?? getLicensePrice(license);
  }

  const subtotal = items.reduce((sum, item) => sum + displayPrice(item.license, item.id), 0);
  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;

  async function preloadStatementThumbnails() {
    const urls = collectCartStatementThumbnailUrls(items, window.location.origin);
    await Promise.allSettled(
      urls.map((url) => new Promise<void>((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      })),
    );
  }

  async function printStatement() {
    await preloadStatementThumbnails();
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    window.print();
  }

  useEffect(() => {
    if (!origin || !shouldAutoPrint || printedRef.current || items.length === 0) return;
    printedRef.current = true;
    const timeout = window.setTimeout(() => {
      printStatement().catch(() => {});
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [origin, shouldAutoPrint, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length === 0) {
    return (
      <main className="min-h-screen bg-white px-6 py-10 text-black">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.25em]">Image Partners</p>
          <p className="mt-10 text-sm text-zinc-600">{copy.empty}</p>
          <Link href="/cart" className="mt-6 inline-flex rounded bg-black px-4 py-3 text-xs font-bold uppercase tracking-widest text-white">
            {copy.backToCart}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-4 py-6 text-black sm:px-8 sm:py-10">
      <style>{`
        @media print {
          @page { margin: 8mm; }
          body { background: #fff !important; }
          .statement-screen-controls { display: none !important; }
          .statement-page { padding: 0 !important; }
          .statement-card { box-shadow: none !important; border: 0 !important; max-width: none !important; padding: 0 !important; }
          .statement-card > div:first-child { margin-bottom: 10px !important; padding-bottom: 10px !important; }
          .statement-card h1 { font-size: 18px !important; }
          .statement-grid { display: grid !important; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 6px !important; }
          .statement-item { padding: 7px !important; page-break-inside: avoid !important; break-inside: avoid !important; }
          .statement-item img { max-height: 58px !important; }
        }
      `}</style>

      <div className="statement-page mx-auto max-w-5xl">
        <div className="statement-screen-controls mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/cart" className="inline-flex items-center gap-1.5 rounded border border-zinc-300 px-4 py-2 text-xs font-bold uppercase tracking-widest text-zinc-700">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {copy.backToCart}
          </Link>
          <button
            type="button"
            onClick={() => { printStatement().catch(() => {}); }}
            className="inline-flex items-center gap-1.5 rounded bg-black px-4 py-2 text-xs font-bold uppercase tracking-widest text-white"
          >
            <span className="material-symbols-outlined text-base">print</span>
            {copy.print}
          </button>
        </div>

        <section className="statement-card bg-white p-6 shadow-ghost sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-8 border-b border-zinc-300 pb-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-zinc-900">Image Partners</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">{copy.statementTitle}</h1>
              <p className="mt-2 text-sm text-zinc-600">{copy.quoteNumber} {quoteNumber}</p>
            </div>
            <div className="text-right text-sm text-zinc-600">
              <p>{copy.issuedAt} {issuedAt.toLocaleDateString(copy.locale)}</p>
              <p>{copy.itemCount} {items.length.toLocaleString(copy.locale)}{copy.itemCountSuffix}</p>
            </div>
          </div>

          <div className="statement-grid grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item, index) => (
              <article key={item.id} className="statement-item break-inside-avoid rounded border border-zinc-200 p-3">
                <div className="flex gap-3">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-100">
                    {item.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cartStatementThumbnailUrl(item.src, origin, 180, 180)}
                        alt=""
                        width="80"
                        height="80"
                        loading="eager"
                        decoding="sync"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="h-full w-full bg-zinc-100" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-zinc-500">No. {index + 1}</p>
                    <p className="mt-1 line-clamp-2 text-xs font-black leading-snug text-zinc-950">{item.title}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-zinc-500">{item.assetId ?? item.id}</p>
                    <p className="mt-1 text-[10px] text-zinc-500">{item.category}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-2 text-[10px] leading-snug">
                  <div>
                    <p className="font-bold text-zinc-500">{c.license}</p>
                    <p className="mt-0.5 font-semibold text-zinc-950">{c.licenseTypes[item.license]}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-zinc-500">{copy.statementHeaders[5]}</p>
                    <p className="mt-0.5 font-black text-zinc-950">{formatKRW(displayPrice(item.license, item.id), copy.locale)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-bold text-zinc-500">{copy.statementHeaders[3]}</p>
                    <p className="mt-0.5 truncate text-zinc-700">{itemCreditLine(item)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="font-bold text-zinc-500">{copy.statementHeaders[4]}</p>
                    <p className="mt-0.5 line-clamp-1 text-zinc-700">
                      {itemUsageConditions(item, copy.defaultUsageCondition).join(", ")}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="ml-auto mt-8 w-full max-w-72 text-sm">
            <div className="flex justify-between border-b border-zinc-200 py-2">
              <span className="text-zinc-600">{c.subtotal}</span>
              <span className="font-semibold">{formatKRW(subtotal, copy.locale)}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-200 py-2">
              <span className="text-zinc-600">{c.vat}</span>
              <span className="font-semibold">{formatKRW(vat, copy.locale)}</span>
            </div>
            <div className="flex justify-between py-3 text-lg font-black">
              <span>{c.total}</span>
              <span>{formatKRW(total, copy.locale)}</span>
            </div>
          </div>

          <p className="mt-10 text-xs leading-relaxed text-zinc-500">
            {copy.statementNotice}
          </p>
        </section>
      </div>
    </main>
  );
}

export default function CartStatementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <CartStatementInner />
    </Suspense>
  );
}
