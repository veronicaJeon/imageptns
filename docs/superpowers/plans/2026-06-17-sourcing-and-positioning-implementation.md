# Sourcing Requests And Positioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Image Partners library-first for publishers and upgrade the current photo request flow into a member-only image sourcing request workflow with private admin drafting, registered-image candidates, revision requests, and buyer-facing results.

**Architecture:** Keep `contact_submissions` as the base request record, add focused sourcing result/revision tables for buyer-facing answers, and keep `photo_request_matches` as an internal supply-network workflow. Split UI by audience: buyers use "My Sourcing Requests," admins use support/sourcing operations, photographers see only internal Image Partners availability requests.

**Tech Stack:** Next.js App Router, React client components, Supabase/Postgres migrations, Supabase server/admin clients, Zustand cart store, Vitest, ESLint, TypeScript.

---

## Scope And Execution Order

This plan has two phases:

1. **Phase 1: Site positioning and IA cleanup.** This can ship independently and should be implemented first.
2. **Phase 2: Image sourcing request workflow.** This builds on the existing contact/photo request workflow and adds buyer-facing result publishing.

Do not implement speculative paid sourcing, external unregistered image candidate records, or public buyer-photographer matching.

---

## File Map

### Phase 1: Site Positioning / IA

- Modify `src/app/(public)/page.tsx`: make `/` render the library-first experience.
- Create `src/app/(public)/about/page.tsx`: move the current brand/about landing content here, with copy and section cleanup.
- Modify `src/lib/i18n/ko.ts`: update Korean library, home/about, pricing, and footer strings.
- Modify `src/lib/i18n/en.ts`: remove visible `1994` claims from matching English auth/about/footer copy.
- Modify `src/components/layout/Footer.tsx`: simplify footer to confirmed company information only.
- Modify `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/forgot-password/page.tsx`: remove `Est. 1994`.
- Modify `src/app/(public)/pricing/page.tsx` if visible CTA text is hardcoded or comments need cleanup.
- Verify existing image orientation files: `src/lib/images/orientation.ts`, `src/lib/images/orientation.test.ts`, and upload route/component paths.

### Phase 2: Sourcing Workflow

- Create `supabase/migrations/035_sourcing_request_results.sql`: add result/candidate/revision tables and publishing controls.
- Create `src/lib/sourcing/status.ts` and `src/lib/sourcing/status.test.ts`: buyer/internal status mapping, rights labels, revision limit helpers.
- Create `src/lib/sourcing/candidates.ts` and `src/lib/sourcing/candidates.test.ts`: candidate visibility and eligible image checks.
- Modify `src/lib/contact/request-fields.ts` and `src/lib/contact/request-fields.test.ts`: rename/extend photo request payload semantics to sourcing purposes.
- Modify `src/app/(public)/contact/page.tsx`: update form labels and request purpose multi-select.
- Modify `src/lib/contact/photo-request-draft.ts` and test: produce sourcing request drafts without photographer-matching language.
- Create `src/app/(dashboard)/dashboard/sourcing/page.tsx`: buyer "My Sourcing Requests" list/detail result UI.
- Modify `src/app/(dashboard)/layout.tsx`: add buyer-facing "내 소싱 요청" navigation and keep photographer request language separate.
- Modify `src/app/api/contact/route.ts`: enforce member-only sourcing request submission if not already enforced for photo requests.
- Create `src/app/api/sourcing/requests/route.ts`: buyer list/detail endpoint.
- Create `src/app/api/sourcing/requests/[id]/revision/route.ts`: buyer revision endpoint.
- Modify `src/app/api/admin/support/route.ts`: include sourcing draft/result data, publish answers, attach/remove/reorder candidates, and expose internal statuses.
- Modify `src/app/(admin)/admin/support/page.tsx`: admin drafting/publishing UI for sourcing requests.
- Modify `src/app/(dashboard)/dashboard/requests/page.tsx`: rename photographer view to internal Image Partners request language.
- Modify `src/app/api/contact/matches/route.ts`: prevent selected/cancelled matches from being overwritten by photographer responses.
- Modify `src/lib/email/contact.ts` and `src/lib/email/resend.ts`: buyer answer notification email helper.

---

## Phase 1 Tasks

### Task 1: Make `/` Library-First And Move Current Landing Page To `/about`

**Files:**
- Modify: `src/app/(public)/page.tsx`
- Create: `src/app/(public)/about/page.tsx`
- Test by command: `npm run build`

- [ ] **Step 1: Copy current landing page into `/about`**

Create `src/app/(public)/about/page.tsx` by moving the current contents of `src/app/(public)/page.tsx` into the new file. Keep the component name `AboutPage`.

Key top of file:

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { NoticePopup } from "@/components/ui/NoticePopup";
import { useLang } from "@/lib/i18n/store";

export default function AboutPage() {
  const { t } = useLang();
  const h = t.home;

  return (
    <>
      <NoticePopup />
      {/* moved brand/about page content */}
    </>
  );
}
```

- [ ] **Step 2: Replace `/` with the library page**

Modify `src/app/(public)/page.tsx` so the root route renders the existing library page component.

```tsx
export { default } from "./library/page";
```

- [ ] **Step 3: Hide unverified `/about` sections**

In `src/app/(public)/about/page.tsx`, remove or comment out these sections from rendering:

- Timeline section.
- Partners section.
- Restoration-related value card if still present after copy changes.
- Founding badge if copy still displays `창립 1994`.

Use JSX comments for large sections so the content is easy to restore when the company history copy is verified:

```tsx
{/*
  Timeline is hidden until company history copy is verified.
*/}
```

- [ ] **Step 4: Verify routing**

Run:

```bash
npm run build
```

Expected: build passes and route list includes both `/` and `/about`.

- [ ] **Step 5: Commit**

```bash
git add src/app/'(public)'/page.tsx src/app/'(public)'/about/page.tsx
git commit -m "feat: make library the home route"
```

### Task 2: Apply Korean Positioning Copy And Remove 1994 Claims

**Files:**
- Modify: `src/lib/i18n/ko.ts`
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/(auth)/forgot-password/page.tsx`
- Test by command: `rg -n "1994|Est\\. 1994|창립 1994|1994년부터" src`

- [ ] **Step 1: Update library hero Korean copy**

In `src/lib/i18n/ko.ts`, change:

```ts
library: {
  hero: {
    sub: "퍼블리셔를 위한 정확한 이미지",
  },
}
```

Preserve the existing headline and search placeholder in this task.

- [ ] **Step 2: Update about/home Korean copy**

In `src/lib/i18n/ko.ts`, update the `home` strings:

