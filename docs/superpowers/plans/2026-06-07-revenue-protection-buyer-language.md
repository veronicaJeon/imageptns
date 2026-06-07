# Revenue Protection And Buyer Language Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent pre-purchase original image exposure and replace buyer-facing license/CC language with simple usage-condition language and mandatory `photographerID / Image Partners` attribution.

**Architecture:** Keep existing Supabase preview storage and thumbnail API, but make every public buyer preview resolve through a protected watermarked derivative route. Add a small license presentation layer that maps backend CC/internal policy fields to buyer-friendly conditions, then update library/detail/cart flows to consume those labels and the immutable photographer ID credit line.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Sharp, Zustand cart store, Vitest.

---

## File Structure

- Modify `src/lib/utils/watermark.ts`
  - Reduce watermark density and expose deterministic derivative generation behavior.
- Modify `src/app/api/images/thumbnail/route.ts`
  - Remove `wm=0` bypass for public thumbnails.
  - Add stricter headers and keep source allowlist.
- Modify `src/lib/supabase/storage.ts`
  - Rename helpers conceptually around protected preview URLs while preserving existing callers.
- Modify `src/lib/licenses/creative-commons.ts`
  - Make attribution mandatory.
  - Add buyer-facing usage-condition helpers.
- Modify `src/lib/licenses/creative-commons.test.ts`
  - Cover mandatory attribution and condition mapping.
- Modify `src/app/(public)/library/page.tsx`
  - Replace CC filter chips with buyer-friendly usage filters.
  - Remove buyer-facing CC label dependency.
- Modify `src/app/api/images/route.ts`
  - Accept new usage-condition query params and map them to existing DB fields.
- Modify `src/app/(public)/library/[id]/page.tsx`
  - Remove HTML overlay watermark.
  - Use generated watermarked derivative as the only displayed sample.
  - Show credit line and usage conditions in the right panel.
- Modify `src/lib/store/cart.ts`
  - Store `creditLine` and buyer usage condition snapshots per item.
- Modify `src/app/(public)/cart/page.tsx`
  - Display unified credit line and simplified usage conditions.
- Modify `src/lib/cart/print.ts` and `src/lib/cart/print.test.ts`
  - Ensure printable PDF thumbnails always use watermarked derivative URLs.
- Create `src/lib/licenses/presentation.test.ts` only if helpers become too large for `creative-commons.test.ts`.

---

## Task 1: Lock Public Thumbnail Route To Watermarked Derivatives

**Files:**
- Modify: `src/app/api/images/thumbnail/route.ts`
- Modify: `src/lib/utils/watermark.ts`
- Test: `src/lib/cart/print.test.ts`

- [ ] **Step 1: Write the failing route policy test by extending print test coverage**

Add this test to `src/lib/cart/print.test.ts`:

```ts
it("does not allow callers to request an unwatermarked print thumbnail", () => {
  const src = "https://example.supabase.co/storage/v1/object/public/images-preview/user/photo.jpg";
  const url = cartStatementThumbnailUrl(src, "https://imagepartners.kr", 160, 120);
  const parsed = new URL(url);

  expect(parsed.searchParams.get("wm")).toBeNull();
});
```

Update the existing first test in the same file by changing:

```ts
expect(parsed.searchParams.get("wm")).toBe("1");
```

to:

```ts
expect(parsed.searchParams.get("wm")).toBeNull();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
npm test -- src/lib/cart/print.test.ts
```

Expected: FAIL because `thumbnailUrlFromPreviewUrl` still appends `wm=1`.

- [ ] **Step 3: Remove the public watermark toggle from URL construction**

In `src/lib/supabase/storage.ts`, change `thumbnailUrlFromPreviewUrl` so the params block is:

```ts
const params = new URLSearchParams({
  src: url.toString(),
  w: String(width),
  h: String(height),
});
```

Do not include `wm`.

