# Checkout Bulk Download And Admin Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let buyers select multiple purchased images on checkout success and download them as a zip, and reorganize the admin menu into accordion groups for desktop and mobile.

**Architecture:** Reuse the existing `/api/download/bulk` endpoint and dashboard zip helper pattern for checkout success. Move admin navigation metadata into a small reusable module that exposes grouped nav sections and active-state helpers, then render those sections as accordions in the admin layout.

**Tech Stack:** Next.js App Router, React client components, existing Supabase-backed download APIs, Vitest.

---

### Task 1: Checkout Selection Helpers

**Files:**
- Create: `src/lib/checkout/success-downloads.ts`
- Test: `src/lib/checkout/success-downloads.test.ts`

- [ ] Write failing tests for initializing all purchased item ids as selected, toggling all ids, and toggling one id.
- [ ] Run `npx vitest run src/lib/checkout/success-downloads.test.ts` and confirm RED.
- [ ] Implement minimal pure helpers.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Admin Nav Group Helpers

**Files:**
- Create: `src/lib/admin/nav.ts`
- Test: `src/lib/admin/nav.test.ts`

- [ ] Write failing tests for group active matching and default-open group derivation.
- [ ] Run `npx vitest run src/lib/admin/nav.test.ts` and confirm RED.
- [ ] Implement grouped nav metadata and helper functions.
- [ ] Re-run the focused test and confirm GREEN.

### Task 3: Checkout Success UI

**Files:**
- Modify: `src/app/(public)/checkout/success/page.tsx`

- [ ] Import the checkout helpers and existing dashboard zip helper.
- [ ] Add checkbox per purchased item.
- [ ] Add 전체 선택 and selected bulk download controls.
- [ ] Keep existing single-image download buttons.

### Task 4: Admin Accordion Layout

**Files:**
- Modify: `src/app/(admin)/layout.tsx`

- [ ] Replace flat nav array with grouped sections from `src/lib/admin/nav.ts`.
- [ ] Desktop sidebar renders accordion sections, defaulting the active group open.
- [ ] Mobile bottom area becomes a compact accordion menu panel instead of every item crammed into the bottom nav.

### Task 5: Verification And Production

- [ ] Run focused tests for new helpers plus existing touched tests.
- [ ] Run `npm run lint`.
- [ ] Run `npx tsc --noEmit --pretty false`.
- [ ] Run `npm run build`.
- [ ] Deploy production and smoke test checkout/admin routes.
