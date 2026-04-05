"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { useState } from "react";

export interface ImageCardData {
  id: string;
  title: string;
  category: string;
  src: string;
  alt: string;
  photographer?: string;
  width: number;
  height: number;
}

interface ImageCardProps {
  image: ImageCardData;
  onFavorite?: (id: string) => void;
  onAddToCart?: (id: string) => void;
  onQuickView?: (id: string) => void;
  className?: string;
}

export function ImageCard({
  image,
  onFavorite,
  onAddToCart,
  onQuickView,
  className,
}: ImageCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);

  return (
    <div
      className={cn(
        "masonry-item group relative overflow-hidden bg-surface-container-low cursor-pointer",
        className
      )}
    >
      {/* 이미지 */}
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        className="w-full h-auto object-cover group-hover:scale-[1.02] transition-transform duration-700"
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
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-2 ml-3 shrink-0">
            <button
              onClick={() => {
                setIsFavorited((v) => !v);
                onFavorite?.(image.id);
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/30 transition-colors flex items-center justify-center"
              aria-label="즐겨찾기"
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
              onClick={() => onAddToCart?.(image.id)}
              className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container hover:opacity-90 transition-opacity flex items-center justify-center"
              aria-label="장바구니 추가"
            >
              <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
