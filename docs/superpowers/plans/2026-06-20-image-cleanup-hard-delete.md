# Image Cleanup Hard Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative admin-only beta cleanup flow that finds unused test images, permanently removes their storage files and `images` rows, and preserves purge logs.

**Architecture:** Add a purge log table and server-side hard-delete eligibility logic. Expose admin APIs for candidate listing and deletion execution, then add a dedicated `/admin/image-cleanup` screen. Existing sale/history-bearing images remain on the archive path and are not hard-deleted.

**Tech Stack:** Next.js App Router, Supabase Postgres/Storage, TypeScript, Vitest, existing admin auth/audit helpers.

---

### Task 1: Purge Log Schema

**Files:**
- Create: `supabase/migrations/041_image_purge_logs.sql`

- [ ] Add `public.image_purge_logs` with image/asset/title/photographer/deleter snapshots, storage path snapshot, reference counts, status snapshots, delete kind/reason, created/purged timestamps.
- [ ] Restrict RLS to admins only.

### Task 2: Eligibility Logic

**Files:**
- Create: `src/lib/images/hard-delete.ts`
- Test: `src/lib/images/hard-delete.test.ts`

- [ ] Add pure helpers that decide whether an image can be hard-deleted from row state plus reference counts.
- [ ] Cover safe, sold, ordered, onchain, Arweave, legal hold, and deletion-request cases.

### Task 3: Admin APIs

**Files:**
- Create: `src/app/api/admin/image-cleanup/candidates/route.ts`
- Create: `src/app/api/admin/image-cleanup/purge/route.ts`

- [ ] Candidate API accepts `createdBefore`, `status`, and `query`, then returns only eligible images with counts and total file size.
- [ ] Purge API accepts selected ids plus reason, re-checks eligibility server-side, removes storage files, deletes safe dependent rows, writes purge logs and admin audit logs, then deletes image rows.

### Task 4: Admin UI

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/admin/image-cleanup/page.tsx`

- [ ] Add admin menu item.
- [ ] Build candidate search/filter table with checkboxes, total count/size, and `영구삭제` typed confirmation modal.

### Task 5: Verification and Deploy

- [ ] Run `npx vitest run src/lib/images/hard-delete.test.ts`.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Apply Supabase migration.
- [ ] Deploy production and smoke test candidate API.