- [ ] **Step 4: Remove `wm=0` bypass from the API route**

In `src/app/api/images/thumbnail/route.ts`, remove:

```ts
const shouldWatermark = req.nextUrl.searchParams.get("wm") !== "0";
```

Replace the `output` assignment with:

```ts
const output = await createWatermarkedThumbnail(input, width, height);
```

The route must always return a watermarked derivative.

- [ ] **Step 5: Tune watermark density**

In `src/lib/utils/watermark.ts`, replace the current tiled `watermarkSvg` implementation with this less dense version:

```ts
function watermarkSvg(w: number, h: number) {
  const fontSize = Math.max(22, Math.min(76, Math.round(Math.min(w, h) * 0.05)));
  const smallSize = Math.max(12, Math.round(fontSize * 0.32));

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="${w}" height="${h}" fill="transparent"/>
    <text x="${w / 2}" y="${h / 2}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${fontSize}"
      font-weight="800"
      fill="white"
      fill-opacity="0.28"
      text-anchor="middle"
      dominant-baseline="middle"
      letter-spacing="${Math.round(fontSize * 0.14)}"
      transform="rotate(-24 ${w / 2} ${h / 2})"
    >IMAGE PARTNERS</text>
    <text x="${w - 18}" y="${h - 18}"
      font-family="Arial, Helvetica, sans-serif"
      font-size="${smallSize}"
      font-weight="700"
      fill="white"
      fill-opacity="0.68"
      text-anchor="end"
      dominant-baseline="auto"
      letter-spacing="${Math.round(smallSize * 0.12)}"
    >IMAGE PARTNERS PREVIEW</text>
  </svg>`;
}
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/lib/cart/print.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/images/thumbnail/route.ts src/lib/utils/watermark.ts src/lib/supabase/storage.ts src/lib/cart/print.test.ts
git commit -m "fix: force watermarked public previews"
```

---

## Task 2: Add Buyer-Friendly License Presentation Helpers

**Files:**
- Modify: `src/lib/licenses/creative-commons.ts`
- Modify: `src/lib/licenses/creative-commons.test.ts`

- [ ] **Step 1: Write failing tests for mandatory attribution and condition labels**

Add imports in `src/lib/licenses/creative-commons.test.ts`:

```ts
import {
  buyerUsageConditions,
  creditLineForPhotographerId,
  getCopyrightLicense,
  getFreeUsagePolicy,
  normalizeCopyrightLicenseCode,
  normalizeFreeUsagePolicy,
} from "./creative-commons";
```

Replace the current single import with the block above.

Add these tests:

```ts
it("requires attribution for the standard platform license", () => {
  const license = getCopyrightLicense("standard");

  expect(license.requiresAttribution).toBe(true);
});

it("builds the platform credit line from immutable photographer id", () => {
  expect(creditLineForPhotographerId("jiri_mountain_01")).toBe("jiri_mountain_01 / Image Partners");
});

