import { applyAdminImageListLifecycleFilter } from "./admin-list";

interface DeleteTargetFilterQuery<T> {
  or(filters: string): T;
}

export function applyAdminImageDeleteTargetFilter<T extends DeleteTargetFilterQuery<T>>(query: T) {
  return applyAdminImageListLifecycleFilter(query);
}
