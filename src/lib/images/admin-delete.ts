import { applyAdminImageListLifecycleFilter } from "./admin-list";

interface DeleteTargetFilterQuery<T> {
  not(column: string, operator: string, value: string): T;
}

export function applyAdminImageDeleteTargetFilter<T extends DeleteTargetFilterQuery<T>>(query: T) {
  return applyAdminImageListLifecycleFilter(query);
}
