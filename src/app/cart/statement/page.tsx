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
          @page { margin: 12mm; }
          body { background: #fff !important; }
          .statement-screen-controls { display: none !important; }
          .statement-page { padding: 0 !important; }
          .statement-card { box-shadow: none !important; border: 0 !important; max-width: none !important; }
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-zinc-900">
                  {copy.statementHeaders.map((header) => (
                    <th key={header} className="py-3 pr-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-600">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className="border-b border-zinc-200">
                    <td className="py-3 pr-3 text-zinc-500">{index + 1}</td>
                    <td className="py-3 pr-3">
                      {item.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cartStatementThumbnailUrl(item.src, origin, 160, 120)}
                          alt=""
                          width="64"
                          height="48"
                          loading="eager"
                          decoding="sync"
                          className="h-12 w-16 rounded object-cover"
                        />
                      ) : (
                        <div className="h-12 w-16 rounded bg-zinc-100" />
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-zinc-950">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.category}</p>
                      <p className="text-xs font-mono text-zinc-500">{item.assetId ?? item.id}</p>
                    </td>
                    <td className="py-3 pr-3 text-zinc-700">{itemCreditLine(item)}</td>
                    <td className="py-3 pr-3 text-zinc-700">
                      <p className="font-semibold text-zinc-950">{c.licenseTypes[item.license]}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                        {itemUsageConditions(item, copy.defaultUsageCondition).join(", ")}
                      </p>
                    </td>
                    <td className="py-3 text-right font-semibold text-zinc-950">{formatKRW(displayPrice(item.license, item.id), copy.locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
