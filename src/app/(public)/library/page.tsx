"use client";

import { useState, useMemo } from "react";
import { useLang } from "@/lib/i18n/store";
import Link from "next/link";
import { MasonryGrid } from "@/components/gallery/MasonryGrid";
import { ImageCard, ImageCardData } from "@/components/gallery/ImageCard";
import { CategoryPill } from "@/components/ui/CategoryPill";

/* ── Mock data ─────────────────────────────────────────── */
const MOCK_IMAGES: ImageCardData[] = [
  { id: "1",  title: "Morning Mist Over Mountains",      category: "nature",       src: "https://picsum.photos/seed/mist1/800/1100",   alt: "Morning mist over mountains",    photographer: "Elena Novak",    width: 800, height: 1100 },
  { id: "2",  title: "Street Portrait — Seoul",          category: "people",       src: "https://picsum.photos/seed/portrait2/800/600", alt: "Street portrait Seoul",          photographer: "James Okafor",   width: 800, height: 600  },
  { id: "3",  title: "Tokyo at 3AM",                     category: "urban",        src: "https://picsum.photos/seed/tokyo3/800/900",   alt: "Tokyo cityscape at night",       photographer: "Aiko Tanaka",    width: 800, height: 900  },
  { id: "4",  title: "Annual Press Summit 2024",         category: "editorial",    src: "https://picsum.photos/seed/press4/800/500",   alt: "Press summit editorial",         photographer: "Marc Devlin",    width: 800, height: 500  },
  { id: "5",  title: "Brutalist Geometry",               category: "architecture", src: "https://picsum.photos/seed/brutal5/800/1000", alt: "Brutalist architecture detail",  photographer: "Lena Kroft",     width: 800, height: 1000 },
  { id: "6",  title: "Chromatic Flow #12",               category: "abstract",     src: "https://picsum.photos/seed/chroma6/800/800",  alt: "Abstract chromatic flow",        photographer: "Rui Santos",     width: 800, height: 800  },
  { id: "7",  title: "Sahara Dunes — Golden Hour",       category: "nature",       src: "https://picsum.photos/seed/sahara7/800/600",  alt: "Sahara dunes golden hour",       photographer: "Fatima Al-Nur",  width: 800, height: 600  },
  { id: "8",  title: "Community Market — Lagos",         category: "people",       src: "https://picsum.photos/seed/lagos8/800/1050",  alt: "Community market Lagos",         photographer: "Chioma Eze",     width: 800, height: 1050 },
  { id: "9",  title: "Glass Towers — Frankfurt",         category: "architecture", src: "https://picsum.photos/seed/frank9/800/950",   alt: "Glass towers Frankfurt",         photographer: "Hans Richter",   width: 800, height: 950  },
  { id: "10", title: "UN General Assembly",              category: "editorial",    src: "https://picsum.photos/seed/un10/800/550",     alt: "UN General Assembly hall",       photographer: "Claire Dubois",  width: 800, height: 550  },
  { id: "11", title: "Signal & Noise #3",                category: "abstract",     src: "https://picsum.photos/seed/signal11/800/900", alt: "Abstract signal and noise",      photographer: "Yuki Hara",      width: 800, height: 900  },
  { id: "12", title: "Canal — Amsterdam Dusk",           category: "urban",        src: "https://picsum.photos/seed/canal12/800/700",  alt: "Amsterdam canal at dusk",        photographer: "Pieter van Dam", width: 800, height: 700  },
  { id: "13", title: "Glacial Lake — Patagonia",         category: "nature",       src: "https://picsum.photos/seed/glacier13/800/1100",alt: "Glacial lake Patagonia",        photographer: "Sofia Herrera",  width: 800, height: 1100 },
  { id: "14", title: "Fashion Week Backstage",           category: "editorial",    src: "https://picsum.photos/seed/fashion14/800/600", alt: "Fashion week backstage",        photographer: "Nina Koch",      width: 800, height: 600  },
  { id: "15", title: "The Elder",                        category: "people",       src: "https://picsum.photos/seed/elder15/800/900",  alt: "Portrait of an elder",           photographer: "Ali Hassan",     width: 800, height: 900  },
  { id: "16", title: "Concrete Cathedral",               category: "architecture", src: "https://picsum.photos/seed/concathed/800/1000",alt: "Concrete cathedral interior",  photographer: "Eva Moreau",     width: 800, height: 1000 },
];

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

  const filtered = useMemo(() => {
    const base = MOCK_IMAGES.filter((img) => {
      const matchCat = category === "all" || img.category === category;
      const q = query.toLowerCase();
      const matchQ = !q || img.title.toLowerCase().includes(q) || img.photographer?.toLowerCase().includes(q) || img.category.toLowerCase().includes(q);
      return matchCat && matchQ;
    });

    // Sort
    if (sort === "newest")   return [...base].sort((a, b) => Number(b.id) - Number(a.id));
    if (sort === "popular")  return [...base].sort((a, b) => (b.width * b.height) - (a.width * a.height));
    if (sort === "relevant") return [...base].sort((a, b) => a.title.localeCompare(b.title));
    return base;
  }, [query, category, sort]);

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
          <div className="relative flex items-center bg-surface-container-lowest shadow-ghost rounded-lg overflow-hidden">
            <span className="material-symbols-outlined text-outline pl-5 pr-3 text-2xl shrink-0">
              search
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l.hero.searchPlaceholder}
              className="flex-1 py-5 pr-5 bg-transparent text-on-surface placeholder:text-outline text-base outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="px-4 text-outline hover:text-on-surface transition-colors"
                aria-label="Clear search"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="flex justify-center gap-10 mt-8 text-xs font-bold uppercase tracking-widest text-outline">
            {Object.values(l.stats).map((stat) => (
              <span key={stat}>{stat}</span>
            ))}
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
              {filtered.length} {l.results}
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
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-40 gap-4 text-outline">
              <span className="material-symbols-outlined text-6xl">image_search</span>
              <p className="text-base">{l.noResults}</p>
            </div>
          ) : (
            <MasonryGrid>
              {filtered.map((img) => (
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
