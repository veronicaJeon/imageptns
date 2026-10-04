export const SEARCH_SORTS = ["relevant", "newest", "popular"] as const;
export type SearchSort = typeof SEARCH_SORTS[number];

export interface SortableSearchImage {
  id: string;
  created_at: string | null;
  sales_count: number | null;
}

export function parseSearchSort(value: string | null | undefined): SearchSort {
  return SEARCH_SORTS.includes(value as SearchSort) ? value as SearchSort : "relevant";
}

/**
 * Reorders relevance-ranked search results for the library sort control.
 * Images that tie on the chosen key keep their relevance order.
 */
export function sortRankedImages<T extends SortableSearchImage>(images: readonly T[], sort: SearchSort): T[] {
  if (sort === "relevant") return [...images];
  const relevance = new Map(images.map((image, index) => [image.id, index]));
  const timeOf = (image: T) => (image.created_at ? Date.parse(image.created_at) : 0) || 0;
  return [...images].sort((left, right) => {
    const difference = sort === "newest"
      ? timeOf(right) - timeOf(left)
      : (right.sales_count ?? 0) - (left.sales_count ?? 0);
    return difference || (relevance.get(left.id) ?? 0) - (relevance.get(right.id) ?? 0);
  });
}