```ts
home: {
  hero: {
    badge: "",
    headline1: "퍼블리셔를 위한",
    headline2: "정확한 이미지",
    description: "프리미엄 아카이브 및 현대 이미지 에이전시. 역사적 의미와 현대적 스토리텔링 사이의 간극을 잇습니다.",
  },
  about: {
    body: "무한한 이미지 속에서 가치 있는 시각 정보를 선별합니다. 이미지파트너스는 단순한 데이터 저장소가 아닌, 엄선된 작품을 선보이는 갤러리입니다. 우리는 창작자들에게 필요한 단편적인 에셋을 넘어, 이미지에 문맥과 서사, 생명력을 불어넣어 완성된 이야기를 제공합니다.",
    floatTitle: "",
    floatBody: "",
  },
  values: {
    items: [
      {
        title: "오직 확실한 것만 전합니다",
        desc: "검증된 이미지와 사용 조건을 중심으로, 퍼블리셔가 안심하고 선택할 수 있는 자료만 선별합니다.",
      },
      {
        title: "검증된 캡션",
        desc: "이미지의 출처 및 캡션의 정확성을 생명으로 생각합니다.",
      },
      {
        title: "글로벌 파트너와 함께",
        desc: "글로벌 파트너와 함께 현지의 시각과 맥락을 담은 이미지를 선별합니다.",
      },
    ],
  },
  cta: {
    contact: "문의",
  },
}
```

Adjust field names to match the existing `ko.ts` object shape exactly.

- [ ] **Step 3: Update pricing CTA Korean copy**

In `src/lib/i18n/ko.ts`, replace visible `영업팀 문의`, `영업팀과 상담하기` with:

```ts
cta: "문의"
btn: "문의"
```

Preserve pricing structure and plan names.

- [ ] **Step 4: Remove visible 1994 copy from auth screens**

In each auth page, remove the paragraph:

```tsx
<p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-6">Est. 1994</p>
```

Files:

- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`
- `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 5: Search for remaining 1994 claims**

Run:

```bash
rg -n "1994|Est\\. 1994|창립 1994|1994년부터" src
```

Expected: no visible UI copy remains. If matches remain in hidden/commented about sections, confirm they are not rendered or remove the strings from i18n.

- [ ] **Step 6: Run focused checks**

Run:

```bash
npm run lint -- src/lib/i18n/ko.ts src/lib/i18n/en.ts src/app/'(auth)'/login/page.tsx src/app/'(auth)'/signup/page.tsx src/app/'(auth)'/forgot-password/page.tsx
npx tsc --noEmit --pretty false
```

Expected: both commands pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/i18n/ko.ts src/lib/i18n/en.ts src/app/'(auth)'/login/page.tsx src/app/'(auth)'/signup/page.tsx src/app/'(auth)'/forgot-password/page.tsx
git commit -m "fix: align launch positioning copy"
```

### Task 3: Simplify Footer To Confirmed Company Information

**Files:**
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/lib/i18n/ko.ts`
- Modify: `src/lib/i18n/en.ts`

- [ ] **Step 1: Replace footer link columns with company info**

Modify `src/components/layout/Footer.tsx` to remove `FOOTER_DATA` and render only brand and confirmed info:

```tsx
"use client";

import { useLang } from "@/lib/i18n/store";

export function Footer() {
  const { t } = useLang();
  const f = t.footer;

  return (
    <footer className="bg-surface-container-low w-full py-12 px-6 md:px-8 font-body text-sm">
      <div className="max-w-7xl mx-auto flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-xl">
          <div className="text-base font-headline font-black uppercase tracking-tighter text-on-surface mb-3">
            IMAGE PARTNERS
          </div>
          <p className="text-on-surface-variant leading-relaxed">{f.tagline}</p>
          <p className="mt-5 text-outline text-xs">{f.copyright}</p>
        </div>
        <address className="not-italic text-on-surface-variant leading-relaxed">
          <p className="font-bold text-on-surface">{f.company.title}</p>
          <p>{f.company.address}</p>
          <a href={`mailto:${f.company.email}`} className="hover:text-primary transition-colors">
            {f.company.email}
          </a>
        </address>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Add footer company strings**

In `src/lib/i18n/ko.ts`:

```ts
footer: {
  tagline: "퍼블리셔를 위한 정확한 이미지를 선별합니다.",
  company: {
    title: "회사 정보",
    address: "서울시 서대문구 거북골로 21길57 제1호",
    email: "helpimagepartners@gmail.com",
  },
}
```

In `src/lib/i18n/en.ts`:

```ts
footer: {
  tagline: "Accurate images for publishers.",
  company: {
    title: "Company",
    address: "No. 1, 57, Geobukgol-ro 21-gil, Seodaemun-gu, Seoul",
    email: "helpimagepartners@gmail.com",
  },
}
```

Keep any required existing keys if TypeScript types expect them, but do not render resource/legal/company link sections.

- [ ] **Step 3: Run checks**

```bash
npm run lint -- src/components/layout/Footer.tsx src/lib/i18n/ko.ts src/lib/i18n/en.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Footer.tsx src/lib/i18n/ko.ts src/lib/i18n/en.ts
git commit -m "fix: simplify public footer"
```

### Task 4: Verify Image Orientation Handling

**Files:**
- Inspect: `src/lib/images/orientation.ts`
- Inspect/Test: `src/lib/images/orientation.test.ts`
- Inspect: upload API/component paths referenced by `rg -n "orientation|exifr|rotate|sharp" src`

- [ ] **Step 1: Run existing orientation tests**

```bash
npm test -- src/lib/images/orientation.test.ts
```

Expected: tests pass.

- [ ] **Step 2: Inspect orientation usage**

Run:

```bash
rg -n "orientation|normalize|rotate|sharp|exifr" src/lib src/app/api src/components/upload src/app/'(dashboard)'/dashboard/uploads -S
```

Expected: upload path calls the orientation helper or `sharp().rotate()` before storing preview/full variants.

- [ ] **Step 3: Decide whether code change is needed**

If the helper is already used, make no code change and record in the implementation summary: "orientation fix exists locally; deployment may be behind."

If the helper is not used, add a failing test around the helper or upload utility first:

```ts
import { describe, expect, it } from "vitest";
import { shouldSwapDimensionsForOrientation } from "./orientation";

describe("orientation dimensions", () => {
  it("keeps portrait dimensions portrait when EXIF orientation requires rotation", () => {
    expect(shouldSwapDimensionsForOrientation(6)).toBe(true);
  });
});
```

Then wire the upload processing path to use the existing helper.

- [ ] **Step 4: Run checks**

```bash
npm test -- src/lib/images/orientation.test.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 5: Commit if code changed**

```bash
git add src/lib/images/orientation.ts src/lib/images/orientation.test.ts src/app/api/uploads/route.ts src/app/api/uploads/presign/route.ts src/components/upload/UploadForm.tsx src/app/'(dashboard)'/dashboard/uploads/new/page.tsx
git commit -m "fix: preserve uploaded image orientation"
```

If no code changed, do not commit.

---

## Phase 2 Tasks

### Task 5: Add Sourcing Domain Helpers

