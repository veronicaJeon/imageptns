"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/i18n/store";
import Link from "next/link";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";
import { CategoryPill } from "@/components/ui/CategoryPill";
import { buildPhotoRequestHref } from "@/lib/contact/photo-request-draft";
import { DEFAULT_IMAGE_CATEGORIES, type ImageCategory } from "@/lib/images/categories";

const PAGE_SIZE = 20;

const SORT_KEYS = ["newest", "popular", "relevant"] as const;
type SortKey = typeof SORT_KEYS[number];

const USAGE_FILTER_LABELS = {
  ko: {
    title: "사용 조건",
    free: "무료 사용 가능",
    educationFree: "교육용 무료",
    commercial: "상업 사용 가능",
    derivatives: "변경 가능",
  },
  en: {
    title: "Usage",
    free: "Free use",
    educationFree: "Free for education",
    commercial: "Commercial use",
    derivatives: "Modifications allowed",
  },
} as const;

const LIBRARY_PAGE_COPY = {
  ko: {
    locale: "ko-KR",
    filter: "필터",
    photoRequest: "사진 요청",
    requestWithConditions: "이 조건으로 사진 요청",
  },
  en: {
    locale: "en-US",
    filter: "Filters",
    photoRequest: "Request an image",
    requestWithConditions: "Request an image with these criteria",
  },
} as const;

function AdRail({ side }: { side: "left" | "right" }) {
  return (
    <aside className="hidden 2xl:block" aria-label={`${side} sponsored rail`}>
      <div className="sticky top-36 h-[640px] rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest/70 px-4 py-5 text-center text-outline">
        <p className="text-[10px] font-semibold text-on-surface-variant">Sponsored</p>
        <div className="mt-6 flex h-[560px] items-center justify-center rounded-md bg-surface-container-low px-3 text-xs leading-relaxed">
          광고 영역
        </div>
      </div>
    </aside>
  );
}

