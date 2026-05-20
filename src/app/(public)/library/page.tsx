"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/i18n/store";
import Link from "next/link";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";
import { CategoryPill } from "@/components/ui/CategoryPill";
import { COPYRIGHT_LICENSES, type CopyrightLicenseCode } from "@/lib/licenses/creative-commons";

const PAGE_SIZE = 20;

const CATEGORY_KEYS = ["all", "nature", "people", "editorial", "urban", "abstract", "architecture"] as const;
type CategoryKey = typeof CATEGORY_KEYS[number];

const SORT_KEYS = ["newest", "popular", "relevant"] as const;
type SortKey = typeof SORT_KEYS[number];

const CC_LICENSE_FILTERS = COPYRIGHT_LICENSES.filter((license) => license.code !== "standard");

function AdRail({ side }: { side: "left" | "right" }) {
  return (
    <aside className="hidden 2xl:block">
      <div className="sticky top-36 h-[640px] rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest/70 px-4 py-5 text-center text-outline">
        <p className="text-[10px] font-bold uppercase tracking-widest">Advertisement</p>
        <div className="mt-6 flex h-[560px] items-center justify-center rounded-md bg-surface-container-low text-xs leading-relaxed">
          Google AdSense
          <br />
          {side === "left" ? "Left Rail" : "Right Rail"}
        </div>
      </div>
    </aside>
  );
}

/* ── Page ───────────────────────────────────────────────── */
export default function LibraryPage() {
  const { t } = useLang();
  const l = t.library;

  const [query, setQuery]             = useState("");
  const [category, setCategory]       = useState<CategoryKey>("all");
  const [sort, setSort]               = useState<SortKey>("newest");
  const [selectedLicenses, setSelectedLicenses] = useState<CopyrightLicenseCode[]>([]);
  const [freeOnly, setFreeOnly]       = useState(false);
  const [images, setImages]           = useState<ImageCardData[]>([]);
  const [offset, setOffset]           = useState(0);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [liveStats, setLiveStats]     = useState<{ images: number; photographers: number; orders: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const blurTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef   = useRef<HTMLDivElement | null>(null);
  const observerRef   = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false); // prevents concurrent fetches

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

  // Fetch a single page of images
  const fetchPage = useCallback(async (currentOffset: number, replace: boolean) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    if (replace) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), offset: String(currentOffset) });
      if (category !== "all") params.set("category", category);
      if (debouncedQuery)     params.set("query", debouncedQuery);
      selectedLicenses.forEach((license) => params.append("license", license));
      if (freeOnly) params.set("free", "true");

      const res = await fetch(`/api/images?${params}`);
      if (!res.ok) throw new Error();
      const { images: data, hasMore: more } = await res.json();

      setImages((prev) => replace ? (data ?? []) : [...prev, ...(data ?? [])]);
      setHasMore(!!more);
      setOffset(currentOffset + PAGE_SIZE);
    } catch {
      if (replace) setImages([]);
    } finally {
      if (replace) setLoading(false);
      else setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [category, sort, debouncedQuery, selectedLicenses, freeOnly]);

  // Reset whenever filters change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchPage(0, true);
  }, [category, sort, debouncedQuery, selectedLicenses, freeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver: fires when the sentinel enters the viewport
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingRef.current) {
          fetchPage(offset, false);
        }
      },
      { rootMargin: "300px" }
    );

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
  }, [hasMore, offset, fetchPage]);

  function handleCategoryChange(key: CategoryKey) {
    setCategory(key);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  }

  function toggleLicense(code: CopyrightLicenseCode) {
    setSelectedLicenses((prev) => (
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    ));
  }

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
              <span className="material-symbols-outlined flex h-14 w-14 shrink-0 items-center justify-center text-2xl text-outline">
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
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Category pills */}
            <div className="flex flex-wrap gap-2">
              {CATEGORY_KEYS.map((key) => (
                <CategoryPill
                  key={key}
                  label={l.categories[key]}
                  active={category === key}
                  onClick={() => handleCategoryChange(key)}
                />
              ))}
            </div>

            {/* Sort + result count */}
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-outline font-medium">
                {loading ? "…" : `${images.length}${hasMore ? "+" : ""}`} {l.results}
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

          <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/20 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">CC</span>
            {CC_LICENSE_FILTERS.map((license) => (
              <label
                key={license.code}
                className={[
                  "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                  selectedLicenses.includes(license.code)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selectedLicenses.includes(license.code)}
                  onChange={() => toggleLicense(license.code)}
                  className="sr-only"
                />
                {license.label.replace(" 4.0", "")}
              </label>
            ))}
            <label
              className={[
                "ml-0 flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors md:ml-2",
                freeOnly
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={freeOnly}
                onChange={(e) => setFreeOnly(e.target.checked)}
                className="sr-only"
              />
              <span className="material-symbols-outlined text-sm">redeem</span>
              무료
            </label>
          </div>
        </div>
      </div>

      {/* ── Gallery ───────────────────────────────── */}
      <section className="py-12 px-6 md:px-8 bg-surface-container-low min-h-[60vh]">
        <div className="mx-auto grid max-w-[1680px] gap-8 2xl:grid-cols-[160px_minmax(0,1fr)_160px]">
          <AdRail side="left" />
          <div className="min-w-0">
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
              <>
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

                {/* Sentinel — IntersectionObserver target */}
                <div ref={sentinelRef} className="h-px" />

                {/* Loading more spinner */}
                {loadingMore && (
                  <div className="flex justify-center py-12">
                    <span className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* End of results */}
                {!hasMore && images.length > 0 && (
                  <p className="text-center text-xs text-outline uppercase tracking-widest py-12">
                    — {images.length} {l.results} —
                  </p>
                )}
              </>
            )}
          </div>
          <AdRail side="right" />
        </div>
      </section>
    </>
  );
}
