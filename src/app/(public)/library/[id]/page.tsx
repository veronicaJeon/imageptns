"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/i18n/store";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils/cn";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";

const LICENSE_PRICES: Record<string, number> = {
  editorial:  15000,
  commercial: 55000,
  extended:  180000,
};

type LicenseKey = "editorial" | "commercial" | "extended";

export default function ImageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLang();
  const d = t.imageDetail;
  const router = useRouter();

  const [imageData, setImageData]     = useState<any>(null);
  const [similar, setSimilar]         = useState<ImageCardData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [notFound, setNotFound]       = useState(false);

  const [license, setLicense]         = useState<LicenseKey>("editorial");
  const [isFavorited, setFavorited]   = useState(false);
  const [favLoading, setFavLoading]   = useState(false);
  const [cartFeedback, setCartFeedback] = useState<"idle" | "added">("idle");
  const [shareFeedback, setShareFeedback] = useState<"idle" | "copied">("idle");
  const addItem = useCart((s) => s.addItem);

  useEffect(() => {
    fetch(`/api/images/${id}`)
      .then(async (res) => {
        if (!res.ok) { setNotFound(true); return; }
        const { image, similar: sim } = await res.json();
        setImageData(image);
        setSimilar(sim ?? []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Check favorite status
  useEffect(() => {
    fetch(`/api/favorites/${id}`)
      .then((r) => r.json())
      .then(({ favorited }) => setFavorited(!!favorited))
      .catch(() => {});
  }, [id]);

  async function toggleFavorite() {
    if (favLoading) return;
    setFavLoading(true);
    const next = !isFavorited;
    setFavorited(next);
    try {
      if (next) {
        const res = await fetch("/api/favorites", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: id }),
        });
        if (res.status === 401) {
          setFavorited(!next);
          router.push(`/login?next=/library/${id}`);
          return;
        }
      } else {
        await fetch(`/api/favorites/${id}`, { method: "DELETE" });
      }
    } catch {
      setFavorited(!next);
    } finally {
      setFavLoading(false);
    }
  }

  function handleAddToCart() {
    if (!imageData) return;
    const photographer = imageData.photographer?.full_name ?? "";
    addItem({
      id,
      title:        imageData.title,
      photographer,
      src:          imageData.storage_path_preview ?? "",
      category:     imageData.category,
      license,
    });
    setCartFeedback("added");
    setTimeout(() => setCartFeedback("idle"), 2000);
  }

  const licenseKeys: LicenseKey[] = ["editorial", "commercial", "extended"];

  if (loading) {
    return (
      <div className="pt-36 min-h-screen bg-surface flex items-center justify-center">
        <span className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !imageData) {
    return (
      <div className="pt-36 min-h-screen bg-surface flex flex-col items-center justify-center gap-4 text-outline">
        <span className="material-symbols-outlined text-6xl">image_not_supported</span>
        <p>Image not found.</p>
        <Link href="/library" className="text-primary font-bold text-sm hover:underline">← Back to Library</Link>
      </div>
    );
  }

  const photographer = imageData.photographer?.display_name || imageData.photographer?.full_name || "Unknown";
  const photographerId = imageData.photographer?.id;

  const uploadedDate = new Date(imageData.approved_at ?? imageData.created_at)
    .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  const shotAtDate = imageData.exif_taken_at
    ? new Date(imageData.exif_taken_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
    : null;

  const shotLocation = (imageData.exif_location && imageData.exif_location !== "unknown")
    ? imageData.exif_location
    : imageData.exif_location === "unknown" ? "미상" : null;

  const resolutionStr = imageData.width && imageData.height
    ? `${Number(imageData.width).toLocaleString()} × ${Number(imageData.height).toLocaleString()} px`
    : null;

  function handleShare() {
    const url = window.location.href;
    const tryClipboard = () =>
      navigator.clipboard.writeText(url).then(() => {
        setShareFeedback("copied");
        setTimeout(() => setShareFeedback("idle"), 2000);
      });

    if (navigator.clipboard) {
      tryClipboard().catch(() => prompt("링크를 복사하세요:", url));
    } else {
      prompt("링크를 복사하세요:", url);
    }
  }

  return (
    <>
      {/* ── Breadcrumb ── */}
      <div className="pt-28 pb-6 px-6 md:px-12 bg-surface">
        <nav className="flex items-center gap-2 text-xs text-outline">
          <Link href="/library" className="hover:text-primary transition-colors">Library</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-on-surface-variant">{imageData.title}</span>
        </nav>
      </div>

      {/* ── Main grid ── */}
      <section className="px-6 md:px-12 pb-24 bg-surface">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* Image */}
          <div className="lg:col-span-7">
            <div className="relative overflow-hidden shadow-ghost bg-surface-container-low">
              {imageData.storage_path_preview ? (
                <img
                  src={imageData.storage_path_preview}
                  alt={imageData.title}
                  className="w-full h-auto object-cover"
                />
              ) : (
                <div className="aspect-[4/3] flex items-center justify-center text-outline">
                  <span className="material-symbols-outlined text-6xl">image</span>
                </div>
              )}
            </div>
          </div>

          {/* Details panel */}
          <div className="lg:col-span-5 flex flex-col gap-8">

            {/* Meta */}
            <div>
              <p className="text-xs font-bold text-outline uppercase tracking-[0.3em] mb-3 capitalize">
                {imageData.category}
              </p>
              <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface mb-2">
                {imageData.title}
              </h1>
              <p className="text-on-surface-variant text-sm">
                {d.by}{" "}
                {photographerId ? (
                  <Link
                    href={`/photographer/${photographerId}`}
                    className="text-on-surface font-semibold hover:text-primary transition-colors underline-offset-2 hover:underline"
                  >
                    {photographer}
                  </Link>
                ) : (
                  <span className="text-on-surface font-semibold">{photographer}</span>
                )}
              </p>
              {imageData.description && (
                <p className="text-on-surface-variant text-sm mt-3 leading-relaxed">{imageData.description}</p>
              )}
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
                    <span className="text-sm font-bold text-primary">
                      ₩{LICENSE_PRICES[key].toLocaleString("ko-KR")}
                    </span>
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
                  onClick={toggleFavorite}
                  disabled={favLoading}
                  className={[
                    "flex-1 py-3 rounded border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50",
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
                <button
                  onClick={handleShare}
                  className={cn(
                    "flex-1 py-3 rounded border text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                    shareFeedback === "copied"
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-outline-variant text-on-surface-variant hover:border-outline"
                  )}
                >
                  <span className="material-symbols-outlined text-base">
                    {shareFeedback === "copied" ? "check" : "share"}
                  </span>
                  {shareFeedback === "copied" ? d.copied : d.share}
                </button>
              </div>
            </div>

            {/* Asset details */}
            <div className="border-t border-outline-variant/20 pt-6 grid grid-cols-2 gap-4">
              {([
                { label: d.details.format,       value: imageData.file_format ?? "—" },
                { label: d.resolution,            value: resolutionStr ?? "—" },
                { label: d.details.size,          value: imageData.file_size_mb ? `${imageData.file_size_mb} MB` : "—" },
                { label: d.details.uploaded,      value: uploadedDate },
                shotAtDate    ? { label: d.details.shotAt,       value: shotAtDate }    : null,
                shotLocation  ? { label: d.details.shotLocation,  value: shotLocation }  : null,
                { label: d.details.id,            value: imageData.asset_id ?? "—" },
              ]).filter((x): x is { label: string; value: string } => x !== null).map(({ label, value }) => (
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
      {similar.length > 0 && (
        <section className="py-16 px-6 md:px-12 bg-surface-container-low">
          <div className="max-w-7xl mx-auto">
            <h2 className="font-headline text-xl font-extrabold text-on-surface mb-8 tracking-tight uppercase">
              {d.similarTitle}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similar.map((img) => (
                <Link key={img.id} href={`/library/${img.id}`}>
                  <ImageCard image={img} />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
