# First Release Payment Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline bank-transfer payment path and close first-release admin/buyer UI gaps.

**Architecture:** Reuse existing order completion side effects by storing bank-transfer requests as pending `orders`. Add a small pricing override table and centralize override-aware price calculation in checkout-facing APIs. Admin pages expose review and edit controls while buyer pages only show request status and download availability.

**Tech Stack:** Next.js App Router, Supabase/Postgres migrations, Supabase service-role APIs, React client pages, existing commerce/pricing helpers, Vitest/TypeScript/lint/build verification.

---

### Task 1: Database Shape

**Files:**
- Create: `supabase/migrations/037_bank_transfer_and_image_price_overrides.sql`

- [ ] Add order provider/status fields for bank transfer.
- [ ] Add `image_price_overrides` with image/license uniqueness.
- [ ] Add indexes used by admin request queues and checkout price loading.

### Task 2: Pricing Helper

**Files:**
- Modify: `src/lib/commerce/pricing.ts`
- Test: `src/lib/commerce/pricing.test.ts`

- [ ] Add override-aware license price resolution.
- [ ] Keep zero KRW valid and reject invalid license codes.

### Task 3: Bank Transfer Checkout APIs

**Files:**
- Modify: `src/app/api/checkout/prepare/route.ts`
- Create: `src/app/api/checkout/bank-transfer/route.ts`

- [ ] Make prepare support `paymentProvider = 'bank_transfer'`.
- [ ] Create a bank-transfer response with order id, order number, amount, and account display fields.
- [ ] Ensure bank-transfer orders remain pending until admin approval.

### Task 4: Buyer Checkout UI

**Files:**
- Modify: `src/app/(public)/checkout/page.tsx`

- [ ] Add `계좌결제` method.
- [ ] Show the account popup after request creation.
- [ ] Route buyer to dashboard orders after acknowledging the popup.

### Task 5: Admin Payment Request Queue

**Files:**
- Modify: `src/app/(admin)/layout.tsx`
- Create: `src/app/(admin)/admin/payment-requests/page.tsx`
- Create: `src/app/api/admin/payment-requests/route.ts`

- [ ] List bank-transfer requests with buyer and image summaries.
- [ ] Approve by completing the order.
- [ ] Cancel by marking the order canceled.

### Task 6: Admin Image Editing

**Files:**
- Modify: `src/app/(admin)/admin/images/page.tsx`
- Modify: `src/app/api/admin/images/route.ts`
- Create: `src/app/api/admin/images/[id]/route.ts`

- [ ] Load and save editable image fields.
- [ ] Load and save per-license price overrides.
- [ ] Refresh the current image list after save.

### Task 7: Dense Layout Fixes

**Files:**
- Modify: `src/app/(dashboard)/dashboard/orders/page.tsx`
- Modify: `src/app/(admin)/admin/users/page.tsx`

- [ ] Convert buyer orders to a card-first responsive layout.
- [ ] Reduce admin user list columns and keep detail data in the side panel.

### Task 8: Verification

**Commands:**
- `npx vitest run src/lib/commerce/pricing.test.ts`
- `npx tsc --noEmit --pretty false`
- `npm run lint`
- `npm run build`

