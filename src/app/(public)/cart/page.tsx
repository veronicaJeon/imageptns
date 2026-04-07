"use client";

import Link from "next/link";
import Image from "next/image";
import { useLang } from "@/lib/i18n/store";
import { useCart, LicenseType, getLicensePrice } from "@/lib/store/cart";

const LICENSE_KEYS: LicenseType[] = ["editorial", "commercial", "extended"];

function formatKRW(n: number) {
  return "₩" + n.toLocaleString("ko-KR");
}

export default function CartPage() {
  const { t } = useLang();
  const c = t.cart;
  const { items, removeItem, updateLicense } = useCart();

  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const vat      = Math.round(subtotal * 0.1);
  const total    = subtotal + vat;

  return (
    <div className="pt-32 pb-24 px-6 md:px-8 bg-surface min-h-screen">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-headline text-3xl font-extrabold text-on-surface tracking-tight mb-10">
          {c.title}
          {items.length > 0 && <span className="ml-3 text-sm font-body font-normal text-outline">({items.length})</span>}
        </h1>

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
                    <Image
                      src={item.src}
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

                    {/* License selector */}
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
                          {c.licenseTypes[key]} · {formatKRW(getLicensePrice(key))}
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
                    <p className="font-headline font-bold text-on-surface">{formatKRW(item.price)}</p>
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
                    <span className="text-on-surface font-medium">{formatKRW(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">{c.vat}</span>
                    <span className="text-on-surface font-medium">{formatKRW(vat)}</span>
                  </div>
                  <div className="border-t border-outline-variant/20 pt-3 flex justify-between font-bold text-base">
                    <span className="text-on-surface">{c.total}</span>
                    <span className="text-primary">{formatKRW(total)}</span>
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