it("maps backend license fields into buyer-friendly usage conditions", () => {
  const conditions = buyerUsageConditions({
    copyrightLicense: "cc_by",
    freeUsagePolicy: "education",
  });

  expect(conditions).toEqual([
    { key: "education_free", label: "교육용 무료 사용 가능", allowed: true },
    { key: "commercial", label: "상업 사용 가능", allowed: true },
    { key: "derivatives", label: "원 저작물 변경 가능", allowed: true },
    { key: "attribution", label: "저작자 표시 필요", allowed: true },
  ]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- src/lib/licenses/creative-commons.test.ts
```

Expected: FAIL because the new helpers do not exist and `standard.requiresAttribution` is false.

- [ ] **Step 3: Make attribution mandatory and add helper types**

In `src/lib/licenses/creative-commons.ts`, change the `standard` option:

```ts
requiresAttribution: true,
```

Add these types and helpers at the end of the file:

```ts
export type BuyerUsageConditionKey =
  | "free"
  | "education_free"
  | "commercial"
  | "derivatives"
  | "attribution";

export interface BuyerUsageCondition {
  key: BuyerUsageConditionKey;
  label: string;
  allowed: boolean;
}

export function creditLineForPhotographerId(photographerId: string | null | undefined): string {
  const normalized = (photographerId ?? "").trim();
  return `${normalized || "unknown"} / Image Partners`;
}

export function buyerUsageConditions(input: {
  copyrightLicense: unknown;
  freeUsagePolicy: unknown;
}): BuyerUsageCondition[] {
  const license = getCopyrightLicense(input.copyrightLicense);
  const freePolicy = getFreeUsagePolicy(input.freeUsagePolicy);

  const conditions: BuyerUsageCondition[] = [];

  if (freePolicy.code === "all") {
    conditions.push({ key: "free", label: "무료 사용 가능", allowed: true });
  }

  if (freePolicy.code === "education") {
    conditions.push({ key: "education_free", label: "교육용 무료 사용 가능", allowed: true });
  }

  conditions.push(
    { key: "commercial", label: license.allowsCommercialUse ? "상업 사용 가능" : "상업 사용 제한", allowed: license.allowsCommercialUse },
    { key: "derivatives", label: license.allowsDerivatives ? "원 저작물 변경 가능" : "원 저작물 변경 제한", allowed: license.allowsDerivatives },
    { key: "attribution", label: "저작자 표시 필요", allowed: true },
  );

  return conditions;
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/lib/licenses/creative-commons.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/licenses/creative-commons.ts src/lib/licenses/creative-commons.test.ts
git commit -m "feat: add buyer usage condition labels"
```

---

## Task 3: Replace Library CC Filters With Buyer Usage Filters

**Files:**
- Modify: `src/app/(public)/library/page.tsx`
- Modify: `src/app/api/images/route.ts`

- [ ] **Step 1: Inspect current API query handling**

Run:

```bash
sed -n '1,260p' src/app/api/images/route.ts
```

Expected: identify existing `license` and `free` query handling.

- [ ] **Step 2: Add query parameters for usage filters**

In `src/app/(public)/library/page.tsx`, replace:

```ts
import { COPYRIGHT_LICENSES, type CopyrightLicenseCode } from "@/lib/licenses/creative-commons";
```

with no license import.

Remove:

```ts
const CC_LICENSE_FILTERS = COPYRIGHT_LICENSES.filter((license) => license.code !== "standard");
```

Replace state:

```ts
const [selectedLicenses, setSelectedLicenses] = useState<CopyrightLicenseCode[]>([]);
const [freeOnly, setFreeOnly] = useState(false);
```

with:

```ts
const [freeOnly, setFreeOnly] = useState(false);
const [educationFreeOnly, setEducationFreeOnly] = useState(false);
const [commercialOnly, setCommercialOnly] = useState(false);
const [derivativesOnly, setDerivativesOnly] = useState(false);
```

In `fetchPage`, remove:

```ts
selectedLicenses.forEach((license) => params.append("license", license));
if (freeOnly) params.set("free", "true");
```

and replace with:

```ts
if (freeOnly) params.set("free", "true");
if (educationFreeOnly) params.set("educationFree", "true");
if (commercialOnly) params.set("commercial", "true");
if (derivativesOnly) params.set("derivatives", "true");
```

Update the `useCallback` dependency list from:

```ts
}, [category, sort, debouncedQuery, selectedLicenses, freeOnly]);
```

to:

```ts
}, [category, sort, debouncedQuery, freeOnly, educationFreeOnly, commercialOnly, derivativesOnly]);
```

Update the reset effect dependency list similarly.

- [ ] **Step 3: Replace CC filter chip markup**

In `src/app/(public)/library/page.tsx`, replace the filter-chip block that begins with:

```tsx
<span className="text-[10px] font-bold uppercase tracking-widest text-outline">CC</span>
```

through the free label with:

```tsx
<span className="text-[10px] font-bold uppercase tracking-widest text-outline">사용 조건</span>
{[
  { label: "무료 사용 가능", checked: freeOnly, onChange: setFreeOnly, icon: "redeem" },
  { label: "교육용 무료", checked: educationFreeOnly, onChange: setEducationFreeOnly, icon: "school" },
  { label: "상업 사용 가능", checked: commercialOnly, onChange: setCommercialOnly, icon: "business_center" },
  { label: "변경 가능", checked: derivativesOnly, onChange: setDerivativesOnly, icon: "edit" },
].map((filter) => (
  <label
    key={filter.label}
    className={[
      "flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition-colors",
      filter.checked
        ? "border-primary bg-primary/10 text-primary"
        : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline",
    ].join(" ")}
  >
    <input
      type="checkbox"
      checked={filter.checked}
      onChange={(event) => filter.onChange(event.target.checked)}
      className="sr-only"
    />
    <span className="material-symbols-outlined text-sm">{filter.icon}</span>
    {filter.label}
  </label>
))}
```

- [ ] **Step 4: Update API filtering**

In `src/app/api/images/route.ts`, support these params:

```ts
const freeOnly = req.nextUrl.searchParams.get("free") === "true";
const educationFreeOnly = req.nextUrl.searchParams.get("educationFree") === "true";
const commercialOnly = req.nextUrl.searchParams.get("commercial") === "true";
const derivativesOnly = req.nextUrl.searchParams.get("derivatives") === "true";
```

Map them as follows:

```ts
if (freeOnly) query = query.eq("free_usage_policy", "all");
if (educationFreeOnly) query = query.eq("free_usage_policy", "education");
if (commercialOnly) query = query.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nd"]);
if (derivativesOnly) query = query.in("copyright_license", ["standard", "cc0", "cc_by", "cc_by_sa", "cc_by_nc", "cc_by_nc_sa"]);
```

If the file currently uses a `const query`, convert it to `let query` before applying conditional filters.

- [ ] **Step 5: Run lint for changed files**

Run:

```bash
npm run lint -- src/app/(public)/library/page.tsx src/app/api/images/route.ts
```

Expected: PASS. If the shell treats parentheses specially, quote the paths:

```bash
npm run lint -- 'src/app/(public)/library/page.tsx' src/app/api/images/route.ts
```

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(public)/library/page.tsx' src/app/api/images/route.ts
git commit -m "feat: simplify library usage filters"
```

