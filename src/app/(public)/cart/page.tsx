"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { useLang } from "@/lib/i18n/store";
import { useCart, LicenseType, getLicensePrice } from "@/lib/store/cart";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";
import { imageCategoryLabel } from "@/lib/images/categories";

const LICENSE_KEYS: LicenseType[] = ["editorial", "commercial", "extended"];

const CART_PAGE_COPY = {
  ko: {
    locale: "ko-KR",
    defaultUsageCondition: "저작자 표시 필요",
    printStatement: "PDF 내역서 인쇄",
    creditLine: "저작자 표시",
    purchaseOptions: "구매 옵션",
    bankTransferNote: "계좌이체 요청 후 관리자가 입금을 확인하면 원본 사용 권한이 열립니다.",
  },
  en: {
    locale: "en-US",
    defaultUsageCondition: "Credit required",
    printStatement: "Print PDF statement",
    creditLine: "Credit line",
    purchaseOptions: "Purchase option",
    bankTransferNote: "Original usage rights open after an administrator confirms your bank transfer.",
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
  const { items, removeItem, updateLicense, startCartCheckout } = useCart();
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

  return (
    <div className="pt-32 pb-24 px-6 md:px-8 bg-surface min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight">
            {c.title}
            {items.length > 0 && <span className="ml-3 text-sm font-body font-normal text-outline">({items.length})</span>}
          </h1>
          {items.length > 0 && (
            <Link
              href="/cart/statement?print=1"
              className="flex w-fit items-center gap-2 rounded bg-surface-container-lowest px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface shadow-ghost transition-colors hover:text-primary"
            >
              <span className="material-symbols-outlined text-base">print</span>
              {copy.printStatement}
            </Link>
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
                <div key={item.id} className="bg-surface-container-lowest shadow-ghost p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:gap-4">
                  <Link href={`/library/${item.id}`} className="flex h-40 w-full shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-low sm:h-40 sm:w-40">
                    <NextImage
                      src={thumbnailUrlFromPreviewUrl(item.src, 320, 320)}
                      alt={item.title}
                      width={160}
                      height={160}
                      className="h-full w-full object-contain"
                      unoptimized
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{imageCategoryLabel(item.category, lang)}</p>
                    <Link href={`/library/${item.id}`}>
                      <p className="font-semibold text-on-surface hover:text-primary transition-colors truncate">{item.title}</p>
                    </Link>
                    {item.photographer && (
                      <p className="text-xs text-outline mt-0.5">{item.photographer}</p>
                    )}
                    <p className="mt-2 text-xs text-on-surface-variant">
                      {copy.creditLine}: <span className="font-semibold text-on-surface">{itemCreditLine(item)}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {itemUsageConditions(item, copy.defaultUsageCondition).map((condition) => (
                        <span key={condition} className="rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-bold text-on-surface-variant">
                          {condition}
                        </span>
                      ))}
                    </div>

                    {/* License selector */}
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-outline">{copy.purchaseOptions}</p>
                    <div className="grid grid-cols-3 gap-1.5 mt-2 sm:flex sm:flex-wrap sm:gap-2 sm:mt-3">
                      {LICENSE_KEYS.map((key) => (
                        <button
                          key={key}
                          onClick={() => updateLicense(item.id, key)}
                          className={[
                            "min-w-0 rounded-full border px-1.5 py-1.5 text-[9px] font-bold uppercase leading-tight transition-all sm:px-3 sm:py-1 sm:text-[10px] sm:tracking-widest",
                            item.license === key
                              ? "bg-primary text-white border-primary"
                              : "border-outline-variant text-on-surface-variant hover:border-outline",
                          ].join(" ")}
                        >
                          <span className="block truncate">{c.licenseTypes[key]}</span>
                          <span className="block text-[8px] font-semibold sm:inline sm:text-[10px]"> {formatKRW(displayPrice(key, item.id), copy.locale)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:flex-col sm:items-end sm:shrink-0">
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
                  onClick={startCartCheckout}
                  className="block w-full py-4 bg-primary text-white text-xs font-bold uppercase tracking-widest text-center rounded hover:opacity-90 transition-opacity"
                >
                  {c.checkoutBtn}
                </Link>

                <div className="mt-4 flex items-start justify-center gap-1.5 text-center text-[10px] leading-relaxed text-outline">
                  <span className="material-symbols-outlined mt-0.5 text-sm">account_balance</span>
                  <span>{copy.bankTransferNote}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
