"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n/store";

export default function FavoritesPage() {
  const { t } = useLang();
  const fav = t.dashboard.favorites;
  const [items, setItems]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then((r) => r.json())
      .then(({ favorites }) => setItems(favorites ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function remove(imageId: string) {
    setItems((prev) => prev.filter((i) => i.image?.id !== imageId));
    await fetch(`/api/favorites/${imageId}`, { method: "DELETE" });
  }

  if (loading) {
    return (
      <div className="p-6 md:p-10 flex items-center justify-center min-h-[40vh]">
        <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-headline text-2xl font-extrabold text-on-surface mb-8 tracking-tight">
        {fav.title}
        <span className="ml-3 text-sm font-body font-normal text-outline">({items.length})</span>
      </h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-outline">
          <span className="material-symbols-outlined text-6xl">favorite_border</span>
          <p className="text-base">{fav.empty}</p>
          <Link href="/library" className="mt-2 px-6 py-3 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-opacity">
            {fav.emptyBtn}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item: any) => {
            const img  = item.image;
            const id   = img?.id ?? item.image_id;
            const isDeleted = !img || (img.status && img.status !== "approved");
            const title = img?.title ?? "삭제된 이미지";
            const category = img?.category ?? "";
            const photographer = img?.photographer?.full_name ?? "";
            const src   = img?.storage_path_preview ?? "";
            const savedAt = new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            });
            return (
              <div key={item.id} className="bg-surface-container-lowest shadow-ghost overflow-hidden group">
                {/* Thumbnail */}
                {isDeleted ? (
                  <div className="aspect-[4/3] bg-surface-container-low flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-outline">hide_image</span>
                    <span className="text-xs text-outline">삭제된 이미지</span>
                  </div>
                ) : (
                  <Link href={`/library/${id}`}>
                    <div className="relative overflow-hidden aspect-[4/3] bg-surface-container-low">
                      {src ? (
                        <img src={src} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="material-symbols-outlined text-outline text-4xl">image</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </Link>
                )}

                {/* Info row */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {category && <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">{category}</p>}
                    {isDeleted ? (
                      <p className="text-sm font-semibold text-outline line-through truncate">삭제된 이미지</p>
                    ) : (
                      <Link href={`/library/${id}`}>
                        <p className="text-sm font-semibold text-on-surface truncate hover:text-primary transition-colors">{title}</p>
                      </Link>
                    )}
                    <p className="text-xs text-outline mt-0.5">{photographer}{photographer && " · "}{savedAt}</p>
                  </div>
                  {/* Heart — always filled red since it IS favorited */}
                  <button
                    onClick={() => remove(id)}
                    className="shrink-0 w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors"
                    aria-label={fav.removeBtn}
                  >
                    <span
                      className="material-symbols-outlined text-xl text-error"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >favorite</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