**Files:**
- Create: `src/lib/sourcing/status.ts`
- Create: `src/lib/sourcing/status.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/sourcing/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  BUYER_SOURCING_STATUSES,
  RIGHTS_CHECK_RESULTS,
  canRequestRevision,
  internalToBuyerSourcingStatus,
  revisionLimitNotice,
} from "./status";

describe("sourcing status helpers", () => {
  it("maps internal statuses to simple buyer statuses", () => {
    expect(internalToBuyerSourcingStatus("submitted")).toBe("received");
    expect(internalToBuyerSourcingStatus("matching")).toBe("under_review");
    expect(internalToBuyerSourcingStatus("drafting")).toBe("under_review");
    expect(internalToBuyerSourcingStatus("answered")).toBe("answer_ready");
    expect(internalToBuyerSourcingStatus("fulfilled")).toBe("closed");
    expect(internalToBuyerSourcingStatus("cancelled")).toBe("closed");
  });

  it("exports stable buyer status and rights result labels", () => {
    expect(BUYER_SOURCING_STATUSES.map((status) => status.labelKo)).toEqual([
      "접수됨",
      "검토 중",
      "후보 제안됨",
      "종료",
    ]);
    expect(RIGHTS_CHECK_RESULTS.map((result) => result.labelKo)).toEqual([
      "사용 가능",
      "조건부 가능",
      "확인 불가",
      "사용 비권장",
    ]);
  });

  it("allows at most three buyer revision requests", () => {
    expect(canRequestRevision(0)).toBe(true);
    expect(canRequestRevision(2)).toBe(true);
    expect(canRequestRevision(3)).toBe(false);
    expect(revisionLimitNotice).toBe("이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요.");
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npm test -- src/lib/sourcing/status.test.ts
```

Expected: fail because `src/lib/sourcing/status.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/sourcing/status.ts`:

```ts
export type BuyerSourcingStatusCode = "received" | "under_review" | "answer_ready" | "closed";
export type RightsCheckResultCode = "usable" | "conditional" | "unverified" | "not_recommended";

export const revisionLimitNotice =
  "이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요.";

export const BUYER_SOURCING_STATUSES: Array<{ code: BuyerSourcingStatusCode; labelKo: string }> = [
  { code: "received", labelKo: "접수됨" },
  { code: "under_review", labelKo: "검토 중" },
  { code: "answer_ready", labelKo: "후보 제안됨" },
  { code: "closed", labelKo: "종료" },
];

export const RIGHTS_CHECK_RESULTS: Array<{ code: RightsCheckResultCode; labelKo: string }> = [
  { code: "usable", labelKo: "사용 가능" },
  { code: "conditional", labelKo: "조건부 가능" },
  { code: "unverified", labelKo: "확인 불가" },
  { code: "not_recommended", labelKo: "사용 비권장" },
];

export function internalToBuyerSourcingStatus(status: string | null | undefined): BuyerSourcingStatusCode {
  if (status === "answered") return "answer_ready";
  if (status === "fulfilled" || status === "cancelled" || status === "rejected" || status === "closed") {
    return "closed";
  }
  if (status === "submitted") return "received";
  return "under_review";
}

export function canRequestRevision(revisionCount: number) {
  return Number.isFinite(revisionCount) && revisionCount < 3;
}
```

- [ ] **Step 4: Verify helper tests pass**

```bash
npm test -- src/lib/sourcing/status.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sourcing/status.ts src/lib/sourcing/status.test.ts
git commit -m "feat: add sourcing status helpers"
```

### Task 6: Add Sourcing Result Database Migration

**Files:**
- Create: `supabase/migrations/035_sourcing_request_results.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/035_sourcing_request_results.sql`:

```sql
-- IMAGE PARTNERS - Buyer sourcing request results

alter table public.contact_submissions
  add column if not exists buyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists sourcing_purposes text[] not null default '{}'::text[],
  add column if not exists internal_sourcing_status text not null default 'submitted',
  add column if not exists buyer_sourcing_status text not null default 'received';

alter table public.contact_submissions
  drop constraint if exists contact_submissions_sourcing_purposes_check,
  drop constraint if exists contact_submissions_internal_sourcing_status_check,
  drop constraint if exists contact_submissions_buyer_sourcing_status_check;

alter table public.contact_submissions
  add constraint contact_submissions_sourcing_purposes_check
    check (
      sourcing_purposes <@ array['rights_check','similar_search','supply_check']::text[]
      and cardinality(sourcing_purposes) <= 3
    ),
  add constraint contact_submissions_internal_sourcing_status_check
    check (internal_sourcing_status in (
      'submitted','rights_check_needed','similar_searching','supply_checking',
      'drafting','ready_to_send','answered','closed','on_hold','unavailable'
    )),
  add constraint contact_submissions_buyer_sourcing_status_check
    check (buyer_sourcing_status in ('received','under_review','answer_ready','closed'));

create table if not exists public.sourcing_request_answers (
  id uuid primary key default gen_random_uuid(),
  contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  answer_text text,
  rights_result text,
  rights_explanation text,
  status text not null default 'draft',
  revision_round integer not null default 0,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  constraint sourcing_request_answers_status_check
    check (status in ('draft','published')),
  constraint sourcing_request_answers_rights_result_check
    check (rights_result is null or rights_result in ('usable','conditional','unverified','not_recommended')),
  constraint sourcing_request_answers_revision_round_check
    check (revision_round >= 0 and revision_round <= 3)
);

create index if not exists sourcing_request_answers_submission_idx
  on public.sourcing_request_answers(contact_submission_id, created_at desc);

create table if not exists public.sourcing_request_candidates (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.sourcing_request_answers(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  sort_order integer not null default 0,
  is_visible boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  constraint sourcing_request_candidates_unique_image unique (answer_id, image_id)
);

create index if not exists sourcing_request_candidates_answer_order_idx
  on public.sourcing_request_candidates(answer_id, sort_order asc, created_at asc);

create table if not exists public.sourcing_request_revisions (
  id uuid primary key default gen_random_uuid(),
  contact_submission_id uuid not null references public.contact_submissions(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  round integer not null,
  reasons text[] not null default '{}'::text[],
  message text not null,
  created_at timestamptz not null default now(),
  constraint sourcing_request_revisions_round_check
    check (round >= 1 and round <= 3),
  constraint sourcing_request_revisions_reasons_check
    check (reasons <@ array[
      'wrong_location','wrong_season_or_time','wrong_composition',
      'usage_terms_do_not_fit','price_does_not_fit','need_more_candidates','other'
    ]::text[])
);

create index if not exists sourcing_request_revisions_submission_idx
  on public.sourcing_request_revisions(contact_submission_id, round asc);

create index if not exists contact_submissions_buyer_sourcing_idx
  on public.contact_submissions(buyer_id, created_at desc)
  where inquiry_type = 'photo_request';

alter table public.sourcing_request_answers enable row level security;
alter table public.sourcing_request_candidates enable row level security;
alter table public.sourcing_request_revisions enable row level security;

drop policy if exists "sourcing answers: admin all" on public.sourcing_request_answers;
create policy "sourcing answers: admin all"
  on public.sourcing_request_answers for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing candidates: admin all" on public.sourcing_request_candidates;
create policy "sourcing candidates: admin all"
  on public.sourcing_request_candidates for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing revisions: admin all" on public.sourcing_request_revisions;
create policy "sourcing revisions: admin all"
  on public.sourcing_request_revisions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "sourcing answers: buyer select published own" on public.sourcing_request_answers;
create policy "sourcing answers: buyer select published own"
  on public.sourcing_request_answers for select
  using (
    status = 'published'
    and exists (
      select 1 from public.contact_submissions c
      where c.id = sourcing_request_answers.contact_submission_id
        and c.inquiry_type = 'photo_request'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );

drop policy if exists "sourcing candidates: buyer select visible own" on public.sourcing_request_candidates;
create policy "sourcing candidates: buyer select visible own"
  on public.sourcing_request_candidates for select
  using (
    is_visible = true
    and exists (
      select 1
      from public.sourcing_request_answers a
      join public.contact_submissions c on c.id = a.contact_submission_id
      where a.id = sourcing_request_candidates.answer_id
        and a.status = 'published'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );

drop policy if exists "sourcing revisions: buyer insert own" on public.sourcing_request_revisions;
create policy "sourcing revisions: buyer insert own"
  on public.sourcing_request_revisions for insert
  with check (
    buyer_id = auth.uid()
    and exists (
      select 1 from public.contact_submissions c
      where c.id = sourcing_request_revisions.contact_submission_id
        and c.inquiry_type = 'photo_request'
        and (c.buyer_id = auth.uid() or c.email = (select email from auth.users where id = auth.uid()))
    )
  );
```

