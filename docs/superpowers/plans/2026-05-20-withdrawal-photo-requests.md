# Withdrawal And Photo Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or equivalent task-by-task execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add operationally safe photographer withdrawal handling and upgrade the existing contact inquiry workflow so buyers can submit photo requests routed by photographer activity regions.

**Architecture:** Withdrawal is a risk-assessment workflow that blocks unsafe immediate deletion and creates admin review records. Photo requests are treated as an advanced `contact_submissions` inquiry type, not a separate public product surface; the existing contact/admin support flow gains structured request fields, region matching, and photographer inbox states.

**Tech Stack:** Next.js App Router, Supabase/Postgres migrations and RLS, TypeScript helper tests with Vitest, existing dashboard/admin Tailwind UI patterns.

---

### Task 1: Withdrawal Workflow Guard

**Files:**
- Create: `supabase/migrations/029_profile_withdrawal_workflow.sql`
- Create: `src/lib/profiles/withdrawal.ts`
- Create: `src/lib/profiles/withdrawal.test.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/(admin)/admin/users/page.tsx`
- Create: `src/app/api/admin/profile-withdrawal-requests/route.ts`
- Create: `src/app/(admin)/admin/profile-withdrawal-requests/page.tsx`

- [x] Add `profile_withdrawal_requests` table with requester, target profile, requester role, status, impact snapshot, admin note, timestamps, and admin RLS.
- [x] Implement `assessProfileWithdrawal()` that returns `canDeleteImmediately`, blocking reasons, and required actions using counts for active images, sold images, onchain/arweave images, pending orders, pending payouts, and claimable earnings.
- [x] Update admin user deletion API: buyers or empty photographers can still be soft-deleted; photographers with blocking records create a withdrawal review request and return HTTP `409` with the assessment instead of deleting.
- [x] Update admin users UI: show the returned assessment and label the action as withdrawal review when deletion is blocked.
- [x] Add admin withdrawal queue for approval/rejection/completion tracking.
- [x] Add tests for empty photographer, sold image, onchain image, pending order, pending payout, and claimable earnings cases.

### Task 2: Contact Photo Request Database And API

**Files:**
- Create: `supabase/migrations/030_contact_photo_request_workflow.sql`
- Create: `src/lib/contact/request-fields.ts`
- Create: `src/lib/contact/request-fields.test.ts`
- Modify: `src/app/api/contact/route.ts`

- [x] Extend `contact_submissions` with `inquiry_type`, request status, structured photo request fields, and reference metadata while keeping existing general contact submissions compatible.
- [x] Add `photo_request_matches` table referencing `contact_submissions(id)` with photographer-safe RLS.
- [x] Implement validation helpers for title, brief, location label, region labels, budget range, deadline, reference image URL, and status values.
- [x] Update `POST /api/contact` so `inquiry_type = general` preserves current behavior and `inquiry_type = photo_request` requires structured request fields.
- [x] Include a normalized `target_regions` text array so admin matching can use the photographer `primary_activity_regions` field.
- [x] Add tests for validation helpers.

### Task 3: Contact Page Photo Request UI

**Files:**
- Modify: `src/app/(public)/contact/page.tsx`

- [x] Add a segmented choice inside the existing contact form: general inquiry or photo request.
- [x] For photo requests, show purpose/title, detailed brief, location, target regions, deadline, budget, usage/license intent, reference URL, and non-copying attestation.
- [x] Submit to `/api/contact` and show success state.
- [x] Keep UI dense and operational, not a marketing page.

### Task 4: Admin Support And Photographer Request Queues

**Files:**
- Modify: `src/app/api/admin/support/route.ts`
- Modify: `src/app/(admin)/admin/support/page.tsx`
- Create: `src/app/api/contact/matches/route.ts`
- Create: `src/app/(dashboard)/dashboard/requests/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [x] Admin support can filter/label photo requests, inspect buyer brief, and create candidate matches by region.
- [x] Matching scores should be simple and explainable: exact activity region overlap first, partial text overlap second.
- [x] Photographer dashboard shows matched requests and allows `interested` or `declined` status.
- [x] Dashboard navigation link is added for photographer request inbox; admin uses the existing `고객 문의` menu.

### Task 5: Integration And Release

**Files:**
- Update any types or route consumers needed by Tasks 1-4.

- [x] Run `npm test`.
- [x] Run `npx tsc --noEmit --pretty false`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Apply Supabase migrations with `npx supabase db push --linked`.
- [x] Confirm migration list shows `001` through `030`.
- [ ] Open PR, wait for checks, merge, and verify production.
