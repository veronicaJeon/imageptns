export interface AdministrativeAreaRow {
  code: string;
  full_name: string;
  leaf_name: string;
  level: "sido" | "sigungu" | "eup_myeon_dong" | "ri";
}

export function normalizeLocationQuery(value: unknown) {
  return typeof value === "string"
    ? value.trim().replace(/[%_,()]/g, "").replace(/\s+/g, " ").slice(0, 50)
    : "";
}