- [ ] **Step 2: Reset local database**

```bash
npm run supabase:reset
```

Expected: migrations apply successfully.

- [ ] **Step 3: Verify migration list**

```bash
supabase migration list --local --workdir .
```

Expected: migration `035` appears under Local.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/035_sourcing_request_results.sql
git commit -m "feat: add sourcing request result schema"
```

### Task 7: Extend Contact Request Normalization For Sourcing Purposes

**Files:**
- Modify: `src/lib/contact/request-fields.ts`
- Modify: `src/lib/contact/request-fields.test.ts`
- Modify: `src/app/api/contact/route.ts`

- [ ] **Step 1: Add failing tests for sourcing purposes**

Append to `src/lib/contact/request-fields.test.ts`:

```ts
import { normalizeSourcingPurposes } from "./request-fields";

describe("normalizeSourcingPurposes", () => {
  it("normalizes unique supported sourcing purposes", () => {
    expect(normalizeSourcingPurposes(["rights_check", "similar_search", "rights_check"])).toEqual([
      "rights_check",
      "similar_search",
    ]);
  });

  it("defaults empty purpose input to similar search", () => {
    expect(normalizeSourcingPurposes(undefined)).toEqual(["similar_search"]);
  });

  it("rejects unsupported purpose values", () => {
    expect(() => normalizeSourcingPurposes(["photographer_matching"])).toThrow("sourcing_purposes");
  });
});
```

- [ ] **Step 2: Verify tests fail**

```bash
npm test -- src/lib/contact/request-fields.test.ts
```

Expected: fail because `normalizeSourcingPurposes` is not exported.

- [ ] **Step 3: Implement purpose normalization**

In `src/lib/contact/request-fields.ts`, add:

```ts
export const SOURCING_PURPOSES = ["rights_check", "similar_search", "supply_check"] as const;
export type SourcingPurpose = (typeof SOURCING_PURPOSES)[number];

export function normalizeSourcingPurposes(value: unknown): SourcingPurpose[] {
  const raw = Array.isArray(value) ? value : [];
  const purposes: SourcingPurpose[] = [];
  const seen = new Set<string>();

  for (const item of raw) {
    if (typeof item !== "string") throw new Error("sourcing_purposes must be a list of labels");
    const purpose = item.trim();
    if (!purpose) continue;
    if (!hasValue(SOURCING_PURPOSES, purpose)) {
      throw new Error("sourcing_purposes contains unsupported values");
    }
    if (seen.has(purpose)) continue;
    seen.add(purpose);
    purposes.push(purpose);
  }

  return purposes.length > 0 ? purposes : ["similar_search"];
}
```

Extend `NormalizedContactSubmission`:

```ts
buyer_id: string | null;
sourcing_purposes: SourcingPurpose[];
internal_sourcing_status: "submitted";
buyer_sourcing_status: "received";
```

For general inquiry return:

```ts
buyer_id: null,
sourcing_purposes: [],
internal_sourcing_status: "submitted",
buyer_sourcing_status: "received",
```

For photo/sourcing request return:

```ts
buyer_id: null,
sourcing_purposes: normalizeSourcingPurposes(body.sourcing_purposes),
internal_sourcing_status: "submitted",
buyer_sourcing_status: "received",
```

- [ ] **Step 4: Make `/api/contact` member-only for sourcing requests**

In `src/app/api/contact/route.ts`, after `submission` is normalized and before insert:

```ts
let buyerId: string | null = null;
if (submission.inquiry_type === "photo_request") {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "이미지 소싱 요청은 로그인 후 접수할 수 있습니다." }, { status: 401 });
  }
  buyerId = user.id;
}
```

Use the already-created `supabase` client. If the current code creates it after normalization, move client creation before this check without changing general inquiry behavior. Insert the request with the authenticated owner:

```ts
const insertPayload = {
  ...submission,
  buyer_id: buyerId,
};
```

- [ ] **Step 5: Run tests**

```bash
npm test -- src/lib/contact/request-fields.test.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contact/request-fields.ts src/lib/contact/request-fields.test.ts src/app/api/contact/route.ts
git commit -m "feat: add sourcing request purpose fields"
```

### Task 8: Update Buyer Request Form Language And Purpose Multi-Select

**Files:**
- Modify: `src/app/(public)/contact/page.tsx`
- Modify: `src/lib/contact/photo-request-draft.ts`
- Modify: `src/lib/contact/photo-request-draft.test.ts`

- [ ] **Step 1: Add failing draft test for sourcing purposes**

In `src/lib/contact/photo-request-draft.test.ts`, add:

```ts
it("keeps multiple sourcing purpose hints from search params", () => {
  const draft = draftPhotoRequestFromSearchParams(new URLSearchParams({
    mode: "photo",
    query: "지리산 천왕봉 사진",
    rightsCheck: "true",
    similarSearch: "true",
    supplyCheck: "true",
  }));

  expect(draft.sourcing_purposes).toEqual(["rights_check", "similar_search", "supply_check"]);
});
```

- [ ] **Step 2: Update draft type**

In `src/lib/contact/photo-request-draft.ts`, extend `PhotoRequestDraft`:

```ts
sourcing_purposes: Array<"rights_check" | "similar_search" | "supply_check">;
```

Return `[]` for non-photo mode and derive purposes from query params:

```ts
const purposes = [
  params.get("rightsCheck") === "true" ? "rights_check" : null,
  params.get("similarSearch") === "true" ? "similar_search" : null,
  params.get("supplyCheck") === "true" ? "supply_check" : null,
].filter(Boolean) as PhotoRequestDraft["sourcing_purposes"];
```

If no purpose is selected, default to `["similar_search"]`.

- [ ] **Step 3: Update contact form labels**

In `src/app/(public)/contact/page.tsx`:

- Rename tab label from `사진 의뢰` to `이미지 소싱 요청`.
- Change submit button text to `이미지 소싱 요청 접수`.
- Change brief label to `필요한 이미지 설명`.
- Add helper copy near the top:

```tsx
<div className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-on-surface-variant">
  원하는 이미지를 자연어로 설명해주세요. 권리 확인, 유사 이미지 탐색, 내부 보유 이미지 확인이 함께 필요할 수 있습니다.
