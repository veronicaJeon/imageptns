# Multi-Category Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move image categories to an admin-managed database source and allow each image to carry multiple categories while preserving the existing primary `images.category` compatibility field.

**Architecture:** Add `image_categories` and `image_category_assignments` tables. Keep `images.category` as the primary category for old consumers, and sync the assignment table whenever uploads or admin edits change categories. Public Library, upload forms, and admin image editing fetch categories from category APIs instead of hard-coded lists.

**Tech Stack:** Next.js App Router, Supabase/Postgres migrations, Supabase service-role APIs, React client components, Vitest.

---

### Task 1: Category Helpers

**Files:**
- Modify: `src/lib/images/categories.ts`
- Test: `src/lib/images/categories.test.ts`

- [ ] Add failing tests for category normalization:
  - duplicate category codes collapse while preserving order
  - invalid codes are ignored when an allowed-code set is supplied
  - primary category is the first normalized code, falling back to a safe default
- [ ] Run `npx vitest run src/lib/images/categories.test.ts` and confirm failure.
- [ ] Implement `normalizeCategoryCodes`, `primaryCategoryCode`, and `categoryAssignmentRows`.
- [ ] Re-run `npx vitest run src/lib/images/categories.test.ts`.

### Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/043_image_categories.sql`

- [ ] Create `image_categories` with `code`, localized labels, `sort_order`, `active`, timestamps.
- [ ] Seed current default categories.
- [ ] Create `image_category_assignments` with `(image_id, category_code)` primary key and `is_primary`.
- [ ] Backfill existing rows from `images.category`.
- [ ] Drop the old `images_category_check` constraint so admin-managed codes can be used.
- [ ] Update `search_images` category filtering to match either primary category or assignment rows.

### Task 3: Category APIs

**Files:**
- Create: `src/app/api/categories/route.ts`
- Create: `src/app/api/admin/categories/route.ts`
- Create: `src/app/api/admin/categories/[code]/route.ts`
- Create: `src/lib/images/category-server.ts`

- [ ] Public API returns active categories ordered by `sort_order`.
- [ ] Admin API lists all categories, creates categories, updates labels/order/active state.
- [ ] Assignment helper syncs categories for a given image id in a small transaction-like sequence.
- [ ] Fall back to default categories if production code is deployed before migration completion.

### Task 4: Upload And Image APIs

**Files:**
- Modify: `src/app/api/uploads/route.ts`
- Modify: `src/app/api/uploads/[id]/route.ts`
- Modify: `src/app/api/admin/images/[id]/route.ts`
- Modify: `src/app/api/images/route.ts`
- Modify: `src/app/api/images/[id]/route.ts`

- [ ] Accept `category_codes` while still accepting legacy `category`.
- [ ] Store the primary category in `images.category`.
- [ ] Sync `image_category_assignments` after insert/update.
- [ ] Include category arrays in list/detail responses where useful.
- [ ] Filter Library image query by assignment membership, not just `images.category`.

### Task 5: Category UI

**Files:**
- Create: `src/app/(admin)/admin/categories/page.tsx`
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(public)/library/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/uploads/new/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/uploads/page.tsx`
- Modify: `src/app/(admin)/admin/images/page.tsx`

- [ ] Add admin category management page and nav item.
- [ ] Library fetches `/api/categories` and renders those filters.
- [ ] New upload uses checkbox chips for multiple category selection.
- [ ] Upload edit and admin image edit support multi-select categories.

### Task 6: Verification And Production

- [ ] Run focused tests: `npx vitest run src/lib/images/categories.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `npm run build`.
- [ ] Apply migration to production through Supabase Management API or existing migration workflow.
- [ ] Deploy production with `npx vercel deploy --prod --yes`.
- [ ] Smoke test `/api/categories`, `/api/images?limit=1`, and upload/category admin endpoints.
