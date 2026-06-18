"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { cartStatementThumbnailUrl, collectCartStatementThumbnailUrls } from "@/lib/cart/print";
import { useLang } from "@/lib/i18n/store";
import { useCart, LicenseType, getLicensePrice } from "@/lib/store/cart";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";

const LICENSE_KEYS: LicenseType[] = ["editorial", "commercial", "extended"];

const CART_PAGE_COPY = {
  ko: {
    locale: "ko-KR",
    defaultUsageCondition: "저작자 표시 필요",
    statementTitle: "장바구니 내역서",
    quoteNumber: "견적번호",
    issuedAt: "발행일",
    itemCount: "항목",
    itemCountSuffix: "건",
    statementHeaders: ["No.", "이미지", "상품명 / 에셋 ID", "저작자 표시", "사용 조건", "금액"],
    statementNotice: "본 내역서는 장바구니 기준 견적용 문서입니다. 실제 결제 금액과 라이선스 조건은 결제 시점의 상품 가격정책 및 저작권 정책을 기준으로 확정됩니다.",
    printStatement: "PDF 내역서 인쇄",
    creditLine: "저작자 표시",
    purchaseOptions: "구매 옵션",
  },
  en: {
    locale: "en-US",
    defaultUsageCondition: "Credit required",
    statementTitle: "Cart statement",
    quoteNumber: "Quote no.",
    issuedAt: "Issued",
    itemCount: "Items",
    itemCountSuffix: "",
    statementHeaders: ["No.", "Image", "Product / Asset ID", "Credit line", "Usage terms", "Amount"],
    statementNotice: "This statement is an estimate based on the current cart. Final pricing and license terms are confirmed at checkout according to the active product and copyright policies.",
    printStatement: "Print PDF statement",
    creditLine: "Credit line",
    purchaseOptions: "Purchase option",
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

export default function CartPage() {
  const { t, lang } = useLang();
  const c = t.cart;
  const copy = CART_PAGE_COPY[lang];
  const { items, removeItem, updateLicense } = useCart();
  const [licensePrices, setLicensePrices] = useState<Partial<Record<LicenseType, number>>>({});
  const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({});
  const cartImageIds = items.map((item) => item.id).join(",");

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

  const subtotal = items.reduce((s, i) => s + displayPrice(i.license, i.id), 0);
  const vat      = Math.round(subtotal * 0.1);
  const total    = subtotal + vat;
  const issuedAt = new Date();
  const quoteNumber = `CART-${issuedAt.toISOString().slice(0, 10).replaceAll("-", "")}`;

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

  async function handlePrintStatement() {
    await preloadStatementThumbnails();
    document.body.classList.add("printing-cart");
    const cleanup = () => document.body.classList.remove("printing-cart");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1000);
  }

  return (
    <div className="pt-32 pb-24 px-6 md:px-8 bg-surface min-h-screen">
      <div className="cart-print-document hidden bg-white text-black">
        <div className="mb-8 flex items-start justify-between gap-8 border-b border-zinc-300 pb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-500">Image Partners</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">{copy.statementTitle}</h1>
            <p className="mt-2 text-sm text-zinc-600">{copy.quoteNumber} {quoteNumber}</p>
          </div>
          <div className="text-right text-sm text-zinc-600">
            <p>{copy.issuedAt} {issuedAt.toLocaleDateString(copy.locale)}</p>
            <p>{copy.itemCount} {items.length.toLocaleString(copy.locale)}{copy.itemCountSuffix}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-zinc-900">
              {copy.statementHeaders.map((header) => (
                <th key={header} className="py-3 text-left text-xs font-bold uppercase tracking-widest text-zinc-600">
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
                      src={cartStatementThumbnailUrl(item.src, "", 160, 120)}
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
                <td className="py-3 pr-3 text-zinc-700">{itemUsageConditions(item, copy.defaultUsageCondition).join(", ")}</td>
                <td className="py-3 text-right font-semibold text-zinc-950">{formatKRW(displayPrice(item.license, item.id), copy.locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-8 w-72 text-sm">
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
      </div>

      <div className="max-w-5xl mx-auto cart-screen-content">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            {c.title}
            {items.length > 0 && <span className="ml-3 text-sm font-body font-normal text-outline">({items.length})</span>}
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handlePrintStatement}
              className="flex w-fit items-center gap-2 rounded bg-surface-container-lowest px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface shadow-ghost transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">print</span>
              {copy.printStatement}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center py-32 gap-4 text-outline">
            <span className="material-symbols-outlined text-7xl">shopping_cart</span>
            <p className="text-base">{c.empty}</p>
            <Link href="/library" className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
              {c.emptyBtn}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

            {/* Item list */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {items.map((item) => (
                <div key={item.id} className="bg-surface-container-lowest shadow-ghost p-5 flex gap-5">
                  <Link href={`/library/${item.id}`} className="shrink-0">
                    <NextImage
                      src={thumbnailUrlFromPreviewUrl(item.src, 240, 180)}
                      alt={item.title}
                      width={100}
                      height={70}
                      className="object-cover rounded"
                      unoptimized
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{item.category}</p>
                    <Link href={`/library/${item.id}`}>
                      <p className="font-semibold text-on-surface hover:text-primary transition-colors truncate">{item.title}</p>
                    </Link>
                    {item.photographer && (
                      <p className="text-xs text-outline mt-0.5">{item.photographer}</p>
                    )}
                    <p className="mt-2 text-xs text-on-surface-variant">
                      {copy.creditLine}: <span className="font-semibold text-on-surface">{itemCreditLine(item)}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {itemUsageConditions(item, copy.defaultUsageCondition).map((condition) => (
                        <span key={condition} className="rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-bold text-on-surface-variant">
                          {condition}
                        </span>
                      ))}
                    </div>

                    {/* License selector */}
                    <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-outline">{copy.purchaseOptions}</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {LICENSE_KEYS.map((key) => (
                        <button
                          key={key}
                          onClick={() => updateLicense(item.id, key)}
                          className={[
                            "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border",
                            item.license === key
                              ? "bg-primary text-white border-primary"
                              : "border-outline-variant text-on-surface-variant hover:border-outline",
                          ].join(" ")}
                        >
                          {c.licenseTypes[key]} · {formatKRW(displayPrice(key, item.id), copy.locale)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between shrink-0">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-outline hover:text-error transition-colors"
                      aria-label={c.remove}
                    >
                      <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                    <p className="font-headline font-bold text-on-surface">{formatKRW(displayPrice(item.license, item.id), copy.locale)}</p>
                  </div>
                </div>
              ))}

              <Link href="/library" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline w-fit mt-2">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                {c.continueBtn}
              </Link>
            </div>

            {/* Summary */}
            <div className="lg:col-span-4">
              <div className="bg-surface-container-lowest shadow-ghost p-6 sticky top-28">
                <h2 className="font-headline font-bold text-on-surface mb-6 text-lg">Order Summary</h2>

                <div className="flex flex-col gap-3 text-sm mb-6">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{c.subtotal}</span>
                    <span className="text-on-surface font-medium">{formatKRW(subtotal, copy.locale)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{c.vat}</span>
                    <span className="text-on-surface font-medium">{formatKRW(vat, copy.locale)}</span>
                  </div>
                  <div className="border-t border-outline-variant/20 pt-3 flex justify-between font-bold text-base">
                    <span className="text-on-surface">{c.total}</span>
                    <span className="text-primary">{formatKRW(total, copy.locale)}</span>
                  </div>
                </div>

                <Link
                  href="/checkout"
                  className="block w-full py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest text-center rounded hover:opacity-90 transition-opacity"
                >
                  {c.checkoutBtn}
                </Link>

                <div className="mt-4 flex items-center justify-center gap-1 text-[10px] text-outline">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Secured by Toss Payments
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