/* ── Page ───────────────────────────────────────────────── */
export default function LibraryPage() {
  const { t, lang } = useLang();
  const l = t.library;
  const usageLabels = USAGE_FILTER_LABELS[lang];
  const copy = LIBRARY_PAGE_COPY[lang];

  const [query, setQuery]             = useState("");
  const [category, setCategory]       = useState("all");
  const [categories, setCategories]   = useState<ImageCategory[]>(() => [...DEFAULT_IMAGE_CATEGORIES]);
  const [sort, setSort]               = useState<SortKey>("newest");
  const [freeOnly, setFreeOnly]       = useState(false);
  const [educationFreeOnly, setEducationFreeOnly] = useState(false);
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [derivativesOnly, setDerivativesOnly] = useState(false);
  const [images, setImages]           = useState<ImageCardData[]>([]);
  const [offset, setOffset]           = useState(0);
  const [hasMore, setHasMore]         = useState(true);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [liveStats, setLiveStats]     = useState<{ images: number; photographers: number; orders: number } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const blurTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef   = useRef<HTMLDivElement | null>(null);
  const observerRef   = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false); // prevents concurrent fetches
  const requestSeqRef = useRef(0);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setLiveStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data: { categories?: ImageCategory[] }) => {
        if (data.categories?.length) setCategories(data.categories);
      })
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
    if (!replace && isFetchingRef.current) return;

    const requestSeq = ++requestSeqRef.current;
    isFetchingRef.current = true;

    if (replace) {
      setLoading(true);
      setLoadingMore(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({ sort, limit: String(PAGE_SIZE), offset: String(currentOffset) });
      if (category !== "all") params.set("category", category);
      if (debouncedQuery)     params.set("query", debouncedQuery);
      if (freeOnly) params.set("free", "true");
      if (educationFreeOnly) params.set("educationFree", "true");
      if (commercialOnly) params.set("commercial", "true");
      if (derivativesOnly) params.set("derivatives", "true");

      const res = await fetch(`/api/images?${params}`);
      if (!res.ok) throw new Error();
      const { images: data, hasMore: more } = await res.json();

      if (requestSeq !== requestSeqRef.current) return;

      setImages((prev) => replace ? (data ?? []) : [...prev, ...(data ?? [])]);
      setHasMore(!!more);
      setOffset(currentOffset + PAGE_SIZE);
    } catch {
      if (requestSeq !== requestSeqRef.current) return;

      if (replace) setImages([]);
    } finally {
      if (requestSeq === requestSeqRef.current) {
        if (replace) {
          setLoading(false);
          setLoadingMore(false);
        } else {
          setLoadingMore(false);
        }
        isFetchingRef.current = false;
      }
    }
  }, [category, sort, debouncedQuery, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly]);

  // Reset whenever filters change
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchPage(0, true);
  }, [category, sort, debouncedQuery, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly]); // eslint-disable-line react-hooks/exhaustive-deps

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

  function handleCategoryChange(key: string) {
    setCategory(key);
    setShowSuggestions(false);
  }

  const photoRequestHref = buildPhotoRequestHref({
    query,
    category,
    freeOnly,
    educationFreeOnly,
    commercialOnly,
    derivativesOnly,
  });
  const activeFilterCount = [
    category !== "all",
    freeOnly,
    educationFreeOnly,
    commercialOnly,
    derivativesOnly,
  ].filter(Boolean).length;
  const usageFilters = [
    { label: usageLabels.free, checked: freeOnly, onChange: setFreeOnly, icon: "redeem" },
    { label: usageLabels.educationFree, checked: educationFreeOnly, onChange: setEducationFreeOnly, icon: "school" },
    { label: usageLabels.commercial, checked: commercialOnly, onChange: setCommercialOnly, icon: "business_center" },
    { label: usageLabels.derivatives, checked: derivativesOnly, onChange: setDerivativesOnly, icon: "edit" },
  ];
  const categoryOptions = [
    { code: "all", label: l.categories.all },
    ...categories.map((item) => ({ code: item.code, label: item[lang] })),
  ];

  return (
    <>
      {/* ── Hero / Search ─────────────────────────── */}
      <section className="pt-36 pb-16 px-6 md:px-16 bg-surface">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="font-headline text-4xl md:text-6xl font-extrabold text-on-surface mb-4">
            {l.hero.headline}
          </h1>
          <p className="text-on-surface-variant mb-10 text-lg">{l.hero.sub}</p>

          {/* Search bar */}
          <div className="relative">
            <div className="relative overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-low shadow-ghost ring-1 ring-black/5 transition-colors focus-within:border-primary/60 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
              <span className="material-symbols-outlined pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-2xl leading-none text-outline">
                search
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={l.hero.searchPlaceholder}
                className="h-16 w-full bg-transparent pl-14 pr-12 text-base text-on-surface placeholder:text-outline outline-none"
                onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                onBlur={() => {
                  blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150);
                }}
                onKeyDown={(e) => { if (e.key === "Escape") setShowSuggestions(false); }}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-outline transition-colors hover:text-on-surface"
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
          <div className="flex justify-center gap-6 mt-8 text-xs font-semibold text-outline sm:gap-10">
            {liveStats ? (
              <>
                <span>{liveStats.images.toLocaleString(copy.locale)}+ {l.stats.assets.split("+").slice(-1)[0].trim()}</span>
                <span>{liveStats.photographers.toLocaleString(copy.locale)}+ {l.stats.photographers.split("+").slice(-1)[0].trim()}</span>
              </>
            ) : (
              [l.stats.assets, l.stats.photographers].map((stat) => (
                <span key={stat}>{stat}</span>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Filter Bar ────────────────────────────── */}
      <div className="sticky top-16 z-40 border-b border-outline-variant/20 bg-surface/95 backdrop-blur-md md:top-20 md:bg-surface/80">
        <div className="max-w-7xl mx-auto px-4 py-3 md:px-8 md:py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 md:hidden">
            <span className="text-xs font-medium text-outline">
              {loading ? "…" : `${images.length}${hasMore ? "+" : ""}`} {l.results}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((value) => !value)}
                className={[
                  "relative inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                  mobileFiltersOpen || activeFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
                ].join(" ")}
                aria-expanded={mobileFiltersOpen}
                aria-label={copy.filter}
                title={copy.filter}
              >
                <span className="material-symbols-outlined text-base">tune</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] leading-none text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-9 rounded-full bg-surface-container-low px-3 text-xs font-bold text-on-surface outline-none"
                aria-label={l.sort.label}
              >
                {SORT_KEYS.map((k) => (
                  <option key={k} value={k}>{l.sort[k]}</option>
                ))}
              </select>
              <Link
                href={photoRequestHref}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                aria-label={copy.photoRequest}
              >
                <span className="material-symbols-outlined text-base">add_photo_alternate</span>
              </Link>
            </div>
          </div>

          <div className={`${mobileFiltersOpen ? "flex" : "hidden"} flex-col gap-3 md:flex`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Category pills */}
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1 md:max-h-none md:overflow-visible">
                {categoryOptions.map((item) => (
                  <CategoryPill
                    key={item.code}
                    label={item.label}
                    active={category === item.code}
                    onClick={() => handleCategoryChange(item.code)}
                  />
                ))}
              </div>

            {/* Sort + request + result count */}
              <div className="hidden items-center gap-3 shrink-0 md:flex">
                <span className="text-xs text-outline font-medium">
                  {loading ? "…" : `${images.length}${hasMore ? "+" : ""}`} {l.results}
                </span>
                <Link
                  href={photoRequestHref}
                  className="flex h-9 items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container-lowest px-3 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
                >
                  <span className="material-symbols-outlined text-base">add_photo_alternate</span>
                  {copy.photoRequest}
                </Link>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-outline hidden sm:inline">
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

            <div className="flex max-h-24 flex-wrap items-center gap-2 overflow-y-auto border-t border-outline-variant/20 pt-3 pr-1 md:max-h-none md:overflow-visible">
              <span className="text-xs font-semibold text-outline">{usageLabels.title}</span>
              {usageFilters.map((filter) => (
                <label
                  key={filter.label}
                  className={[
                    "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
                    filter.checked
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={filter.checked}
                    onChange={(event) => filter.onChange(event.target.checked)}
                    className="sr-only"
                  />
                  <span className="material-symbols-outlined text-sm">{filter.icon}</span>
                  {filter.label}
                </label>
              ))}
            </div>
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
              <div className="flex flex-col items-center justify-center py-40 gap-4 text-center text-outline">
                <span className="material-symbols-outlined text-6xl">image_search</span>
                <p className="text-base">{l.noResults}</p>
                <Link
                  href={photoRequestHref}
                  className="mt-2 flex h-11 items-center gap-2 rounded bg-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-base">assignment_add</span>
                  {copy.requestWithConditions}
                </Link>
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
                  <p className="text-center text-xs text-outline py-12">
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
