"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils/cn";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";

/* ── Mock data ─────────────────────────────────────────── */
const MOCK_DETAIL: Record<string, {
  title: string; category: string; photographer: string;
  src: string; width: number; height: number;
  resolution: string; format: string; size: string; uploaded: string; id: string;
}> = {
  "1":  { title: "Morning Mist Over Mountains",   category: "Nature",       photographer: "Elena Novak",    src: "https://picsum.photos/seed/mist1/1600/1100",     width: 1600, height: 1100, resolution: "7952 × 5304 px", format: "TIFF / JPEG", size: "48 MB",  uploaded: "Jan 12, 2026", id: "IP-00001" },
  "2":  { title: "Street Portrait — Seoul",        category: "People",       photographer: "James Okafor",   src: "https://picsum.photos/seed/portrait2/1600/1200", width: 1600, height: 1200, resolution: "6240 × 4680 px", format: "TIFF / JPEG", size: "36 MB",  uploaded: "Feb 3, 2026",  id: "IP-00002" },
  "3":  { title: "Tokyo at 3AM",                   category: "Urban",        photographer: "Aiko Tanaka",    src: "https://picsum.photos/seed/tokyo3/1600/900",     width: 1600, height: 900,  resolution: "8192 × 4608 px", format: "TIFF / JPEG", size: "55 MB",  uploaded: "Mar 1, 2026",  id: "IP-00003" },
  "default": { title: "Untitled Archive Image",    category: "Editorial",    photographer: "IMAGE PARTNERS", src: "https://picsum.photos/seed/default/1600/1000",   width: 1600, height: 1000, resolution: "5472 × 3648 px", format: "TIFF / JPEG", size: "30 MB",  uploaded: "Jan 1, 2026",  id: "IP-00000" },
};

const SIMILAR: ImageCardData[] = [
  { id: "7",  title: "Sahara Dunes",        category: "nature",   src: "https://picsum.photos/seed/sahara7/600/400",   alt: "Sahara dunes",   width: 600, height: 400 },
  { id: "13", title: "Glacial Lake",        category: "nature",   src: "https://picsum.photos/seed/glacier13/600/800", alt: "Glacial lake",   width: 600, height: 800 },
  { id: "5",  title: "Brutalist Geometry",  category: "architecture", src: "https://picsum.photos/seed/brutal5/600/750", alt: "Brutalist",    width: 600, height: 750 },
  { id: "9",  title: "Glass Towers",        category: "architecture", src: "https://picsum.photos/seed/frank9/600/700", alt: "Glass towers",  width: 600, height: 700 },
];

type LicenseKey = "editorial" | "commercial" | "extended";

export default function ImageDetailPage({ params }: { params: { id: string } }) {
  const { t } = useLang();
  const d = t.imageDetail;

  const image = MOCK_DETAIL[params.id] ?? MOCK_DETAIL["default"];
  const [license, setLicense]       = useState<LicenseKey>("editorial");
  const [isFavorited, setFavorited] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<"idle"|"added">("idle");
  const addItem = useCart((s) => s.addItem);

  function handleAddToCart() {
    addItem({
      id: params.id,
      title: image.title,
      photographer: image.photographer,
      src: image.src,
      category: image.category,
      license,
    });
    setCartFeedback("added");
    setTimeout(() => setCartFeedback("idle"), 2000);
  }

  const licenseKeys: LicenseKey[] = ["editorial", "commercial", "extended"];

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="pt-28 pb-6 px-6 md:px-12 bg-surface">
        <nav className="flex items-center gap-2 text-xs text-outline">
          <Link href="/library" className="hover:text-primary transition-colors">Library</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface-variant">{image.title}</span>
        </nav>
      </div>

      {/* ── Main grid ── */}
      <section className="px-6 md:px-12 pb-24 bg-surface">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Image */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden shadow-ghost bg-surface-container-low">
              <Image
                src={image.src}
                alt={image.title}
                width={image.width}
                height={image.height}
                className="w-full h-auto object-cover"
                unoptimized
                priority
              />
            </div>
          </div>

          {/* Details panel */}
          <div className="lg:col-span-5 flex flex-col gap-8">

            {/* Meta */}
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-[0.3em] mb-3">
                {image.category}
              </p>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
                {image.title}
              </h1>
              <p className="text-on-surface-variant text-sm">
                {d.by} <span className="text-on-surface font-semibold">{image.photographer}</span>
              </p>
            </div>

            {/* License selector */}
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-widest mb-4">{d.license}</p>
              <div className="flex flex-col gap-3">
                {licenseKeys.map((key) => (
                  <label
                    key={key}
                    className={[
                      "flex items-center justify-between px-5 py-4 rounded-lg cursor-pointer border-2 transition-all duration-200",
                      license === key
                        ? "border-primary bg-primary/5"
                        : "border-outline-variant/30 bg-surface-container-lowest hover:border-outline-variant",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="license"
                        value={key}
                        checked={license === key}
                        onChange={() => setLicense(key)}
                        className="sr-only"
                      />
                      <div className={[
                        "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                        license === key ? "border-primary" : "border-outline-variant",
                      ].join(" ")}>
                        {license === key && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="text-sm font-semibold text-on-surface">{d.licenseTypes[key]}</span>
                    </div>
                    <span className="text-sm font-bold text-primary">{d.prices[key]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleAddToCart}
                className={cn(
                  "w-full py-4 font-bold text-xs uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2",
                  cartFeedback === "added"
                    ? "bg-primary-container text-on-primary-container"
                    : "bg-primary text-white hover:opacity-90"
                )}
              >
                <span className="material-symbols-outlined text-base">
                  {cartFeedback === "added" ? "check" : "add_shopping_cart"}
                </span>
                {cartFeedback === "added" ? t.cart.addedToCart : d.addToCart}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setFavorited((v) => !v)}
                  className={[
                    "flex-1 py-3 rounded border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                    isFavorited
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-outline",
                  ].join(" ")}
                >
                  <span
                    className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: isFavorited ? "'FILL' 1" : "'FILL' 0" }}
                  >
                    favorite
                  </span>
                  {d.favorite}
                </button>
                <button className="flex-1 py-3 rounded border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:border-outline transition-colors">
                  <span className="material-symbols-outlined text-base">share</span>
                  {d.share}
                </button>
              </div>
            </div>

            {/* Asset details */}
            <div className="border-t border-outline-variant/20 pt-6 grid grid-cols-2 gap-4">
              {[
                { label: d.details.format,   value: image.format },
                { label: d.resolution,        value: image.resolution },
                { label: d.details.size,      value: image.size },
                { label: d.details.uploaded,  value: image.uploaded },
                { label: d.details.id,        value: image.id },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-outline uppercase tracking-widest font-bold mb-1">{label}</p>
                  <p className="text-sm text-on-surface font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Similar images ── */}
      <section className="py-16 px-6 md:px-12 bg-surface-container-low">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-headline text-xl font-extrabold text-on-surface mb-8 tracking-tight uppercase">
            {d.similarTitle}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SIMILAR.map((img) => (
              <Link key={img.id} href={`/library/${img.id}`}>
                <ImageCard image={img} />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
