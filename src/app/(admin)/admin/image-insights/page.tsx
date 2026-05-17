"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type SortKey = "views" | "sales" | "favorites";

interface InsightImage {
  id: string;
  title: string;
  category: string;
  photographer: string;
  src: string;
  value: number;
}

const SORT_OPTIONS: { key: SortKey; label: string; icon: string; unit: string }[] = [
  { key: "views",     label: "조회수",  icon: "visibility",     unit: "views"      },
  { key: "sales",     label: "판매수",  icon: "shopping_cart",  unit: "sales"      },
  { key: "favorites", label: "찜 수",   icon: "favorite",       unit: "favorites"  },
];

export default function ImageInsightsPage() {
  const [sort, setSort] = useState<SortKey>("views");
  const [images, setImages] = useState<InsightImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(async (s: SortKey) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/image-insights?sort=${s}&limit=20`);
      if (res.status === 403) { setForbidden(true); return; }
      const { images: imgs } = await res.json();
      setImages(imgs ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(sort); }, [sort, load]);

  if (forbidden) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-4 text-outline">
        <span className="material-symbols-outlined text-5xl">lock</span>
        <p className="font-bold">관리자 권한이 필요합니다.</p>
      </div>
    );
  }

  const currentSort = SORT_OPTIONS.find((o) => o.key === sort)!;

  return (
    <div className="p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight mb-8">
          이미지 인사이트
        </h1>

        {/* Sort tabs */}
        <div className="flex gap-2 mb-8">
          {SORT_OPTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={[
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                sort === key
                  ? "bg-primary text-white"
                  : "bg-surface-container-lowest text-on-surface-variant border border-outline-variant/40 hover:border-outline-variant",
              ].join(" ")}
            >
              <span className="material-symbols-outlined text-base">{icon}</span>
              {label} TOP 20
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-3 text-outline">
            <span className="material-symbols-outlined text-5xl">bar_chart</span>
            <p className="text-sm">데이터가 없습니다.</p>
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl shadow-ghost overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-left px-5 py-3.5 text-[10px] font-bold text-outline uppercase tracking-widest w-10">#</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold text-outline uppercase tracking-widest">이미지</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold text-outline uppercase tracking-widest hidden md:table-cell">카테고리</th>
                  <th className="text-left px-4 py-3.5 text-[10px] font-bold text-outline uppercase tracking-widest hidden lg:table-cell">작가</th>
                  <th className="text-right px-5 py-3.5 text-[10px] font-bold text-outline uppercase tracking-widest">
                    <span className="flex items-center justify-end gap-1">
                      <span className="material-symbols-outlined text-sm">{currentSort.icon}</span>
                      {currentSort.label}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {images.map((img, idx) => (
                  <tr key={img.id} className="border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors">
                    <td className="px-5 py-3 text-xs font-bold text-outline">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <Link href={`/library/${img.id}`} target="_blank" className="flex items-center gap-3 group">
                        <div className="w-12 h-8 rounded overflow-hidden bg-surface-container shrink-0">
                          {img.src ? (
                            <img src={img.src} alt={img.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="flex items-center justify-center w-full h-full material-symbols-outlined text-sm text-outline">image</span>
                          )}
                        </div>
                        <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors line-clamp-1">{img.title}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs font-semibold text-on-surface-variant capitalize px-2 py-1 bg-surface-container rounded">
                        {img.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant hidden lg:table-cell">{img.photographer}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="text-sm font-bold text-on-surface">
                        {img.value.toLocaleString("ko-KR")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
