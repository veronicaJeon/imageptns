"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useLang } from "@/lib/i18n/store";
import Link from "next/link";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";
import { CategoryPill } from "@/components/ui/CategoryPill";
import { DEFAULT_IMAGE_CATEGORIES, type ImageCategory } from "@/lib/images/categories";
import { LibraryAdCard } from "@/components/ads/LibraryAdCard";
import type { PublicLibraryAd } from "@/lib/ads/campaigns";

const PAGE_SIZE_OPTIONS = [20, 40, 60] as const;
const FILTER_PANEL_STORAGE_KEY = "imagepartners.library.filters-collapsed";

const SORT_KEYS = ["newest", "popular", "relevant"] as const;
type SortKey = typeof SORT_KEYS[number];
type OrientationKey = "all" | "landscape" | "portrait" | "square";

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
    filter: "필터",
    orientation: "방향",
    orientations: { all: "전체", landscape: "가로", portrait: "세로", square: "정사각형" },
    pageSize: "보이는 이미지",
    loadMore: (count: number) => `더보기 (+${count}개 더 보기)`,
    loadingMore: "이미지를 불러오는 중입니다",
    endOfResults: "모든 이미지를 확인했습니다.",
    collapseFilters: "필터 영역 접기",
    expandFilters: "필터 영역 펼치기",
  },
  en: {
    filter: "Filters",
    orientation: "Orientation",
    orientations: { all: "All", landscape: "Landscape", portrait: "Portrait", square: "Square" },
    pageSize: "Visible images",
    loadMore: (count: number) => `Load more (+${count})`,
    loadingMore: "Loading more images",
    endOfResults: "You have reached the end.",
    collapseFilters: "Collapse filters",
    expandFilters: "Expand filters",
  },
} as const;

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
  const [orientation, setOrientation] = useState<OrientationKey>("all");
  const [pageSize, setPageSize]       = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [freeOnly, setFreeOnly]       = useState(false);
  const [educationFreeOnly, setEducationFreeOnly] = useState(false);
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [derivativesOnly, setDerivativesOnly] = useState(false);
  const [images, setImages]           = useState<ImageCardData[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [guidance, setGuidance]       = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [adCampaign, setAdCampaign] = useState<PublicLibraryAd | null>(null);

  const blurTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setFiltersCollapsed(localStorage.getItem(FILTER_PANEL_STORAGE_KEY) === "true");
    } catch {
      // Keep the default expanded state when browser storage is unavailable.
    }
  }, []);

  useEffect(() => {
    fetch(`/api/library-guidance?lang=${lang}&refresh=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { message?: string | null }) => setGuidance(data.message || l.hero.sub))
      .catch(() => setGuidance(l.hero.sub));
  }, [lang, l.hero.sub]);

  useEffect(() => {
    let active = true;
    fetch(`/api/library-ad?lang=${lang}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { campaign: null })
      .then((data: { campaign?: PublicLibraryAd | null }) => {
        if (active) setAdCampaign(data.campaign ?? null);
      })
      .catch(() => {
        if (active) setAdCampaign(null);
      });
    return () => { active = false; };
  }, [lang]);

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

  const fetchImages = useCallback(async (offset = 0, append = false) => {
    if (append && loadingMoreRef.current) return;
    const requestSeq = ++requestSeqRef.current;
    if (append) {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    } else {
      loadingMoreRef.current = false;
      setLoadingMore(false);
      setLoading(true);
    }

    try {
      const params = new URLSearchParams({ sort, limit: String(pageSize), offset: String(offset), orientation });
      if (category !== "all") params.set("category", category);
      if (debouncedQuery)     params.set("query", debouncedQuery);
      if (freeOnly) params.set("free", "true");
      if (educationFreeOnly) params.set("educationFree", "true");
      if (commercialOnly) params.set("commercial", "true");
      if (derivativesOnly) params.set("derivatives", "true");

      const res = await fetch(`/api/images?${params}`);
      if (!res.ok) throw new Error();
      const { images: data, hasMore: moreAvailable } = await res.json() as { images?: ImageCardData[]; hasMore?: boolean };

      if (requestSeq !== requestSeqRef.current) return;

      const nextImages = (data ?? []).slice(0, pageSize);
      setImages((current) => {
        if (!append) return nextImages;
        const existingIds = new Set(current.map((image) => image.id));
        return [...current, ...nextImages.filter((image) => !existingIds.has(image.id))];
      });
      setHasMore(Boolean(moreAvailable));
    } catch {
      if (requestSeq !== requestSeqRef.current) return;
      if (!append) setImages([]);
      setHasMore(false);
    } finally {
      if (append) loadingMoreRef.current = false;
      if (requestSeq === requestSeqRef.current) {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    }
  }, [category, sort, orientation, pageSize, debouncedQuery, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly]);

  useEffect(() => {
    setHasMore(false);
    void fetchImages(0, false);
  }, [category, sort, orientation, pageSize, debouncedQuery, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    if (loading || loadingMore || loadingMoreRef.current || !hasMore) return;
    void fetchImages(images.length, true);
  }, [fetchImages, hasMore, images.length, loading, loadingMore]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  function handleCategoryChange(key: string) {
    setCategory(key);
    setShowSuggestions(false);
  }

  function toggleFilterPanel() {
    setFiltersCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(FILTER_PANEL_STORAGE_KEY, String(next));
      } catch {
        // The toggle still works for the current page when storage is unavailable.
      }
      return next;
    });
  }

  const activeFilterCount = [
    category !== "all",
    orientation !== "all",
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
  const showAdCampaign = Boolean(adCampaign && !loading && images.length > 0);

  return (
    <>
      <section className="bg-surface px-4 pb-6 pt-28 md:px-8 md:pb-8 md:pt-36">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="font-headline text-4xl md:text-6xl font-extrabold text-on-surface mb-4">
            {l.hero.headline}
          </h1>
          <p className="text-lg text-on-surface-variant">{guidance || l.hero.sub}</p>
        </div>
      </section>

      <div data-testid="library-sticky-controls" className="sticky top-16 z-40 border-b border-outline-variant/20 bg-surface/95 shadow-sm backdrop-blur-md md:top-20">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-8 md:py-4">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_48px] items-stretch gap-2 md:grid-cols-[160px_minmax(0,1fr)_220px_48px]">
            <label className="order-2 flex h-12 min-w-0 items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 text-left md:order-none md:h-16 md:px-4">
              <span className="material-symbols-outlined text-xl text-outline">swap_vert</span>
              <span className="sr-only">{l.sort.label}</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-on-surface outline-none" aria-label={l.sort.label}>
                {SORT_KEYS.map((key) => <option key={key} value={key}>{l.sort[key]}</option>)}
              </select>
            </label>

            <div className="relative order-1 col-span-3 md:order-none md:col-span-1">
              <div className="relative overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-low shadow-ghost ring-1 ring-black/5 transition-colors focus-within:border-primary/60 focus-within:bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary/20">
                <span className="material-symbols-outlined pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-2xl text-outline">search</span>
                <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={l.hero.searchPlaceholder} className="h-14 w-full bg-transparent pl-14 pr-12 text-base text-on-surface placeholder:text-outline outline-none md:h-16" onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }} onBlur={() => { blurTimerRef.current = setTimeout(() => setShowSuggestions(false), 150); }} onKeyDown={(event) => { if (event.key === "Escape") setShowSuggestions(false); }} />
                {query && <button onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-outline" aria-label="Clear search"><span className="material-symbols-outlined text-xl">close</span></button>}
              </div>
              {showSuggestions && suggestions.length > 0 && <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg bg-white shadow-lg">{suggestions.map((suggestion) => <li key={suggestion}><button className="w-full px-5 py-2.5 text-left text-sm hover:bg-surface-container-low" onMouseDown={() => { if (blurTimerRef.current) clearTimeout(blurTimerRef.current); setQuery(suggestion); setShowSuggestions(false); }}>{suggestion}</button></li>)}</ul>}
            </div>

            <label className="order-2 flex h-12 min-w-0 items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-low px-3 text-left md:order-none md:h-16 md:px-4">
              <span className="material-symbols-outlined text-xl text-outline">crop_rotate</span>
              <span className="sr-only">{copy.orientation}</span>
              <select value={orientation} onChange={(event) => setOrientation(event.target.value as OrientationKey)} className="min-w-0 flex-1 bg-transparent text-sm font-bold text-on-surface outline-none" aria-label={copy.orientation}>
                {(Object.keys(copy.orientations) as OrientationKey[]).map((key) => <option key={key} value={key}>{copy.orientations[key]}</option>)}
              </select>
            </label>

            <button
              type="button"
              onClick={toggleFilterPanel}
              className="order-2 inline-flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/60 bg-surface-container-low text-on-surface-variant transition-colors hover:border-primary/40 hover:bg-surface-container-high hover:text-primary md:order-none md:h-16 md:w-auto"
              aria-expanded={!filtersCollapsed}
              aria-controls="library-secondary-filters"
              aria-label={filtersCollapsed ? copy.expandFilters : copy.collapseFilters}
              title={filtersCollapsed ? copy.expandFilters : copy.collapseFilters}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">{filtersCollapsed ? "expand_more" : "expand_less"}</span>
            </button>
          </div>

          <div
            id="library-secondary-filters"
            className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out ${filtersCollapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}
            aria-hidden={filtersCollapsed}
            inert={filtersCollapsed ? true : undefined}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-3 pt-3">
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 md:justify-center" aria-label="카테고리">
                  {categoryOptions.map((item) => <CategoryPill key={item.code} label={item.label} active={category === item.code} onClick={() => handleCategoryChange(item.code)} className="h-10 shrink-0" />)}
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
                  <span className="text-xs font-medium text-outline">{loading ? "…" : images.length} {l.results}</span>
                  <button type="button" onClick={() => setMobileFiltersOpen((value) => !value)} className={`relative inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-xs font-bold ${mobileFiltersOpen || activeFilterCount > 0 ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-low text-on-surface-variant"}`} aria-expanded={mobileFiltersOpen}><span className="material-symbols-outlined text-base">tune</span>{copy.filter}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button>
                </div>

                <div className={`${mobileFiltersOpen ? "flex" : "hidden"} flex-col gap-3 md:flex`}>
                  <div className="grid gap-2 md:flex md:flex-wrap md:items-center">
                    <span className="text-xs font-semibold text-outline md:mr-1">{usageLabels.title}</span>
                    <div className="grid grid-cols-2 gap-2 md:contents">
                    {usageFilters.map((filter) => (
                      <label key={filter.label} className={`flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-bold md:h-8 md:justify-start md:rounded-full md:px-3 ${filter.checked ? "border-primary bg-primary/10 text-primary" : "border-outline-variant bg-surface-container-low text-on-surface-variant"}`}>
                        <input type="checkbox" checked={filter.checked} onChange={(event) => filter.onChange(event.target.checked)} className="sr-only" />
                        <span className="material-symbols-outlined text-sm">{filter.icon}</span>
                        <span className="min-w-0 truncate">{filter.label}</span>
                      </label>
                    ))}
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg bg-surface-container-low p-2 md:ml-auto md:flex md:bg-transparent md:p-0">
                      <span className="text-xs font-semibold text-outline">{copy.pageSize}</span>
                      <div className="grid grid-cols-3 rounded-full bg-surface-container-lowest p-1 md:flex md:bg-surface-container-low">{PAGE_SIZE_OPTIONS.map((size) => <button key={size} type="button" onClick={() => setPageSize(size)} className={`h-10 min-w-0 rounded-full px-2 text-xs font-bold md:h-7 md:min-w-9 ${pageSize === size ? "bg-primary text-white" : "text-on-surface-variant"}`}>{size}</button>)}</div>
                      <span className="hidden text-xs text-outline md:inline">{loading ? "…" : images.length} {l.results}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Gallery ───────────────────────────────── */}
      <section className="py-12 px-6 md:px-8 bg-surface-container-low min-h-[60vh]">
        <div className={`mx-auto grid max-w-[1680px] gap-8 ${showAdCampaign ? "2xl:grid-cols-[minmax(0,1fr)_240px]" : ""}`}>
          <div className="min-w-0">
            {loading ? (
              <div className="flex items-center justify-center py-40 text-outline">
                <span className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-40 gap-4 text-center text-outline">
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
                <div ref={loadMoreSentinelRef} className="flex min-h-28 flex-col items-center justify-center gap-3 pt-8" aria-live="polite">
                  {loadingMore ? (
                    <div className="flex flex-col items-center gap-2 text-outline">
                      <span className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
                      <span className="text-xs font-semibold">{copy.loadingMore}</span>
                    </div>
                  ) : hasMore ? (
                    <button
                      type="button"
                      onClick={loadMore}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-primary/30 bg-surface-container-lowest px-6 text-sm font-bold text-primary shadow-ghost transition-all hover:border-primary hover:bg-primary/5 active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">add_circle</span>
                      {copy.loadMore(pageSize)}
                    </button>
                  ) : (
                    <p className="text-xs font-medium text-outline">{copy.endOfResults}</p>
                  )}
                </div>
              </>
            )}
          </div>
          {showAdCampaign && adCampaign && <LibraryAdCard campaign={adCampaign} />}
        </div>
      </section>
    </>
  );
}
