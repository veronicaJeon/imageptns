export function orderHistoryPreview(
  lifecycleStatus: string | null | undefined,
  currentPreview: string | null | undefined,
  snapshotPreview: string | null | undefined,
) {
  if (lifecycleStatus && lifecycleStatus !== "active") return null;
  return currentPreview || snapshotPreview || null;
}