---

## Task 4: Rebuild Detail Page License Summary And Credit Line

**Files:**
- Modify: `src/app/(public)/library/[id]/page.tsx`
- Modify: `src/lib/store/cart.ts`

- [ ] **Step 1: Extend cart item snapshot fields**

In `src/lib/store/cart.ts`, add fields to `CartItem`:

```ts
creditLine: string;
usageConditions: string[];
```

Because `addItem` accepts `Omit<CartItem, "price">`, callers must now pass these snapshots.

- [ ] **Step 2: Import presentation helpers in detail page**

In `src/app/(public)/library/[id]/page.tsx`, replace:

```ts
import { getCopyrightLicense, getFreeUsagePolicy } from "@/lib/licenses/creative-commons";
```

with:

```ts
import { buyerUsageConditions, creditLineForPhotographerId, getCopyrightLicense, getFreeUsagePolicy } from "@/lib/licenses/creative-commons";
```

- [ ] **Step 3: Compute photographer ID credit and condition labels**

Replace:

```ts
const photographer = imageData.photographer?.display_name || imageData.photographer?.full_name || "Unknown";
const photographerId = imageData.photographer?.id;
const copyrightLicense = getCopyrightLicense(imageData.copyright_license);
const freeUsagePolicy = getFreeUsagePolicy(imageData.free_usage_policy);
const attributionName = imageData.attribution_name || photographer;
```

