"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";
import { useCart } from "@/lib/store/cart";
import { useRouter } from "next/navigation";
import { thumbnailUrlFromPreviewUrl } from "@/lib/supabase/storage";
import { buyerUsageConditions, creditLineForName, getCopyrightLicense, getFreeUsagePolicy } from "@/lib/licenses/creative-commons";
import { useLang } from "@/lib/i18n/store";

export interface ImageCardData {
  id: string;
  assetId?: string;
  title: string;
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
  initialFavorited?: boolean;
  onFavorite?: (id: string, favorited: boolean) => void;
  onAddToCart?: (id: string) => void;
  onQuickView?: (id: string) => void;
  className?: string;
}

export function ImageCard({
  image,
  initialFavorited = false,
  onFavorite,
  onAddToCart,
  onQuickView,
  className,
}: ImageCardProps) {
  const { t } = useLang();
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [favoriting, setFavoriting] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  const addItem = useCart((s) => s.addItem);
  const router = useRouter();

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
      title: image.title,
      photographer: image.photographer ?? "",
      src: image.src,
      category: image.category,
      license: "editorial",
      creditLine: creditLineForName(image.photographer),
      usageConditions: usageConditions.map((condition) => condition.label),
    });
    onAddToCart?.(image.id);
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1500);
  }

  const copyrightLicense = getCopyrightLicense(image.copyrightLicense);
  const freeUsagePolicy = getFreeUsagePolicy(image.freeUsagePolicy);
  const usageConditions = buyerUsageConditions({
    copyrightLicense: image.copyrightLicense,
    freeUsagePolicy: image.freeUsagePolicy,
  });

  return (
    <div
      className={cn(
        "masonry-item group relative overflow-hidden bg-surface-container-low cursor-pointer",
        className
      )}
    >
      {/* 이미지 */}
      <Image
        src={thumbnailUrlFromPreviewUrl(image.src, 640, 480)}
        alt={image.alt}
        width={image.width}
        height={image.height}
        className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
        unoptimized
      />

      {/* 호버 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        <div className="flex justify-between items-end backdrop-blur-md bg-white/10 p-4 rounded-lg text-white">
          {/* 메타데이터 */}
          <div
            className="flex-1 min-w-0"
            onClick={() => onQuickView?.(image.id)}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mb-1">
              {image.category}
            </p>
            <h3 className="font-headline font-bold text-sm tracking-tight truncate">
              {image.title}
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
          <div className="flex gap-2 ml-3 shrink-0">
            <button
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