</div>
```

- [ ] **Step 4: Add purpose checkboxes to form state**

Extend `photoForm` state:

```ts
sourcing_purposes: ["similar_search"] as Array<"rights_check" | "similar_search" | "supply_check">,
```

Add checkbox UI:

```tsx
const SOURCING_PURPOSE_OPTIONS = [
  { value: "rights_check", label: "권리 확인" },
  { value: "similar_search", label: "유사 이미지 탐색" },
  { value: "supply_check", label: "신규 촬영/보유 이미지 확인" },
] as const;
```

Render:

```tsx
<div className="md:col-span-2 flex flex-col gap-2">
  <label className="text-xs font-bold text-outline uppercase tracking-widest">요청 유형</label>
  <div className="flex flex-wrap gap-2">
    {SOURCING_PURPOSE_OPTIONS.map((option) => (
      <label key={option.value} className="flex items-center gap-2 rounded-full border border-outline-variant px-3 py-2 text-xs font-bold text-on-surface-variant">
        <input
          type="checkbox"
          checked={photoForm.sourcing_purposes.includes(option.value)}
          onChange={(event) => {
            setPhotoForm((prev) => {
              const next = event.target.checked
                ? Array.from(new Set([...prev.sourcing_purposes, option.value]))
                : prev.sourcing_purposes.filter((value) => value !== option.value);
              return { ...prev, sourcing_purposes: next.length > 0 ? next : ["similar_search"] };
            });
          }}
          className="h-4 w-4 accent-primary"
        />
        {option.label}
      </label>
    ))}
  </div>
</div>
```

- [ ] **Step 5: Include purposes in POST body**

When submitting photo/sourcing request:

```ts
sourcing_purposes: photoForm.sourcing_purposes,
```

- [ ] **Step 6: Run checks**

```bash
npm test -- src/lib/contact/photo-request-draft.test.ts
npm run lint -- src/app/'(public)'/contact/page.tsx src/lib/contact/photo-request-draft.ts src/lib/contact/photo-request-draft.test.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/'(public)'/contact/page.tsx src/lib/contact/photo-request-draft.ts src/lib/contact/photo-request-draft.test.ts
git commit -m "feat: clarify buyer sourcing request form"
```

### Task 9: Add Candidate Eligibility Helpers

**Files:**
- Create: `src/lib/sourcing/candidates.ts`
- Create: `src/lib/sourcing/candidates.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/sourcing/candidates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { candidateImageEligibility, canPublishCandidate } from "./candidates";

describe("candidate image eligibility", () => {
  it("allows only approved active published images", () => {
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "active", is_published: true })).toBe(true);
    expect(canPublishCandidate({ status: "pending", lifecycle_status: "active", is_published: true })).toBe(false);
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "archived", is_published: true })).toBe(false);
    expect(canPublishCandidate({ status: "approved", lifecycle_status: "active", is_published: false })).toBe(false);
  });

  it("returns buyer-safe reasons for ineligible images", () => {
    expect(candidateImageEligibility({ status: "approved", lifecycle_status: "active", is_published: false })).toEqual({
      eligible: false,
      reason: "image_not_published",
    });
  });
});
```

- [ ] **Step 2: Implement helper**

Create `src/lib/sourcing/candidates.ts`:

```ts
export interface CandidateImageState {
  status: string | null;
  lifecycle_status: string | null;
  is_published?: boolean | null;
}

export type CandidateIneligibleReason =
  | "image_not_approved"
  | "image_not_active"
  | "image_not_published";

export function candidateImageEligibility(image: CandidateImageState): {
  eligible: boolean;
  reason: CandidateIneligibleReason | null;
} {
  if (image.status !== "approved") return { eligible: false, reason: "image_not_approved" };
  if ((image.lifecycle_status ?? "active") !== "active") return { eligible: false, reason: "image_not_active" };
  if (image.is_published === false) return { eligible: false, reason: "image_not_published" };
  return { eligible: true, reason: null };
}

export function canPublishCandidate(image: CandidateImageState) {
  return candidateImageEligibility(image).eligible;
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/lib/sourcing/candidates.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/sourcing/candidates.ts src/lib/sourcing/candidates.test.ts
git commit -m "feat: add sourcing candidate eligibility"
```

### Task 10: Add Admin Image Publish Toggle

**Files:**
- Create migration: `supabase/migrations/036_image_publishing_controls.sql`
- Modify: `src/app/api/admin/images/route.ts`
- Create: `src/app/api/admin/images/[id]/publish/route.ts`
- Modify: `src/app/(admin)/admin/images/page.tsx`
- Modify: `src/app/api/images/route.ts`
- Modify: `src/app/api/images/[id]/route.ts`
- Modify: `src/app/api/search/suggest/route.ts`
- Modify: `src/app/api/photographer/[id]/route.ts`
- Modify: `src/app/api/checkout/prepare/route.ts`
- Modify: `src/app/api/collections/[id]/items/route.ts`
- Modify: `src/app/api/favorites/route.ts`

- [ ] **Step 1: Add migration**

Create `supabase/migrations/036_image_publishing_controls.sql`:

```sql
-- IMAGE PARTNERS - Image publishing controls

alter table public.images
  add column if not exists is_published boolean not null default true,
  add column if not exists unpublished_at timestamptz,
  add column if not exists unpublished_by uuid references public.profiles(id) on delete set null,
  add column if not exists unpublished_reason text;

create index if not exists images_published_library_idx
  on public.images(status, lifecycle_status, is_published, created_at desc);
```

- [ ] **Step 2: Update public image queries**

In every public buyer-facing image query, add:

```ts
.eq("is_published", true)
```

to the approved active image query.

Apply this to:

- `src/app/api/images/route.ts`
- `src/app/api/images/[id]/route.ts`
- `src/app/api/search/suggest/route.ts`
- `src/app/api/photographer/[id]/route.ts`
- `src/app/api/checkout/prepare/route.ts`
- `src/app/api/collections/[id]/items/route.ts`
- `src/app/api/favorites/route.ts`

For checkout, reject unpublished images before order preparation:

```ts
if (image.is_published === false) {
  return NextResponse.json({ error: "현재 구매할 수 없는 이미지가 포함되어 있습니다." }, { status: 409 });
}
```

- [ ] **Step 3: Expose publish state in admin image list**

In `src/app/api/admin/images/route.ts`, include fields:

```ts
is_published, unpublished_at, unpublished_reason
```

in the selected image columns and response mapping.

- [ ] **Step 4: Add admin publish API**

Create `src/app/api/admin/images/[id]/publish/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null) as { is_published?: unknown; reason?: unknown } | null;
  if (typeof body?.is_published !== "boolean") {
    return NextResponse.json({ error: "is_published is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("images")
    .select("id, title, is_published, unpublished_at, unpublished_reason")
    .eq("id", id)
    .single();

  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });

  const patch = body.is_published
    ? {
        is_published: true,
        unpublished_at: null,
        unpublished_by: null,
        unpublished_reason: null,
      }
    : {
        is_published: false,
        unpublished_at: new Date().toISOString(),
        unpublished_by: adminUser.id,
        unpublished_reason: typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null,
      };

  const { data, error } = await admin
    .from("images")
    .update(patch)
    .eq("id", id)
    .select("id, title, is_published, unpublished_at, unpublished_reason")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: body.is_published ? "image.published" : "image.unpublished",
    targetType: "image",
    targetId: id,
    targetLabel: data.title,
    before,
    after: data,
  });

  return NextResponse.json({ image: data });
}
```

- [ ] **Step 5: Add toggle to admin image page**

In `src/app/(admin)/admin/images/page.tsx`, add `is_published` to the image type and render a toggle in each row/card:

```tsx
<button
  type="button"
  onClick={() => togglePublished(image)}
  className={cn(
    "rounded-full px-3 py-1 text-[10px] font-bold",
    image.is_published ? "bg-primary/10 text-primary" : "bg-error/10 text-error"
  )}