with:

```ts
const photographerId = imageData.photographer?.id ?? null;
const photographer = photographerId ?? "unknown";
const creditLine = creditLineForPhotographerId(photographerId);
const copyrightLicense = getCopyrightLicense(imageData.copyright_license);
const freeUsagePolicy = getFreeUsagePolicy(imageData.free_usage_policy);
const usageConditions = buyerUsageConditions({
  copyrightLicense: imageData.copyright_license,
  freeUsagePolicy: imageData.free_usage_policy,
});
```

- [ ] **Step 4: Pass snapshots to cart**

In both `handleAddToCart` and `handleBuyNow`, add:

```ts
creditLine,
usageConditions: usageConditions.map((condition) => condition.label),
```

to the `addItem` payload.

- [ ] **Step 5: Remove HTML overlay watermark**

In the image preview block, remove this entire overlay:

```tsx
<div className="pointer-events-none absolute inset-0 overflow-hidden">
  <div className="absolute inset-[-20%] grid grid-cols-3 gap-8 rotate-[-24deg] opacity-25">
    {Array.from({ length: 18 }).map((_, index) => (
      <span
        key={index}
        className="select-none whitespace-nowrap text-center font-headline text-xl font-black uppercase tracking-[0.35em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.75)]"
      >
        IMAGE PARTNERS
      </span>
    ))}
  </div>
</div>
```

Keep the `thumbnailUrlFromPreviewUrl(..., 1200, 900)` image source because Task 1 makes that route always watermarked.

- [ ] **Step 6: Replace the right-panel license block**

Replace the detailed CC-heavy panel content with:

```tsx
<div className="mb-4 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4">
  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">사용 조건</p>
  <div className="mt-3 flex flex-wrap gap-2">
    {usageConditions.map((condition) => (
      <span
        key={condition.key}
        className={cn(
          "rounded-full px-3 py-1 text-xs font-bold",
          condition.allowed
            ? "bg-primary/10 text-primary"
            : "bg-error/10 text-error"
        )}
      >
        {condition.label}
      </span>
    ))}
  </div>
  <div className="mt-4 rounded-md bg-surface-container-low px-3 py-2">
    <p className="text-[10px] font-bold uppercase tracking-widest text-outline">저작자 표시</p>
    <div className="mt-1 flex items-center justify-between gap-3">
      <code className="break-all text-xs font-bold text-on-surface">{creditLine}</code>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(creditLine)}
        className="shrink-0 rounded bg-on-surface px-2.5 py-1 text-[10px] font-bold text-surface"
      >
        복사
      </button>
    </div>
  </div>
  <p className="mt-3 text-xs leading-relaxed text-on-surface-variant">
    모든 사용에는 위 저작자 표시가 필요합니다. 사용상 주의사항이 있는 이미지는 이 영역에 별도로 표시됩니다.
  </p>
</div>
```

Keep a small collapsible or link-based CC detail later only if the current page already has an appropriate area. Do not keep CC labels as the primary purchase decision UI.

- [ ] **Step 7: Run TypeScript/lint checks**

Run:

```bash
npm run lint -- 'src/app/(public)/library/[id]/page.tsx' src/lib/store/cart.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(public)/library/[id]/page.tsx' src/lib/store/cart.ts
git commit -m "feat: show buyer usage summary on image detail"
```

---

## Task 5: Update Cart And PDF Statement Snapshots

**Files:**
- Modify: `src/app/(public)/cart/page.tsx`
- Modify: `src/lib/cart/print.ts`
- Modify: `src/lib/cart/print.test.ts`

- [ ] **Step 1: Inspect current cart rendering**

Run:

```bash
sed -n '1,320p' 'src/app/(public)/cart/page.tsx'
```

Expected: identify where photographer/license labels are rendered.

- [ ] **Step 2: Render credit line and simplified usage labels**

