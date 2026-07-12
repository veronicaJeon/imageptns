import type { ImageLifecycleStatus } from "./deletion";

export const ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES = ["archived", "purged"] as const satisfies readonly ImageLifecycleStatus[];

type HiddenAdminImageLifecycleStatus = (typeof ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES)[number];

interface LifecycleFilterQuery<T> {
  not(column: string, operator: string, value: string): T;
}

function hiddenLifecycleFilterValue() {
  return `(${ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES.join(",")})`;
}

export function isVisibleInAdminImageList(lifecycleStatus: string | null | undefined) {
  return !ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES.includes(lifecycleStatus as HiddenAdminImageLifecycleStatus);
}

export function applyAdminImageListLifecycleFilter<T extends LifecycleFilterQuery<T>>(query: T) {
  return query.not("lifecycle_status", "in", hiddenLifecycleFilterValue());
}