>
  {image.is_published ? "게시 ON" : "게시 OFF"}
</button>
```

Add handler:

```ts
async function togglePublished(image: AdminImage) {
  const next = !image.is_published;
  const res = await fetch(`/api/admin/images/${image.id}/publish`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_published: next }),
  });
  const body = await res.json().catch(() => null) as { image?: Partial<AdminImage>; error?: string } | null;
  if (!res.ok) throw new Error(body?.error ?? "게시 상태를 변경하지 못했습니다.");
  setImages((prev) => prev.map((row) => row.id === image.id ? { ...row, ...body?.image } : row));
}
```

Use the page's existing error/alert pattern.

- [ ] **Step 6: Run migration and checks**

```bash
npm run supabase:reset
npm run lint -- src/app/api/admin/images/route.ts src/app/api/admin/images/'[id]'/publish/route.ts src/app/'(admin)'/admin/images/page.tsx src/app/api/images/route.ts src/app/api/images/'[id]'/route.ts src/app/api/search/suggest/route.ts src/app/api/photographer/'[id]'/route.ts src/app/api/checkout/prepare/route.ts src/app/api/collections/'[id]'/items/route.ts src/app/api/favorites/route.ts
npx tsc --noEmit --pretty false
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/036_image_publishing_controls.sql src/app/api/admin/images/route.ts src/app/api/admin/images/'[id]'/publish/route.ts src/app/'(admin)'/admin/images/page.tsx src/app/api/images/route.ts src/app/api/images/'[id]'/route.ts src/app/api/search/suggest/route.ts src/app/api/photographer/'[id]'/route.ts src/app/api/checkout/prepare/route.ts src/app/api/collections/'[id]'/items/route.ts src/app/api/favorites/route.ts
git commit -m "feat: add admin image publish controls"
```

### Task 11: Add Admin Sourcing Draft And Candidate Publishing API

**Files:**
- Modify: `src/app/api/admin/support/route.ts`
- Use helpers from: `src/lib/sourcing/status.ts`, `src/lib/sourcing/candidates.ts`

- [ ] **Step 1: Extend admin GET select**

In photo request query inside `src/app/api/admin/support/route.ts`, add nested answer/candidate select:

```ts
answers:sourcing_request_answers(
  id, answer_text, rights_result, rights_explanation, status, revision_round, published_at, created_at, updated_at,
  candidates:sourcing_request_candidates(
    id, image_id, sort_order, is_visible, note,
    image:images(id, asset_id, title, storage_path_preview, status, lifecycle_status, is_published, price_krw, copyright_license, free_usage_policy, photographer_id)
  )
)
```

Map into `photo_request.answers`.

- [ ] **Step 2: Add POST action `save_sourcing_answer_draft`**

In `POST`, route:

```ts
if (body?.action === "save_sourcing_answer_draft") {
  return saveSourcingAnswerDraft(body, adminUser.id);
}
```

Implement helper to upsert a draft answer for the request:

```ts
async function saveSourcingAnswerDraft(body: SupportPostBody, adminUserId: string) {
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const answerText = typeof body.answerText === "string" ? body.answerText.trim() : "";
  const rightsResult = typeof body.rightsResult === "string" ? body.rightsResult.trim() : null;
  const rightsExplanation = typeof body.rightsExplanation === "string" ? body.rightsExplanation.trim() : null;
  if (!requestId) return NextResponse.json({ error: "requestId is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sourcing_request_answers")
    .insert({
      contact_submission_id: requestId,
      answer_text: answerText || null,
      rights_result: rightsResult || null,
      rights_explanation: rightsExplanation || null,
      status: "draft",
      created_by: adminUserId,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ answer: data });
}
```

This creates a new draft per save. Later tasks can choose latest draft for publish.

- [ ] **Step 3: Add POST action `set_sourcing_candidates`**

Body shape:

```ts
{
  action: "set_sourcing_candidates",
  answerId: string,
  imageIds: string[]
}
```

Implementation:

- Validate answer exists and status is `draft`.
- Fetch images by `imageIds`.
- Use `candidateImageEligibility`.
- Reject with 400 if any image is not approved, active, and published.
- Delete existing candidates for answer.
- Insert candidate rows with `sort_order`.

- [ ] **Step 4: Add POST action `publish_sourcing_answer`**

Body shape:

```ts
{
  action: "publish_sourcing_answer",
  answerId: string
}
```

Implementation:

- Validate answer exists.
- Validate at least one candidate or non-empty answer text or rights result exists.
- Set answer `status = 'published'`, `published_at = now`.
- Set candidates `is_visible = true`.
- Update contact submission:

```ts
{
  internal_sourcing_status: "answered",
  buyer_sourcing_status: "answer_ready",
  request_status: "in_progress",
  status: "in_progress",
  updated_at: now
}
```

- Record admin audit action `sourcing_request.answer_published`.

- [ ] **Step 5: Run checks**

```bash
npm run lint -- src/app/api/admin/support/route.ts src/lib/sourcing/status.ts src/lib/sourcing/candidates.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/support/route.ts
git commit -m "feat: add admin sourcing answer publishing api"
```

### Task 12: Add Admin Sourcing Result UI

**Files:**
- Modify: `src/app/(admin)/admin/support/page.tsx`

- [ ] **Step 1: Extend local types**

Add:

```ts
interface SourcingCandidate {
  id: string;
  image_id: string;
  sort_order: number;
  is_visible: boolean;
  note: string | null;
  image?: {
    id: string;
    asset_id: string | null;
    title: string | null;
    storage_path_preview: string | null;
    is_published?: boolean | null;
  } | null;
}

interface SourcingAnswer {
  id: string;
  answer_text: string | null;
  rights_result: string | null;
  rights_explanation: string | null;
  status: "draft" | "published" | string;
  revision_round: number;
  published_at: string | null;
  candidates?: SourcingCandidate[] | null;
}
```

Extend `PhotoRequestDetail`:

```ts
answers?: SourcingAnswer[] | null;
```

- [ ] **Step 2: Add draft state**

Add state:

```ts
const [answerDrafts, setAnswerDrafts] = useState<Record<string, {
  answerText: string;
  rightsResult: string;
  rightsExplanation: string;
  imageIds: string;
}>>({});
```

When submissions load, initialize drafts from latest draft answer where available.

- [ ] **Step 3: Add admin result editor block**

Inside photo request card, render:

```tsx
<div className="rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">구매자 답변 초안</p>
  <textarea ... />
  <select ...>
    <option value="">권리 확인 등급 없음</option>
    <option value="usable">사용 가능</option>
    <option value="conditional">조건부 가능</option>
    <option value="unverified">확인 불가</option>
    <option value="not_recommended">사용 비권장</option>
  </select>
  <textarea placeholder="권리 확인 설명" ... />
  <input placeholder="후보 이미지 ID를 쉼표로 입력" ... />
  <button onClick={() => saveSourcingDraft(submission)}>초안 저장</button>
  <button onClick={() => publishLatestSourcingAnswer(submission)}>답변 발송</button>
</div>
```

Use a simple comma-separated image id input for this implementation. A richer image picker belongs in a separate follow-up task after this workflow is stable.

- [ ] **Step 4: Add handlers**

```ts
async function saveSourcingDraft(submission: SupportSubmission) {
  const draft = answerDrafts[submission.id];
  const saveRes = await fetch("/api/admin/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "save_sourcing_answer_draft",
      requestId: submission.id,
      answerText: draft.answerText,
      rightsResult: draft.rightsResult || null,
      rightsExplanation: draft.rightsExplanation || null,
    }),
  });
  const saveBody = await saveRes.json();
  if (!saveRes.ok) throw new Error(saveBody.error ?? "초안 저장 실패");

  const imageIds = draft.imageIds.split(",").map((id) => id.trim()).filter(Boolean);
  if (imageIds.length > 0) {
    const candidateRes = await fetch("/api/admin/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_sourcing_candidates",
        answerId: saveBody.answer.id,
        imageIds,
      }),
    });
    const candidateBody = await candidateRes.json().catch(() => null);
    if (!candidateRes.ok) throw new Error(candidateBody?.error ?? "후보 이미지 저장 실패");
  }

  await fetchSubmissions(tab, kind);
}
```

Add publish handler that selects latest draft answer id from `submission.photo_request?.answers` or uses saved answer id after a save.

- [ ] **Step 5: Run checks**

```bash
npm run lint -- src/app/'(admin)'/admin/support/page.tsx
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/'(admin)'/admin/support/page.tsx
git commit -m "feat: add admin sourcing result editor"
```

### Task 13: Add Buyer Sourcing Requests Page And API

**Files:**
- Create: `src/app/api/sourcing/requests/route.ts`
- Create: `src/app/(dashboard)/dashboard/sourcing/page.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Create buyer API**