In the cart item rendering block, replace photographer/license display with:

```tsx
<p className="text-xs text-on-surface-variant">
  저작자 표시: <span className="font-semibold text-on-surface">{item.creditLine}</span>
</p>
<div className="mt-2 flex flex-wrap gap-1.5">
  {item.usageConditions.map((condition) => (
    <span key={condition} className="rounded-full bg-surface-container-low px-2 py-1 text-[10px] font-bold text-on-surface-variant">
      {condition}
    </span>
  ))}
</div>
```

If the cart still needs internal price license selection, leave the selector but change its label to "구매 옵션" rather than "라이선스" in this task.

- [ ] **Step 3: Include credit line in printable statement data**

If `cart/page.tsx` builds a PDF/print table manually, add these columns:

```text
에셋 ID
이미지
상품명
저작자 표시
사용 조건
금액
```

Use `item.creditLine` for the credit cell and `item.usageConditions.join(", ")` for the usage-condition cell.

- [ ] **Step 4: Keep print thumbnails watermarked**

In `src/lib/cart/print.ts`, ensure `cartStatementThumbnailUrl` still calls:

```ts
const proxied = thumbnailUrlFromPreviewUrl(src, width, height);
```

Do not add any direct use of `src` for printable image elements except as the encoded source inside the server thumbnail route.

- [ ] **Step 5: Add a cart print regression test for no direct source**

Add this to `src/lib/cart/print.test.ts`:

```ts
it("keeps the original preview URL encoded behind the thumbnail route", () => {
  const src = "https://example.supabase.co/storage/v1/object/public/images-preview/a.jpg";
  const url = cartStatementThumbnailUrl(src, "https://imagepartners.kr");
  const parsed = new URL(url);

  expect(parsed.pathname).toBe("/api/images/thumbnail");
  expect(parsed.toString()).not.toBe(src);
  expect(parsed.searchParams.get("src")).toBe(src);
});
```

- [ ] **Step 6: Run focused checks**

Run:

```bash
npm test -- src/lib/cart/print.test.ts
npm run lint -- 'src/app/(public)/cart/page.tsx' src/lib/cart/print.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add 'src/app/(public)/cart/page.tsx' src/lib/cart/print.ts src/lib/cart/print.test.ts
git commit -m "feat: snapshot buyer credit lines in cart"
```

---

## Task 6: Final Verification

**Files:**
- All files changed in Tasks 1-5.

- [ ] **Step 1: Run full unit tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Manual browser verification**

Run:

```bash
npm run dev
```

Open the local site and verify:

- Library filters show `무료 사용 가능`, `교육용 무료`, `상업 사용 가능`, `변경 가능`.
- No `CC` filter row is visible as the primary filter.
- Image detail preview image URL is `/api/images/thumbnail?...`.
- The detail page no longer renders repeated HTML watermark text over the image.
- The displayed sample still visibly contains the fused watermark.
- The right purchase panel shows `photographerID / Image Partners`.
- Cart shows the same credit line.
- Cart/PDF statement thumbnails load through `/api/images/thumbnail`.

- [ ] **Step 5: Commit verification-only fixes if needed**

If manual verification exposes small copy/layout regressions, fix only those regressions and commit:

```bash
git add 'src/app/(public)/library/page.tsx' 'src/app/(public)/library/[id]/page.tsx' 'src/app/(public)/cart/page.tsx' src/lib/utils/watermark.ts src/lib/supabase/storage.ts src/lib/licenses/creative-commons.ts src/lib/cart/print.ts
git commit -m "fix: polish buyer preview and license UI"
```

Do not combine unrelated Batch 2 search-to-request work in this commit.

---

## Out Of Scope For This Plan

- Batch upload workflow.
- Search-intent AI parsing.
- Photo sourcing request drafts.
- Admin navigation regrouping.
- Arweave proof ledger screens.
- Onchain payment route hiding.
- Native app or push notifications.
