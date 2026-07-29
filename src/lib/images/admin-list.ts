import type { ImageLifecycleStatus } from "./deletion";

export const ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES = ["archived", "purged"] as const satisfies readonly ImageLifecycleStatus[];

type HiddenAdminImageLifecycleStatus = (typeof ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES)[number];

interface LifecycleFilterQuery<T> {
  or(filters: string): T;
}

export function isVisibleInAdminImageList(lifecycleStatus: string | null | undefined) {
  return !ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES.includes(lifecycleStatus as HiddenAdminImageLifecycleStatus);
}

export function applyAdminImageListLifecycleFilter<T extends LifecycleFilterQuery<T>>(query: T) {
  return query.or(
    `lifecycle_status.is.null,lifecycle_status.not.in.(${ADMIN_IMAGE_LIST_HIDDEN_LIFECYCLE_STATUSES.join(",")})`,
  );
}

export function applyAdminReviewableLifecycleFilter<T extends LifecycleFilterQuery<T>>(query: T) {
  return query.or("lifecycle_status.is.null,lifecycle_status.eq.active");
}