Create `src/app/api/sourcing/requests/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SELECT = `
  id, subject, message, created_at, updated_at, buyer_sourcing_status, internal_sourcing_status,
  sourcing_purposes, usage_intent, deadline_at,
  answers:sourcing_request_answers(
    id, answer_text, rights_result, rights_explanation, status, revision_round, published_at,
    candidates:sourcing_request_candidates(
      id, image_id, sort_order, is_visible,
      image:images(
        id, asset_id, title, category, storage_path_preview, width, height,
        photographer_id, copyright_license, free_usage_policy
      )
    )
  ),
  revisions:sourcing_request_revisions(id, round, reasons, message, created_at)
`;

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("contact_submissions")
    .select(SELECT)
    .eq("inquiry_type", "photo_request")
    .or(`buyer_id.eq.${user.id},email.eq.${user.email}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data ?? [] });
}
```

- [ ] **Step 2: Add dashboard nav**

In `src/app/(dashboard)/layout.tsx`, add buyer-facing nav item:

```ts
{ href: "/dashboard/sourcing", icon: "travel_explore", key: "sourcing", label: "내 소싱 요청" },
```

If current nav is shared by buyer/photographer, keep `/dashboard/requests` label as `운영팀 요청` or `사진가 요청` to avoid buyer matching language.

- [ ] **Step 3: Create buyer page**

Create `src/app/(dashboard)/dashboard/sourcing/page.tsx` as a client page that:

- Fetches `/api/sourcing/requests`.
- Shows status label.
- Shows latest published answer.
- Shows visible candidate images.
- Provides "장바구니 담기" using existing cart store pattern from `src/components/gallery/ImageCard.tsx`.
- Shows revision notice from `src/lib/sourcing/status.ts`.

Minimal card structure:

```tsx
<article className="rounded-xl bg-surface-container-lowest p-5 shadow-ghost">
  <div className="flex items-center justify-between gap-3">
    <h2 className="font-headline text-lg font-bold text-on-surface">{request.subject}</h2>
    <span className="rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary">
      {statusLabel}
    </span>
  </div>
  <p className="mt-3 whitespace-pre-wrap text-sm text-on-surface-variant">{request.message}</p>
  {latestAnswer && (
    <section className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-low p-4">
      <p className="font-bold text-on-surface">Image Partners 답변</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-on-surface-variant">{latestAnswer.answer_text}</p>
    </section>
  )}
