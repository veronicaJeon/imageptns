# Image Deletion Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operationally safe image deletion with admin deletion, photographer deletion requests, deletion fees, and buyer-facing deletion notices without breaking order, download, payout, or onchain records.

**Architecture:** Image rows get a separate lifecycle state so approval status remains intact while deleted/delisted images disappear from public sale. Deletion requests are reviewed by admins, and the policy helper classifies each image as purgeable or archive-only based on sales and proof status. Completed order items retain snapshots and surface deletion notices to buyers.

**Tech Stack:** Next.js App Router, Supabase Postgres/RLS/storage, TypeScript policy helpers with Vitest coverage, existing admin audit log.

---

### Task 1: Policy Helper And Tests

**Files:**
- Create: `src/lib/images/deletion.ts`
- Create: `src/lib/images/deletion.test.ts`

- [ ] **Step 1: Write failing tests**
  - Test that unsold and unregistered images are purgeable.
  - Test that sold or onchain-registered images are archive-only.
  - Test that photographer requests can include a default deletion fee.

- [ ] **Step 2: Run tests**
  - Run `npm test -- src/lib/images/deletion.test.ts`.
  - Expected: fails because the helper does not exist.

- [ ] **Step 3: Implement helper**
  - Export lifecycle/proof/request types, `assessImageDeletion`, `deletionImpactMessage`, and `defaultDeletionFeeKrw`.

- [ ] **Step 4: Run tests**
  - Run `npm test -- src/lib/images/deletion.test.ts`.
  - Expected: pass.

### Task 2: Database Migration

**Files:**
- Create: `supabase/migrations/026_image_deletion_policy.sql`

- [ ] **Step 1: Add columns**
  - Add `images.lifecycle_status`, deletion timestamps, reason, requester, and reviewer fields.
  - Add immutable snapshot and deletion notice fields to `order_items`.

- [ ] **Step 2: Add request table**
  - Create `image_deletion_requests` with requester/admin review fields, fee fields, impact snapshot, and status.

- [ ] **Step 3: Add RLS**
  - Photographer can read/create own requests.
  - Admin can read/update all requests.

### Task 3: APIs

**Files:**
- Create: `src/app/api/images/[id]/deletion-request/route.ts`
- Create: `src/app/api/admin/images/delete/route.ts`
- Create: `src/app/api/admin/image-deletion-requests/route.ts`
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/api/uploads/route.ts`
- Modify: `src/app/api/orders/route.ts`
- Modify: `src/app/api/download/[orderItemId]/route.ts`

- [ ] **Step 1: Photographer request API**
  - Allow the image owner to request deletion.
  - Store impact snapshot and estimated fee.

- [ ] **Step 2: Admin bulk delete API**
  - For selected images, purge only unsold/unregistered images.
  - Archive sold/onchain images by marking lifecycle as `archived` and filling buyer notices.

- [ ] **Step 3: Admin request review API**
  - Approve archives/purges, reject requests with admin note, and record audit logs.

- [ ] **Step 4: Query filters**
  - Hide archived/purged/legal-hold images from public sale while preserving order and download visibility.

### Task 4: UI

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Modify: `src/app/(admin)/admin/images/page.tsx`
- Create: `src/app/(admin)/admin/image-deletion-requests/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/uploads/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/orders/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/downloads/page.tsx`

- [ ] **Step 1: Admin image delete**
  - Add selected delete/archive button and show impact result.

- [ ] **Step 2: Admin deletion request queue**
  - Add list, approve, reject, fee, and impact summary.

- [ ] **Step 3: Photographer request**
  - Add deletion request action on uploads with estimated fee and reason.

- [ ] **Step 4: Buyer notices**
  - Show archived/deleted image notices in orders/downloads and keep license evidence visible.

### Task 5: Verification And Release

**Files:**
- All changed files.

- [ ] **Step 1: Run unit tests**
  - `npm test`

- [ ] **Step 2: Run lint and typecheck**
  - `npm run lint`
  - `npx tsc --noEmit --pretty false`

- [ ] **Step 3: Run production build**
  - `npm run build`

- [ ] **Step 4: Apply migration**
  - `npx supabase db push --linked`
  - `npx supabase migration list --linked`

- [ ] **Step 5: Publish**
  - Commit, push branch, create PR, merge after checks, confirm Vercel deployment.
