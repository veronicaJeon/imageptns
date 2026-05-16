"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/i18n/store";
import Link from "next/link";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";
import { CategoryPill } from "@/components/ui/CategoryPill";

const CATEGORY_KEYS = ["all", "nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const SORT_KEYS = ["newest", "popular", "relevant"] as const;
type SortKey = typeof SORT_KEYS[number];

/* ── Page ───────────────────────────────────────────────── */
export default function LibraryPage() {
  const { t } = useLang();
  const l = t.library;

  const [query, setQuery]       = useState("");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [sort, setSort]         = useState<SortKey>("newest");
  const [images, setImages]     = useState<ImageCardData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [liveStats, setLiveStats] = useState<{ images: number; photographers: number; orders: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setLiveStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: { suggestions: string[] }) => {
          setSuggestions(data.suggestions ?? []);
          setShowSuggestions((data.suggestions ?? []).length > 0);
        })
        .catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "40" });
      if (category !== "all") params.set("category", category);
      if (debouncedQuery)     params.set("query", debouncedQuery);

      const res = await fetch(`/api/images?${params}`);
      if (!res.ok) throw new Error();
      const { images: data } = await res.json();
      setImages(data ?? []);
    } catch {
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [category, sort, debouncedQuery]);

  useEffect(() => { fetchImages(); }, [fetchImages]);

  return (
    <>
      {/* ── Hero / Search ─────────────────────────── */}
      <section className="pt-36 pb-16 px-6 md:px-16 bg-surface">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-headline text-4xl md:text-6xl font-extrabold tracking-tighter text-on-surface mb-4">
            {l.hero.headline}
          </h1>
          <p className="text-on-surface-variant mb-10 text-lg">{l.hero.sub}</p>

          {/* Search bar */}
          <div className="relative">
            <div className="flex items-center bg-surface-container-lowest shadow-ghost rounded-lg overflow-hidden">
              <span className="material-symbols-outlined text-outline pl-5 pr-3 text-2xl shrink-0">
                search
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={l.hero.searchPlaceholder}
                className="flex-1 py-5 pr-5 bg-transparent text-on-surface placeholder:text-outline text-base outline-none"
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => {
                  blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
                }}
                onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
                  className="px-4 text-outline hover:text-on-surface transition-colors"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined text-xl">close</span>
                </button>
              )}
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg overflow-hidden">
                {suggestions.map((s) => (
                  <li key={s}>
                    <button
                      className="w-full text-left px-5 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
                      onMouseDown={() => {
                        if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                        setQuery(s);
                        setShowSuggestions(false);
                      }}
                    >
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-10 mt-8 text-xs font-bold uppercase tracking-widest text-outline">
            {liveStats ? (
              <>
                <span>{liveStats.images.toLocaleString("ko-KR")}+ {l.stats.assets.split("+").slice(-1)[0].trim()}</span>
                <span>{liveStats.photographers.toLocaleString("ko-KR")}+ {l.stats.photographers.split("+").slice(-1)[0].trim()}</span>
                <span>{l.stats.countries}</span>
              </>
            ) : (
              Object.values(l.stats).map((stat) => (
                <span key={stat}>{stat}</span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Filter Bar ────────────────────────────── */}
      <div className="sticky top-20 z-40 bg-surface/80 backdrop-blur-md border-b border-outline-variant/20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          {/* Category pills */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_KEYS.map((key) => (
              <CategoryPill
                key={key}
                label={l.categories[key]}
                active={category === key}
                onClick={() => setCategory(key)}
              />
            ))}
          </div>

          {/* Sort + result count */}
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-outline font-medium">
              {loading ? "…" : images.length} {l.results}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-outline uppercase tracking-widest hidden sm:inline">
                {l.sort.label}
              </span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="text-xs font-bold bg-surface-container-low text-on-surface px-3 py-2 rounded-full outline-none cursor-pointer border-none"
              >
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k}>{l.sort[k]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gallery ───────────────────────────────── */}
      <section className="py-12 px-6 md:px-8 bg-surface-container-low min-h-[60vh]">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-40 text-outline">
              <span className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4 text-outline">
              <span className="material-symbols-outlined text-6xl">image_search</span>
              <p className="text-base">{l.noResults}</p>
            </div>
          ) : (
            <MasonryGrid>
              {images.map((img) => (
                <Link key={img.id} href={`/library/${img.id}`}>
                  <ImageCard
                    image={img}
                    className="mb-4 break-inside-avoid"
                  />
                </Link>
              ))}
            </MasonryGrid>
          )}
        </div>
      </section>
    </>
  );
}