</article>
```

- [ ] **Step 4: Run checks**

```bash
npm run lint -- src/app/api/sourcing/requests/route.ts src/app/'(dashboard)'/dashboard/sourcing/page.tsx src/app/'(dashboard)'/layout.tsx
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sourcing/requests/route.ts src/app/'(dashboard)'/dashboard/sourcing/page.tsx src/app/'(dashboard)'/layout.tsx
git commit -m "feat: add buyer sourcing request dashboard"
```

### Task 14: Add Buyer Revision Requests

**Files:**
- Create: `src/app/api/sourcing/requests/[id]/revision/route.ts`
- Modify: `src/app/(dashboard)/dashboard/sourcing/page.tsx`
- Use: `src/lib/sourcing/status.ts`

- [ ] **Step 1: Add revision API**

Create `src/app/api/sourcing/requests/[id]/revision/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { canRequestRevision } from "@/lib/sourcing/status";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REASONS = new Set([
  "wrong_location",
  "wrong_season_or_time",
  "wrong_composition",
  "usage_terms_do_not_fit",
  "price_does_not_fit",
  "need_more_candidates",
  "other",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { reasons?: unknown; message?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const reasons = Array.isArray(body?.reasons)
    ? body.reasons.filter((reason): reason is string => typeof reason === "string" && ALLOWED_REASONS.has(reason))
    : [];

  if (!message) return NextResponse.json({ error: "수정요청 내용을 입력해주세요." }, { status: 400 });
  if (reasons.length === 0) return NextResponse.json({ error: "수정요청 사유를 하나 이상 선택해주세요." }, { status: 400 });

  const { data: requestRow, error: requestError } = await supabase
    .from("contact_submissions")
    .select("id, email, buyer_sourcing_status")
    .eq("id", id)
    .eq("inquiry_type", "photo_request")
    .single();

  if (requestError || !requestRow || requestRow.email !== user.email) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (requestRow.buyer_sourcing_status !== "answer_ready") {
    return NextResponse.json({ error: "답변 공개 후 수정요청을 보낼 수 있습니다." }, { status: 409 });
  }

  const { count, error: countError } = await supabase
    .from("sourcing_request_revisions")
    .select("id", { count: "exact", head: true })
    .eq("contact_submission_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
  const revisionCount = count ?? 0;
  if (!canRequestRevision(revisionCount)) {
    return NextResponse.json({ error: "이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요." }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("sourcing_request_revisions")
    .insert({
      contact_submission_id: id,
      buyer_id: user.id,
      round: revisionCount + 1,
      reasons,
      message,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("contact_submissions")
    .update({
      buyer_sourcing_status: "under_review",
      internal_sourcing_status: "drafting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ revision: data }, { status: 201 });
}
```

- [ ] **Step 2: Add revision UI**

In buyer sourcing page, add quick reason checkboxes:

```ts
const REVISION_REASONS = [
  { value: "wrong_location", label: "장소가 다름" },
  { value: "wrong_season_or_time", label: "계절/시간대가 다름" },
  { value: "wrong_composition", label: "구도/거리감이 다름" },
  { value: "usage_terms_do_not_fit", label: "상업 사용 조건이 맞지 않음" },
  { value: "price_does_not_fit", label: "가격이 맞지 않음" },
  { value: "need_more_candidates", label: "더 많은 후보가 필요함" },
  { value: "other", label: "기타" },
] as const;
```

Show notice:

```tsx
<p className="text-xs text-outline">{revisionLimitNotice}</p>
```

Submit to `/api/sourcing/requests/${request.id}/revision`.

- [ ] **Step 3: Run checks**

```bash
npm run lint -- src/app/api/sourcing/requests/'[id]'/revision/route.ts src/app/'(dashboard)'/dashboard/sourcing/page.tsx
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/sourcing/requests/'[id]'/revision/route.ts src/app/'(dashboard)'/dashboard/sourcing/page.tsx
git commit -m "feat: add sourcing revision requests"
```

### Task 15: Reword Photographer-Facing Internal Request Flow

**Files:**
- Modify: `src/app/(dashboard)/dashboard/requests/page.tsx`
- Modify: `src/app/api/contact/matches/route.ts`

- [ ] **Step 1: Update photographer page language**

Replace buyer/matching language with internal operations language:

- Page title: `운영팀 요청`
- Description: `Image Partners 운영팀이 이미지 보유 여부나 촬영 가능성을 확인하기 위해 보낸 요청입니다. 구매자와 직접 연결되는 매칭이 아닙니다.`
- Empty state: `운영팀 요청이 없습니다.`
- Status labels:
  - `candidate`: `검토 대기`
  - `invited`: `확인 요청`
  - `interested`: `가능`
  - `declined`: `불가`
- Buttons:
  - `가능`
  - `불가`

- [ ] **Step 2: Prevent terminal match overwrite**

In `src/app/api/contact/matches/route.ts`, restrict PATCH updates:

```ts
const { data, error } = await supabase
  .from("photo_request_matches")
  .update({ status, updated_at: new Date().toISOString() })
  .eq("id", id)
  .eq("photographer_id", user.id)
  .in("status", ["candidate", "invited", "interested", "declined"])
  .select(MATCH_SELECT)
  .single();
```

This prevents `selected` or `cancelled` rows from being overwritten.

- [ ] **Step 3: Run checks**

```bash
npm run lint -- src/app/'(dashboard)'/dashboard/requests/page.tsx src/app/api/contact/matches/route.ts
npx tsc --noEmit --pretty false
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/'(dashboard)'/dashboard/requests/page.tsx src/app/api/contact/matches/route.ts
git commit -m "fix: clarify internal photographer requests"
```

### Task 16: Final Verification

**Files:** no code changes expected.

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

```bash
npx tsc --noEmit --pretty false
```

Expected: no output and exit 0.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: exit 0. Existing warnings are acceptable only if there are 0 errors.

- [ ] **Step 4: Run production build**

```bash
npm run build
```

Expected: build passes.

- [ ] **Step 5: Verify local Supabase and API**

```bash
npm run supabase:check
curl -sS -i 'http://localhost:3000/api/images?limit=1' | sed -n '1,12p'
```

Expected: Supabase health HTTP 200 and images API HTTP 200.

- [ ] **Step 6: Browser smoke checks**

Use Browser plugin or Playwright equivalent to verify:

- `/` shows library search.
- `/about` shows cleaned positioning page.
- Footer shows confirmed address and email only.
- `/contact?mode=photo` shows "이미지 소싱 요청" and purpose checkboxes.
- `/dashboard/sourcing` requires login or shows buyer sourcing requests when logged in.
- `/admin/support` still redirects unauthenticated users to login and renders after admin login.

- [ ] **Step 7: Final commit if verification-only fixes were needed**

If verification required small fixes:

```bash
git add <fixed-files>
git commit -m "fix: stabilize sourcing rollout"
```

If no fixes were needed, do not commit.

---

## Self-Review Notes

- Spec coverage: This plan covers sourcing request input, buyer/admin/photographer language boundaries, result drafting/publishing, registered-only candidates, revision limit, rights result labels, home/library/about/footer copy, image publishing toggle, and orientation verification.
- Scope split: The plan intentionally implements site positioning first because it can ship independently and reduces launch confusion before deeper sourcing data model work.
- Known human review after implementation: final email copy, final Korean service labels, rights result wording, footer phone number, and hidden legal/support link policy.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-17-sourcing-and-positioning-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, and iterate quickly.
2. **Inline Execution** - Execute tasks in this session using `superpowers:executing-plans`, with batch checkpoints.
