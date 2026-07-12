export interface DownloadableCheckoutItem {
  id: string;
}

export function initialSelectedDownloadIds(items: DownloadableCheckoutItem[]) {
  return items.map((item) => item.id);
}

export function toggleDownloadId(currentIds: string[], id: string) {
  return currentIds.includes(id)
    ? currentIds.filter((itemId) => itemId !== id)
    : [...currentIds, id];
}

export function toggleDownloadSelectionAll(currentIds: string[], allIds: string[]) {
  const current = new Set(currentIds);
  const allSelected = allIds.length > 0 && allIds.every((id) => current.has(id));
  return allSelected ? [] : [...allIds];
}
