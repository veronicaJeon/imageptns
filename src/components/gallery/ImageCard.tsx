"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import { useCart } from "@/lib/store/cart";
import { useRouter } from "next/navigation";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";
import { buyerUsageConditions, creditLineForName, getLocalizedCopyrightLicense, getLocalizedFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import { useLang } from "@/lib/i18n/store";
import { imageCategoryLabel } from "@/lib/images/categories";

export interface ImageCardData {
  id: string;
  assetId?: string;
  title: string;
  titleKo?: string | null;
  titleEn?: string | null;
  category: string;
  src: string;
  alt: string;
  photographerId?: string | null;
  photographer?: string;
  width: number;
  height: number;
  copyrightLicense?: string | null;
  freeUsagePolicy?: string | null;
}

interface ImageCardProps {
  image: ImageCardData;
  href?: string;
  initialFavorited?: boolean;
  onFavorite?: (id: string, favorited: boolean) => void;
  onAddToCart?: (id: string) => void;
  onQuickView?: (id: string) => void;
  className?: string;
}

export function ImageCard({
  image,
  href,
  initialFavorited = false,
  onFavorite,
  onAddToCart,
  onQuickView,
  className,
}: ImageCardProps) {
  const { t, lang } = useLang();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [favoriting, setFavoriting] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const addItem = useCart((s) => s.addItem);
  const router = useRouter();
  const displayTitle = lang === "ko"
    ? image.titleKo || image.title
    : image.titleEn || image.title;
  const displayCategory = imageCategoryLabel(image.category, lang);

  async function handleFavorite() {
    if (favoriting) return;
    setFavoriting(true);
    const next = !isFavorited;
    setIsFavorited(next);
    try {
      if (next) {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_id: image.id }),
        });
        if (res.status === 401) { setIsFavorited(false); router.push("/login"); return; }
      } else {
        await fetch(`/api/favorites/${image.id}`, { method: "DELETE" });
      }
      onFavorite?.(image.id, next);
    } catch {
      setIsFavorited(!next); // revert on error
    } finally {
      setFavoriting(false);
    }
  }

  function handleAddToCart() {
    addItem({
      id: image.id,
      assetId: image.assetId,
      title: displayTitle,
      photographer: image.photographer ?? "",
      src: image.src,
      category: image.category,
      license: "editorial",
      creditLine: creditLineForName(image.photographer),
      usageConditions: usageConditions.map((condition) => condition.label),
      freeUsagePolicy: image.freeUsagePolicy,
    });
    onAddToCart?.(image.id);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1500);
  }

  const copyrightLicense = getLocalizedCopyrightLicense(image.copyrightLicense, lang);
  const freeUsagePolicy = getLocalizedFreeUsagePolicy(image.freeUsagePolicy, lang);
  const usageConditions = buyerUsageConditions({
    copyrightLicense: image.copyrightLicense,
    freeUsagePolicy: image.freeUsagePolicy,
    lang,
  });

  return (
    <div
      className={cn(
        "masonry-item group relative overflow-hidden rounded-xl bg-surface-container-low shadow-sm ring-1 ring-outline-variant/20 cursor-pointer transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-card",
        className
      )}
    >
      {href && (
        <Link
          href={href}
          aria-label={lang === "ko" ? `${displayTitle} 상세 보기` : `View details for ${displayTitle}`}
          className="absolute inset-0 z-10 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          onClick={() => onQuickView?.(image.id)}
        />
      )}

      {/* 이미지 */}
      <Image
        src={thumbnailUrlFromPreviewUrl(image.src, 640, 480)}
        alt={displayTitle || image.alt}
        width={image.width}
        height={image.height}
        className="w-full h-auto object-cover group-hover:scale-[1.015] transition-transform duration-700"
        unoptimized
      />

      {/* 호버 오버레이 */}
      <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end bg-gradient-to-t from-black/75 via-black/5 to-transparent p-3 opacity-100 transition-opacity duration-300 sm:p-4 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <div className="flex items-end justify-between rounded-xl border border-white/15 bg-black/20 p-4 text-white backdrop-blur-md">
          {/* 메타데이터 */}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">
              {displayCategory}
            </p>
            <h3 className="font-headline font-bold text-sm tracking-tight truncate">
              {displayTitle}
            </h3>
            {image.photographer && (
              <p className="text-[10px] opacity-60 mt-0.5 truncate">{image.photographer}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {copyrightLicense.code !== "standard" && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                  {copyrightLicense.label.replace(" 4.0", "")}
                </span>
              )}
              {freeUsagePolicy.code !== "none" && (
                <span className="rounded-full bg-primary-container/90 px-2 py-0.5 text-[9px] font-bold text-on-primary-container">
                  {freeUsagePolicy.label}
                </span>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="pointer-events-auto relative z-30 ml-3 flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handleFavorite}
              disabled={favoriting}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 transition-colors flex items-center justify-center disabled:opacity-50"
              aria-label={t.library.favorite}
            >
              <span
                className="material-symbols-outlined text-lg"
                style={{
                  fontVariationSettings: isFavorited ? "'FILL' 1" : "'FILL' 0",
                  color: isFavorited ? "#00ff7b" : "white",
                }}
              >
                favorite
              </span>
            </button>

            <button
              type="button"
              onClick={handleAddToCart}
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                cartAdded
                  ? "bg-primary-container text-on-primary-container scale-110"
                  : "bg-primary-container text-on-primary-container hover:opacity-90"
              )}
              aria-label={t.library.addToCart}
            >
              <span className="material-symbols-outlined text-lg">
                {cartAdded ? "check" : "add_shopping_cart"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
