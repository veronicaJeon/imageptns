export interface PriceOverride {
  license_code: string;
  price_krw: number;
}

export const AUDITED_IMAGE_FIELDS = [
  "title",
  "title_ko",
  "title_en",
  "description",
  "description_ko",
  "description_en",
  "category",
  "category_codes",
  "tags",
  "tags_ko",
  "tags_en",
  "is_published",
  "price_overrides",
] as const;

export function sortPriceOverrides(rows: PriceOverride[]) {
  return [...rows]
    .map(({ license_code, price_krw }) => ({ license_code, price_krw }))
    .sort((a, b) => a.license_code.localeCompare(b.license_code));
}

// 감사 기록에는 바뀐 필드만 남겨 변경 전후를 바로 읽을 수 있게 한다.
export function diffImageEdit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  for (const field of AUDITED_IMAGE_FIELDS) {
    if (JSON.stringify(before[field] ?? null) === JSON.stringify(after[field] ?? null)) continue;
    changedBefore[field] = before[field] ?? null;
    changedAfter[field] = after[field] ?? null;
  }
  return {
    before: changedBefore,
    after: changedAfter,
    changedFields: Object.keys(changedAfter),
  };
}

// 새 목록에 없는 라이선스만 지운다. 먼저 upsert하므로 중간에 실패해도 개별 가격이 통째로 사라지지 않는다.
export function staleOverrideCodes(existing: PriceOverride[], next: PriceOverride[]) {
  const keep = new Set(next.map((row) => row.license_code));
  return existing.map((row) => row.license_code).filter((code) => !keep.has(code));
}
