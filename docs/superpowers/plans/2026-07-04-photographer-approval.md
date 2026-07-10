# Photographer Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build admin-approved photographer onboarding while keeping buyer signup and buyer features immediately available.

**Architecture:** Add a profile-level photographer gate and a separate application history table. Route all signup, OAuth, and buyer-to-photographer conversion paths through one idempotent application helper, then protect photographer-only APIs and pages with one approval guard. Admins review applications from a dedicated queue, while users see clear pending, approved, and suspended messaging in dashboard/settings.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Auth/Postgres/RLS, Vitest, existing Resend email wrapper, existing admin audit logging.

---

## File Structure

- Create `supabase/migrations/044_photographer_approval_workflow.sql`: DB fields, application table, indexes, RLS, existing user migration, `handle_new_user` update.
- Create `src/lib/photographers/approval.ts`: status types, normalization, application payload builder, idempotent application creation, approval guard.
- Create `src/lib/photographers/approval.test.ts`: pure unit coverage for status/action decisions and payload normalization.
- Modify `src/lib/auth/signup-flow.ts` and `src/lib/auth/signup-flow.test.ts`: ensure photographer signup intent never implies immediate photographer access.
- Modify `src/app/(auth)/signup/page.tsx`: collect phone number, activity regions, and short bio when photographer signup is selected.
- Modify `src/app/api/auth/signup/route.ts`: create buyer profile plus pending application for photographer signup.
- Modify `src/app/api/auth/google/route.ts` and `src/app/api/auth/callback/route.ts`: preserve photographer intent through OAuth and create a pending application after callback.
- Modify `src/app/api/profile/route.ts`: expose `photographer_status`, latest application fields, and accept application contact fields.
- Modify `src/app/api/profile/upgrade-to-photographer/route.ts`: change immediate role upgrade into application submission.
- Modify `src/lib/store/auth.ts`: include `photographer_status` in client auth state.
- Create `src/components/dashboard/PhotographerStatusNotice.tsx`: reusable user-facing status notice.
- Modify `src/app/(dashboard)/layout.tsx`: show photographer nav only for `photographer_status = approved`; use buyer nav plus status notice otherwise.
- Modify `src/app/(dashboard)/dashboard/settings/page.tsx`: pending/suspended/approved application UI and reapply flow.
- Modify photographer dashboard pages under `src/app/(dashboard)/dashboard/uploads`, `src/app/(dashboard)/dashboard/earnings`, `src/app/(dashboard)/dashboard/requests`, and `src/app/(dashboard)/dashboard/blockchain`: show status notice for direct access when not approved.
- Modify photographer APIs in `src/app/api/uploads`, `src/app/api/earnings`, and `src/app/api/onchain/registration*`: call the shared approval guard.
- Add `src/app/api/admin/photographer-applications/route.ts`: list applications and handle approve/reject actions.
- Add `src/app/api/admin/users/[id]/photographer-suspension/route.ts`: suspend approved photographer access.
- Create `src/app/(admin)/admin/photographer-applications/page.tsx`: admin queue UI.
- Modify `src/lib/admin/nav.ts` and `src/lib/admin/nav.test.ts`: add "사진가 승인" under user management.
- Modify `src/app/(admin)/admin/users/page.tsx`, `src/app/api/admin/users/route.ts`, and `src/app/api/admin/users/[id]/route.ts`: expose status and suspension action.
- Modify `src/lib/email/resend.ts`: add photographer approval/rejection email helpers.
- Run focused Vitest tests, lint, and build.

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/044_photographer_approval_workflow.sql`
- Verify with: `npm run supabase:reset`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/044_photographer_approval_workflow.sql` with:

```sql
-- IMAGE PARTNERS - Photographer approval workflow

alter table public.profiles
  add column if not exists photographer_status text not null default 'none';

alter table public.profiles
  drop constraint if exists profiles_photographer_status_check;

alter table public.profiles
  add constraint profiles_photographer_status_check
  check (photographer_status in ('none', 'pending', 'approved', 'suspended'));

create table if not exists public.photographer_applications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  applicant_name text not null,
  organization text,
  phone_number text,
  primary_activity_regions text[] not null default '{}'::text[],
  bio text,
  admin_note text,
  rejection_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

alter table public.photographer_applications
  drop constraint if exists photographer_applications_status_check,
  drop constraint if exists photographer_applications_name_length_check,
  drop constraint if exists photographer_applications_org_length_check,
  drop constraint if exists photographer_applications_phone_length_check,
  drop constraint if exists photographer_applications_regions_count_check,
  drop constraint if exists photographer_applications_bio_length_check,
  drop constraint if exists photographer_applications_rejection_reason_required_check;

alter table public.photographer_applications
  add constraint photographer_applications_status_check
    check (status in ('pending', 'approved', 'rejected')),
  add constraint photographer_applications_name_length_check
    check (char_length(applicant_name) between 1 and 80),
  add constraint photographer_applications_org_length_check
    check (organization is null or char_length(organization) <= 120),
  add constraint photographer_applications_phone_length_check
    check (phone_number is null or char_length(phone_number) <= 32),
  add constraint photographer_applications_regions_count_check
    check (cardinality(primary_activity_regions) <= 12),
  add constraint photographer_applications_bio_length_check
    check (bio is null or char_length(bio) <= 1000),
  add constraint photographer_applications_rejection_reason_required_check
    check (status <> 'rejected' or (rejection_reason is not null and char_length(trim(rejection_reason)) > 0));

create unique index if not exists photographer_applications_one_pending_idx
  on public.photographer_applications(profile_id)
  where status = 'pending';

create index if not exists photographer_applications_profile_created_idx
  on public.photographer_applications(profile_id, created_at desc);

create index if not exists photographer_applications_status_created_idx
  on public.photographer_applications(status, created_at desc);

create index if not exists profiles_photographer_status_idx
  on public.profiles(photographer_status);

update public.profiles
set photographer_status = case
  when role = 'photographer' or roles @> array['photographer']::text[] then 'approved'
  else 'none'
end
where photographer_status = 'none';

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data->>'role', 'buyer');
begin
  insert into public.profiles (id, full_name, role, roles, organization, photographer_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'buyer',
    array['buyer']::text[],
    nullif(trim(coalesce(new.raw_user_meta_data->>'organization', '')), ''),
    case when requested_role = 'photographer' then 'pending' else 'none' end
  );
  return new;
end;
$$;

alter table public.photographer_applications enable row level security;

drop policy if exists "photographer_applications: self select" on public.photographer_applications;
drop policy if exists "photographer_applications: self insert pending" on public.photographer_applications;
drop policy if exists "photographer_applications: admin all" on public.photographer_applications;

create policy "photographer_applications: self select"
  on public.photographer_applications for select
  using (profile_id = auth.uid());

create policy "photographer_applications: self insert pending"
  on public.photographer_applications for insert
  with check (profile_id = auth.uid() and status = 'pending');

create policy "photographer_applications: admin all"
  on public.photographer_applications for all
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));
```

- [ ] **Step 2: Reset local Supabase and verify migration**

Run:

```bash
npm run supabase:reset
```

Expected: Supabase reset completes without SQL errors.

- [ ] **Step 3: Commit migration**

```bash
git add supabase/migrations/044_photographer_approval_workflow.sql
git commit -m "feat: add photographer approval schema"
```

## Task 2: Photographer Approval Domain Helper

**Files:**
- Create: `src/lib/photographers/approval.ts`
- Create: `src/lib/photographers/approval.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `src/lib/photographers/approval.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPhotographerApplicationPayload,
  canApplyForPhotographer,
  isApprovedPhotographerStatus,
  normalizeApplicationStatus,
  normalizePhotographerStatus,
} from "./approval";

describe("photographer approval helpers", () => {
  it("normalizes profile photographer status defensively", () => {
    expect(normalizePhotographerStatus("approved")).toBe("approved");
    expect(normalizePhotographerStatus("pending")).toBe("pending");
    expect(normalizePhotographerStatus("suspended")).toBe("suspended");
    expect(normalizePhotographerStatus("unexpected")).toBe("none");
    expect(normalizePhotographerStatus(null)).toBe("none");
  });

  it("normalizes application status defensively", () => {
    expect(normalizeApplicationStatus("approved")).toBe("approved");
    expect(normalizeApplicationStatus("rejected")).toBe("rejected");
    expect(normalizeApplicationStatus("unexpected")).toBe("pending");
  });

  it("allows applications from none and suspended states only", () => {
    expect(canApplyForPhotographer("none")).toBe(true);
    expect(canApplyForPhotographer("suspended")).toBe(true);
    expect(canApplyForPhotographer("pending")).toBe(false);
    expect(canApplyForPhotographer("approved")).toBe(false);
  });

  it("treats only approved status as photographer authorization", () => {
    expect(isApprovedPhotographerStatus("approved")).toBe(true);
    expect(isApprovedPhotographerStatus("pending")).toBe(false);
    expect(isApprovedPhotographerStatus("suspended")).toBe(false);
    expect(isApprovedPhotographerStatus("none")).toBe(false);
  });

  it("builds a normalized application payload", () => {
    expect(buildPhotographerApplicationPayload({
      profileId: "user-1",
      name: "  Kim   Photo ",
      organization: " Studio  A ",
      phoneNumber: "+82 10 1234 5678",
      primaryActivityRegions: "Seoul, Busan\nSeoul",
      bio: "  Editorial and archive photography.  ",
    })).toEqual({
      profile_id: "user-1",
      status: "pending",
      applicant_name: "Kim Photo",
      organization: "Studio A",
      phone_number: "+82 10 1234 5678",
      primary_activity_regions: ["Seoul", "Busan"],
      bio: "Editorial and archive photography.",
    });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/lib/photographers/approval.test.ts
```

Expected: FAIL because `src/lib/photographers/approval.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `src/lib/photographers/approval.ts`:

```ts
import { NextResponse } from "next/server";
import { normalizePhoneNumber, normalizePrimaryActivityRegions } from "@/lib/profile/contact";
import type { createAdminClient } from "@/lib/supabase/admin";

export type PhotographerStatus = "none" | "pending" | "approved" | "suspended";
export type PhotographerApplicationStatus = "pending" | "approved" | "rejected";

export interface PhotographerApplicationInput {
  profileId: string;
  name: unknown;
  organization?: unknown;
  phoneNumber?: unknown;
  primaryActivityRegions?: unknown;
  bio?: unknown;
}

export interface PhotographerApplicationPayload {
  profile_id: string;
  status: "pending";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[];
  bio: string | null;
}

export interface PhotographerAuthorization {
  ok: boolean;
  userId: string;
  status: PhotographerStatus;
  response?: NextResponse;
}

function cleanText(value: unknown, fieldName: string, maxLength: number, required: boolean) {
  if (value === null || value === undefined) {
    if (required) throw new Error(`${fieldName}을 입력해주세요.`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${fieldName} 형식이 올바르지 않습니다.`);
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    if (required) throw new Error(`${fieldName}을 입력해주세요.`);
    return null;
  }
  if (text.length > maxLength) throw new Error(`${fieldName}은 ${maxLength}자 이내로 입력해주세요.`);
  return text;
}

export function normalizePhotographerStatus(value: unknown): PhotographerStatus {
  return value === "pending" || value === "approved" || value === "suspended" ? value : "none";
}

export function normalizeApplicationStatus(value: unknown): PhotographerApplicationStatus {
  return value === "approved" || value === "rejected" ? value : "pending";
}

export function isApprovedPhotographerStatus(status: unknown) {
  return normalizePhotographerStatus(status) === "approved";
}

export function canApplyForPhotographer(status: unknown) {
  const normalized = normalizePhotographerStatus(status);
  return normalized === "none" || normalized === "suspended";
}

export function buildPhotographerApplicationPayload(input: PhotographerApplicationInput): PhotographerApplicationPayload {
  return {
    profile_id: input.profileId,
    status: "pending",
    applicant_name: cleanText(input.name, "이름", 80, true) ?? "",
    organization: cleanText(input.organization, "소속", 120, false),
    phone_number: normalizePhoneNumber(input.phoneNumber),
    primary_activity_regions: normalizePrimaryActivityRegions(input.primaryActivityRegions),
    bio: cleanText(input.bio, "소개", 1000, false),
  };
}

export async function ensurePendingPhotographerApplication(
  admin: ReturnType<typeof createAdminClient>,
  input: PhotographerApplicationInput,
) {
  const payload = buildPhotographerApplicationPayload(input);

  const { data: existing, error: existingError } = await admin
    .from("photographer_applications")
    .select("id, status, created_at")
    .eq("profile_id", payload.profile_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    await admin
      .from("profiles")
      .update({ photographer_status: "pending", updated_at: new Date().toISOString() })
      .eq("id", payload.profile_id);
    return { application: existing, created: false };
  }

  const { data, error } = await admin
    .from("photographer_applications")
    .insert(payload)
    .select("id, status, created_at")
    .single();

  if (error) throw error;

  const { error: profileError } = await admin
    .from("profiles")
    .update({ photographer_status: "pending", updated_at: new Date().toISOString() })
    .eq("id", payload.profile_id);
  if (profileError) throw profileError;

  return { application: data, created: true };
}

export async function requireApprovedPhotographer(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<PhotographerAuthorization> {
  const { data, error } = await admin
    .from("profiles")
    .select("photographer_status")
    .eq("id", userId)
    .single();

  if (error) {
    return { ok: false, userId, status: "none", response: NextResponse.json({ error: error.message }, { status: 500 }) };
  }

  const status = normalizePhotographerStatus(data?.photographer_status);
  if (status !== "approved") {
    return {
      ok: false,
      userId,
      status,
      response: NextResponse.json({
        error: "Photographer approval required",
        code: "PHOTOGRAPHER_APPROVAL_REQUIRED",
        photographer_status: status,
      }, { status: 403 }),
    };
  }

  return { ok: true, userId, status };
}
```

- [ ] **Step 4: Run tests and verify pass**

Run:

```bash
npm test -- src/lib/photographers/approval.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper**

```bash
git add src/lib/photographers/approval.ts src/lib/photographers/approval.test.ts
git commit -m "feat: add photographer approval helpers"
```

## Task 3: Signup, OAuth, Profile, And Conversion APIs

**Files:**
- Modify: `src/lib/auth/signup-flow.ts`
- Modify: `src/lib/auth/signup-flow.test.ts`
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/api/auth/signup/route.ts`
- Modify: `src/app/api/auth/google/route.ts`
- Modify: `src/app/api/auth/callback/route.ts`
- Modify: `src/app/api/profile/route.ts`
- Modify: `src/app/api/profile/upgrade-to-photographer/route.ts`
- Modify: `src/lib/store/auth.ts`

- [ ] **Step 1: Add signup-flow tests**

Append to `src/lib/auth/signup-flow.test.ts`:

```ts
import { photographerIntentCreatesBuyerRole } from "./signup-flow";

it("keeps photographer signup as buyer role until admin approval", () => {
  expect(photographerIntentCreatesBuyerRole("photographer")).toEqual({
    role: "buyer",
    roles: ["buyer"],
    photographer_status: "pending",
    shouldCreateApplication: true,
  });
  expect(photographerIntentCreatesBuyerRole("buyer")).toEqual({
    role: "buyer",
    roles: ["buyer"],
    photographer_status: "none",
    shouldCreateApplication: false,
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
npm test -- src/lib/auth/signup-flow.test.ts
```

Expected: FAIL because `photographerIntentCreatesBuyerRole` is not exported.

- [ ] **Step 3: Implement signup intent helper**

Add to `src/lib/auth/signup-flow.ts`:

```ts
export function photographerIntentCreatesBuyerRole(value: unknown) {
  const requestedRole = normalizeSignupRole(value);
  return {
    role: "buyer" as const,
    roles: ["buyer"] as const,
    photographer_status: requestedRole === "photographer" ? "pending" as const : "none" as const,
    shouldCreateApplication: requestedRole === "photographer",
  };
}
```

- [ ] **Step 4: Collect photographer application fields on signup**

In `src/app/(auth)/signup/page.tsx`, add photographer application state:

```tsx
const [phoneNumber, setPhoneNumber] = useState("");
const [activityRegions, setActivityRegions] = useState("");
const [bio, setBio] = useState("");
```

Change `googleSignupUrl` to include the extra application fields:

```tsx
const googleSignupUrl = `/api/auth/google?next=${encodeURIComponent(
  "/dashboard",
)}&role=${role}&organization=${encodeURIComponent(organization.trim())}&phone_number=${encodeURIComponent(phoneNumber.trim())}&primary_activity_regions=${encodeURIComponent(activityRegions.trim())}&bio=${encodeURIComponent(bio.trim())}`;
```

Change the email signup body:

```tsx
body: JSON.stringify({
  name,
  organization,
  email,
  password,
  role,
  phone_number: phoneNumber,
  primary_activity_regions: activityRegions,
  bio,
}),
```

Render these fields only when `role === "photographer"` after organization:

```tsx
{role === "photographer" && (
  <>
    <Input
      label="연락처"
      type="tel"
      placeholder="+82 10 1234 5678"
      value={phoneNumber}
      onChange={(event) => setPhoneNumber(event.target.value)}
      icon="phone"
      required
      autoComplete="tel"
    />
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-outline uppercase tracking-widest">주요 활동 지역</label>
      <textarea
        value={activityRegions}
        onChange={(event) => setActivityRegions(event.target.value)}
        rows={3}
        className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
        placeholder="예: 서울, 경기, 부산"
        required
      />
    </div>
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-outline uppercase tracking-widest">간단 소개</label>
      <textarea
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        rows={3}
        className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
        placeholder="주요 촬영 분야나 활동 이력을 간단히 적어주세요."
      />
    </div>
  </>
)}
```

- [ ] **Step 5: Change email signup route**

In `src/app/api/auth/signup/route.ts`, import the new helper and application helper:

```ts
import { ensurePendingPhotographerApplication } from "@/lib/photographers/approval";
```

Change the existing `signUp` metadata block to send buyer profile data plus requested role intent:

```ts
const signupIntent = photographerIntentCreatesBuyerRole(role);

const { data, error } = await auth.auth.signUp({
  email,
  password,
  options: {
    data: {
      full_name: name,
      role,
      requested_role: role,
      organization,
    },
    emailRedirectTo,
  },
});
```

After successful signUp, before returning, add:

```ts
const createdUserId = data.user?.id;
if (createdUserId && signupIntent.shouldCreateApplication) {
  try {
    await ensurePendingPhotographerApplication(admin, {
      profileId: createdUserId,
      name,
      organization,
      phoneNumber,
      primaryActivityRegions,
      bio,
    });
  } catch (applicationError) {
    console.error("[auth-signup] photographer application creation failed", applicationError);
    return NextResponse.json({ error: "사진가 신청을 접수하지 못했습니다." }, { status: 500 });
  }
}
```

Also include optional fields from the request payload:

```ts
const phoneNumber = typeof payload.phone_number === "string" ? payload.phone_number : null;
const primaryActivityRegions = payload.primary_activity_regions ?? [];
const bio = typeof payload.bio === "string" ? payload.bio : "";
```

Use those variables in the helper call instead of direct payload references.

- [ ] **Step 6: Change Google OAuth entry route**

In `src/app/api/auth/google/route.ts`, preserve photographer intent without granting access:

```ts
if (role === "buyer" || role === "photographer") {
  callbackParams.set("role", role);
  callbackParams.set("requested_role", role);
}
```

Read and propagate application fields:

```ts
const phoneNumber = cleanText(searchParams.get("phone_number"));
const primaryActivityRegions = cleanText(searchParams.get("primary_activity_regions"));
const bio = cleanText(searchParams.get("bio"));

if (phoneNumber) callbackParams.set("phone_number", phoneNumber);
if (primaryActivityRegions) callbackParams.set("primary_activity_regions", primaryActivityRegions);
if (bio) callbackParams.set("bio", bio);
```

- [ ] **Step 7: Change OAuth callback route**

In `src/app/api/auth/callback/route.ts`, import:

```ts
import { ensurePendingPhotographerApplication } from "@/lib/photographers/approval";
```

Replace the current direct profile role update logic with:

```ts
const requestedRole = searchParams.get("requested_role") ?? role;
const organization = searchParams.get("organization")?.trim().replace(/\s+/g, " ") ?? "";
const phoneNumber = searchParams.get("phone_number") ?? null;
const primaryActivityRegions = searchParams.get("primary_activity_regions") ?? "";
const bio = searchParams.get("bio") ?? "";

if (!error) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.auth.updateUser({
      data: {
        ...(requestedRole ? { requested_role: requestedRole } : {}),
        ...(organization ? { organization } : {}),
      },
    });

    const admin = createAdminClient();
    await admin
      .from("profiles")
      .update({
        role: "buyer",
        roles: ["buyer"],
        ...(organization ? { organization } : {}),
        photographer_status: requestedRole === "photographer" ? "pending" : "none",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .neq("photographer_status", "approved");

    if (requestedRole === "photographer") {
      await ensurePendingPhotographerApplication(admin, {
        profileId: user.id,
        name: user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "사진가 신청자",
        organization,
        phoneNumber,
        primaryActivityRegions,
        bio,
      });
    }

    await admin.rpc("record_profile_login", { target_user_id: user.id });
  }

  return NextResponse.redirect(`${redirectOrigin}${next}`);
}
```

- [ ] **Step 8: Expose status in profile API and auth store**

In `src/app/api/profile/route.ts`, include fields:

```ts
.select("id, full_name, organization, bio, avatar_url, role, roles, photographer_status, wallet_address, phone_number, primary_activity_regions, notif_sales, notif_reviews, notif_newsletter, created_at")
```

After loading profile, load latest application:

```ts
const { data: application } = await supabase
  .from("photographer_applications")
  .select("id, status, rejection_reason, admin_note, created_at, reviewed_at")
  .eq("profile_id", user.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

return NextResponse.json({ profile: { ...data, email: user.email, latest_photographer_application: application ?? null } });
```

In `src/lib/store/auth.ts`, add to `AuthUser`:

```ts
photographer_status: "none" | "pending" | "approved" | "suspended";
```

Change both profile selects to include `photographer_status`, and set:

```ts
photographer_status:
  profile?.photographer_status === "pending" ||
  profile?.photographer_status === "approved" ||
  profile?.photographer_status === "suspended"
    ? profile.photographer_status
    : "none",
```

- [ ] **Step 9: Replace immediate conversion API**

In `src/app/api/profile/upgrade-to-photographer/route.ts`, replace the role update with:

```ts
const admin = createAdminClient();
const body = await _req.json().catch(() => null) as {
  phone_number?: unknown;
  primary_activity_regions?: unknown;
  bio?: unknown;
} | null;

const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id, full_name, organization, phone_number, primary_activity_regions, bio, photographer_status")
  .eq("id", user.id)
  .single();

if (profileError || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
if (profile.photographer_status === "approved") {
  return NextResponse.json({ profile, status: "approved" });
}

const { application, created } = await ensurePendingPhotographerApplication(admin, {
  profileId: user.id,
  name: profile.full_name ?? user.email?.split("@")[0] ?? "사진가 신청자",
  organization: profile.organization,
  phoneNumber: body?.phone_number ?? profile.phone_number,
  primaryActivityRegions: body?.primary_activity_regions ?? profile.primary_activity_regions,
  bio: body?.bio ?? profile.bio,
});

return NextResponse.json({ application, status: "pending", created });
```

- [ ] **Step 10: Run focused tests**

Run:

```bash
npm test -- src/lib/auth/signup-flow.test.ts src/lib/photographers/approval.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit signup and profile flow**

```bash
git add src/lib/auth/signup-flow.ts src/lib/auth/signup-flow.test.ts 'src/app/(auth)/signup/page.tsx' src/app/api/auth/signup/route.ts src/app/api/auth/google/route.ts src/app/api/auth/callback/route.ts src/app/api/profile/route.ts src/app/api/profile/upgrade-to-photographer/route.ts src/lib/store/auth.ts
git commit -m "feat: route photographer signup through applications"
```

## Task 4: Server-Side Photographer Authorization Guards

**Files:**
- Modify: `src/app/api/uploads/route.ts`
- Modify: `src/app/api/uploads/presign/route.ts`
- Modify: `src/app/api/uploads/[id]/route.ts`
- Modify: `src/app/api/earnings/route.ts`
- Modify: `src/app/api/earnings/payout/route.ts`
- Modify: `src/app/api/onchain/registration-requests/route.ts`
- Modify: `src/app/api/onchain/registration-fee/prepare/route.ts`
- Modify: `src/app/api/onchain/registration-fee/confirm/route.ts`
- Modify: `src/app/api/onchain/registration-fee/[id]/route.ts`

- [ ] **Step 1: Add guard to uploads API**

At the top of `src/app/api/uploads/route.ts`, import:

```ts
import { requireApprovedPhotographer } from "@/lib/photographers/approval";
```

After authenticated user lookup in both `GET` and `POST`, add:

```ts
const admin = createAdminClient();
const authorization = await requireApprovedPhotographer(admin, user.id);
if (!authorization.ok) return authorization.response!;
```

Reuse that `admin` variable in `POST` instead of creating a second admin client later.

- [ ] **Step 2: Add guard to upload presign API**

In `src/app/api/uploads/presign/route.ts`, import `createAdminClient` and `requireApprovedPhotographer`. After authenticated user lookup, add:

```ts
const authorization = await requireApprovedPhotographer(createAdminClient(), user.id);
if (!authorization.ok) return authorization.response!;
```

- [ ] **Step 3: Add guard to upload edit/delete API**

In `src/app/api/uploads/[id]/route.ts`, import `requireApprovedPhotographer`. After authenticated user lookup in `PATCH` and `DELETE`, add:

```ts
const authorization = await requireApprovedPhotographer(createAdminClient(), user.id);
if (!authorization.ok) return authorization.response!;
```

- [ ] **Step 4: Add guard to earnings APIs**

In `src/app/api/earnings/route.ts`, replace the role check block with:

```ts
const authorization = await requireApprovedPhotographer(createAdminClient(), user.id);
if (!authorization.ok) return authorization.response!;
```

In `src/app/api/earnings/payout/route.ts`, add the same guard after user authentication and before reading the request body.

- [ ] **Step 5: Add guard to onchain photographer APIs**

In `src/app/api/onchain/registration-requests/route.ts`, call the guard at the start of both `GET` and `POST` after user authentication:

```ts
const authorization = await requireApprovedPhotographer(createAdminClient(), user.id);
if (!authorization.ok) return authorization.response!;
```

In `src/app/api/onchain/registration-fee/prepare/route.ts`, add the same guard before reading `imageIds`.

In `src/app/api/onchain/registration-fee/confirm/route.ts`, add the same guard before loading fee orders.

In `src/app/api/onchain/registration-fee/[id]/route.ts`, require approval for non-admin users:

```ts
if (!isAdmin) {
  const authorization = await requireApprovedPhotographer(admin, user.id);
  if (!authorization.ok) return authorization.response!;
}
```

- [ ] **Step 6: Run TypeScript and focused route-adjacent tests**

Run:

```bash
npx tsc --noEmit
npm test -- src/lib/photographers/approval.test.ts
```

Expected: TypeScript exits 0 and tests pass.

- [ ] **Step 7: Commit guards**

```bash
git add src/app/api/uploads/route.ts src/app/api/uploads/presign/route.ts src/app/api/uploads/[id]/route.ts src/app/api/earnings/route.ts src/app/api/earnings/payout/route.ts src/app/api/onchain/registration-requests/route.ts src/app/api/onchain/registration-fee/prepare/route.ts src/app/api/onchain/registration-fee/confirm/route.ts src/app/api/onchain/registration-fee/[id]/route.ts
git commit -m "feat: guard photographer APIs by approval status"
```

## Task 5: Dashboard And Settings User Experience

**Files:**
- Create: `src/components/dashboard/PhotographerStatusNotice.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/app/(dashboard)/dashboard/settings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/uploads/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/uploads/new/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/earnings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/requests/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/blockchain/page.tsx`

- [ ] **Step 1: Create reusable status notice**

Create `src/components/dashboard/PhotographerStatusNotice.tsx`:

```tsx
import Link from "next/link";

type PhotographerStatus = "none" | "pending" | "approved" | "suspended";

const STATUS_COPY: Record<Exclude<PhotographerStatus, "approved">, { icon: string; title: string; body: string; tone: string }> = {
  none: {
    icon: "photo_camera",
    title: "사진가 신청이 필요합니다",
    body: "사진 업로드와 판매 기능을 사용하려면 사진가 신청을 먼저 접수해주세요. 구매자 기능은 계속 이용할 수 있습니다.",
    tone: "bg-surface-container-low text-on-surface-variant border-outline-variant/30",
  },
  pending: {
    icon: "pending_actions",
    title: "사진가 신청이 접수되었습니다",
    body: "관리자가 신청 내용을 확인 중입니다. 승인되면 업로드, 판매, 정산 기능이 활성화됩니다. 구매자 기능은 바로 이용할 수 있습니다.",
    tone: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-900/40",
  },
  suspended: {
    icon: "block",
    title: "사진가 권한이 비활성화되었습니다",
    body: "사진가 신청이 승인되지 않았거나 관리자에 의해 권한이 비활성화되었습니다. 설정에서 다시 신청할 수 있습니다.",
    tone: "bg-error/5 text-error border-error/20",
  },
};

export function PhotographerStatusNotice({
  status,
  rejectionReason,
  compact = false,
}: {
  status: PhotographerStatus;
  rejectionReason?: string | null;
  compact?: boolean;
}) {
  if (status === "approved") return null;
  const copy = STATUS_COPY[status];

  return (
    <div className={`rounded-lg border p-4 ${copy.tone}`}>
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-xl">{copy.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface">{copy.title}</p>
          <p className="mt-1 text-xs leading-relaxed">{copy.body}</p>
          {rejectionReason && (
            <p className="mt-2 rounded bg-surface-container-lowest px-3 py-2 text-xs text-on-surface-variant">
              최근 거절 사유: {rejectionReason}
            </p>
          )}
          {!compact && (
            <Link href="/dashboard/settings" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
              계정 설정으로 이동
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Change dashboard nav gating**

In `src/app/(dashboard)/layout.tsx`, change the role calculation so photographer nav only opens for approved status:

```ts
const photographerApproved = user?.photographer_status === "approved";
const role = photographerApproved ? "photographer" : "buyer";
```

Keep demo role behavior for unauthenticated demo mode. For authenticated pending/suspended users, render buyer nav and show a compact status notice below the role indicator:

```tsx
{user && user.photographer_status !== "approved" && user.photographer_status !== "none" && (
  <div className="px-4 pb-4 border-b border-outline-variant/20">
    <PhotographerStatusNotice status={user.photographer_status} compact />
  </div>
)}
```

- [ ] **Step 3: Update settings application UI**

In `src/app/(dashboard)/dashboard/settings/page.tsx`, add local state:

```ts
const [photographerStatus, setPhotographerStatus] = useState<"none" | "pending" | "approved" | "suspended">("none");
const [latestApplication, setLatestApplication] = useState<{ id: string; status: string; rejection_reason: string | null; created_at: string; reviewed_at: string | null } | null>(null);
```

When loading profile, set:

```ts
setPhotographerStatus(profile.photographer_status ?? "none");
setLatestApplication(profile.latest_photographer_application ?? null);
```

Replace `handleUpgradeToPhotographer` success behavior with:

```ts
const res = await fetch("/api/profile/upgrade-to-photographer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    phone_number: phoneNumber,
    primary_activity_regions: activityRegions,
    bio,
  }),
});

if (res.ok) {
  const body = await res.json();
  setPhotographerStatus("pending");
  setLatestApplication(body.application ?? latestApplication);
  setUpgradeDone(true);
  await init();
}
```

Replace the role management section copy:

```tsx
{photographerStatus === "approved" ? (
  <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 border border-primary/20 rounded-lg">
    <span className="material-symbols-outlined text-xl text-primary">photo_camera</span>
    <div>
      <p className="text-sm font-bold text-on-surface">사진가 계정</p>
      <p className="text-xs text-on-surface-variant mt-0.5">이미지 업로드 및 판매 기능이 활성화되어 있습니다.</p>
    </div>
  </div>
) : photographerStatus === "pending" ? (
  <PhotographerStatusNotice status="pending" compact />
) : (
  <div className="p-5 bg-surface-container-low rounded-lg flex flex-col gap-4">
    <PhotographerStatusNotice status={photographerStatus} rejectionReason={latestApplication?.rejection_reason ?? null} compact />
    <Input
      label={s.phoneLabel}
      type="tel"
      value={phoneNumber}
      onChange={(event) => setPhoneNumber(event.target.value)}
      icon="phone"
      placeholder="+82 10 1234 5678"
    />
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold text-outline uppercase tracking-widest">{s.regionsLabel}</label>
      <textarea
        value={activityRegions}
        onChange={(event) => setActivityRegions(event.target.value)}
        rows={3}
        className="w-full bg-surface-container-lowest ring-1 ring-outline-variant focus:ring-2 focus:ring-primary rounded-lg px-4 py-3 text-sm text-on-surface placeholder:text-outline outline-none resize-none transition-all"
        placeholder={s.regionsPlaceholder}
      />
      <p className="text-xs text-outline">{s.regionsHint}</p>
    </div>
    <button type="button" onClick={handleUpgradeToPhotographer} disabled={upgradeLoading} className="self-start flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded hover:opacity-90 transition-all disabled:opacity-50">
      {upgradeLoading ? "신청 중..." : "사진가 신청"}
    </button>
  </div>
)}
```

- [ ] **Step 4: Add direct-access notices to photographer pages**

At the top of each photographer-only page component, use `useAuth()` and render notice if authenticated but not approved:

```tsx
const { user, init } = useAuth();
useEffect(() => { init(); }, [init]);

if (user && user.photographer_status !== "approved") {
  return (
    <div className="p-6 md:p-10 max-w-2xl">
      <PhotographerStatusNotice status={user.photographer_status} />
    </div>
  );
}
```

Apply this to:

- `src/app/(dashboard)/dashboard/uploads/page.tsx`
- `src/app/(dashboard)/dashboard/uploads/new/page.tsx`
- `src/app/(dashboard)/dashboard/earnings/page.tsx`
- `src/app/(dashboard)/dashboard/requests/page.tsx`
- `src/app/(dashboard)/dashboard/blockchain/page.tsx`

- [ ] **Step 5: Run UI type check**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 6: Commit user UX**

```bash
git add src/components/dashboard/PhotographerStatusNotice.tsx 'src/app/(dashboard)/layout.tsx' 'src/app/(dashboard)/dashboard/settings/page.tsx' 'src/app/(dashboard)/dashboard/uploads/page.tsx' 'src/app/(dashboard)/dashboard/uploads/new/page.tsx' 'src/app/(dashboard)/dashboard/earnings/page.tsx' 'src/app/(dashboard)/dashboard/requests/page.tsx' 'src/app/(dashboard)/dashboard/blockchain/page.tsx'
git commit -m "feat: show photographer approval status in dashboard"
```

## Task 6: Admin Application APIs And Emails

**Files:**
- Modify: `src/lib/email/resend.ts`
- Create: `src/app/api/admin/photographer-applications/route.ts`
- Create: `src/app/api/admin/users/[id]/photographer-suspension/route.ts`

- [ ] **Step 1: Add email helpers**

Append to `src/lib/email/resend.ts`:

```ts
export async function sendPhotographerApproved(opts: {
  photographerEmail: string;
  photographerName: string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  await sendEmail({
    to: opts.photographerEmail,
    subject: "[Image Partners] 사진가 신청이 승인되었습니다",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진가 신청이 승인되었습니다. 이제 이미지 업로드, 판매, 정산 기능을 이용하실 수 있습니다.</p>
      <p><a href="https://imagepartners.kr/dashboard/uploads">사진 업로드 시작하기</a></p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}

export async function sendPhotographerRejected(opts: {
  photographerEmail: string;
  photographerName: string;
  reason: string;
}) {
  const photographerName = escapeHtml(opts.photographerName);
  const reason = escapeHtml(opts.reason);
  await sendEmail({
    to: opts.photographerEmail,
    subject: "[Image Partners] 사진가 신청 검토 결과 안내",
    html: `
      <p>${photographerName}님, 안녕하세요.</p>
      <p>사진가 신청이 아래 사유로 승인되지 않았습니다.</p>
      <p><strong>사유:</strong> ${reason}</p>
      <p>내용을 보완해 다시 신청하실 수 있습니다.</p>
      <br><p>Image Partners 팀 드림</p>
    `,
  });
}
```

- [ ] **Step 2: Create admin applications API**

Create `src/app/api/admin/photographer-applications/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { sendPhotographerApproved, sendPhotographerRejected } from "@/lib/email/resend";
import { createAdminClient } from "@/lib/supabase/admin";

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const query = searchParams.get("query")?.trim().toLowerCase() ?? "";
  const admin = createAdminClient();

  let applicationQuery = admin
    .from("photographer_applications")
    .select(`
      *,
      profile:profiles!profile_id(id, full_name, organization, role, roles, photographer_status, created_at, last_login_at, login_count)
    `)
    .order("created_at", { ascending: false })
    .limit(300);

  if (status === "pending" || status === "approved" || status === "rejected") {
    applicationQuery = applicationQuery.eq("status", status);
  }

  const [{ data, error }, authResult] = await Promise.all([
    applicationQuery,
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (authResult.error) return NextResponse.json({ error: authResult.error.message }, { status: 500 });

  const emailsById = new Map((authResult.data.users ?? []).map((user) => [user.id, user.email ?? ""]));
  const applications = (data ?? []).map((application) => ({
    ...application,
    profile: first(application.profile),
    email: emailsById.get(application.profile_id) ?? "",
  })).filter((application) => {
    if (!query) return true;
    const haystack = [
      application.applicant_name,
      application.organization,
      application.phone_number,
      application.email,
      ...(application.primary_activity_regions ?? []),
    ].filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
  });

  return NextResponse.json({ applications });
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const body = await req.json().catch(() => null) as {
    id?: string;
    action?: "approve" | "reject";
    admin_note?: string;
    rejection_reason?: string;
  } | null;

  if (!body?.id || (body.action !== "approve" && body.action !== "reject")) {
    return NextResponse.json({ error: "id and action are required" }, { status: 400 });
  }
  if (body.action === "reject" && !body.rejection_reason?.trim()) {
    return NextResponse.json({ error: "거절 사유를 입력해주세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before, error: beforeError } = await admin
    .from("photographer_applications")
    .select("*, profile:profiles!profile_id(id, full_name, role, roles, photographer_status)")
    .eq("id", body.id)
    .single();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });
  if (before.status !== "pending") return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 });

  const reviewedAt = new Date().toISOString();
  const nextStatus = body.action === "approve" ? "approved" : "rejected";
  const { data: application, error: updateError } = await admin
    .from("photographer_applications")
    .update({
      status: nextStatus,
      admin_note: body.admin_note?.trim() || null,
      rejection_reason: body.action === "reject" ? body.rejection_reason!.trim() : null,
      reviewed_by: adminUser.id,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    })
    .eq("id", body.id)
    .select()
    .single();
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const profilePatch = body.action === "approve"
    ? { photographer_status: "approved", role: "photographer", roles: ["buyer", "photographer"], updated_at: reviewedAt }
    : { photographer_status: "suspended", updated_at: reviewedAt };

  const { error: profileError } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", before.profile_id);
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: body.action === "approve" ? "photographer_application.approved" : "photographer_application.rejected",
    targetType: "photographer_application",
    targetId: body.id,
    targetLabel: before.applicant_name,
    before,
    after: { application, profilePatch },
  });

  const { data: authUser } = await admin.auth.admin.getUserById(before.profile_id);
  const email = authUser.user?.email;
  if (email) {
    const send = body.action === "approve"
      ? sendPhotographerApproved({ photographerEmail: email, photographerName: before.applicant_name })
      : sendPhotographerRejected({ photographerEmail: email, photographerName: before.applicant_name, reason: body.rejection_reason!.trim() });
    send.catch((emailError) => console.error("[admin/photographer-applications] email failed", emailError));
  }

  return NextResponse.json({ application });
}
```

- [ ] **Step 3: Create admin suspension API**

Create `src/app/api/admin/users/[id]/photographer-suspension/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { recordAdminAuditLog } from "@/lib/admin/audit";
import { forbidden, requireAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const adminUser = await requireAdminUser();
  if (!adminUser) return forbidden();

  const { id } = await params;
  const body = await req.json().catch(() => null) as { admin_note?: string } | null;
  const admin = createAdminClient();

  const { data: before, error: beforeError } = await admin
    .from("profiles")
    .select("id, full_name, role, roles, photographer_status")
    .eq("id", id)
    .single();
  if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 404 });
  if (before.photographer_status !== "approved") {
    return NextResponse.json({ error: "승인된 사진가만 권한을 회수할 수 있습니다." }, { status: 409 });
  }

  const updatedAt = new Date().toISOString();
  const { data: profile, error } = await admin
    .from("profiles")
    .update({ photographer_status: "suspended", updated_at: updatedAt })
    .eq("id", id)
    .select("id, full_name, role, roles, photographer_status, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recordAdminAuditLog(admin, {
    actorId: adminUser.id,
    action: "photographer.suspended",
    targetType: "user",
    targetId: id,
    targetLabel: before.full_name ?? id,
    before,
    after: { profile, adminNote: body?.admin_note?.trim() || null },
  });

  return NextResponse.json({ profile });
}
```

- [ ] **Step 4: Run TypeScript**

Run:

```bash
npx tsc --noEmit
```

Expected: exits 0.

- [ ] **Step 5: Commit admin APIs and emails**

```bash
git add src/lib/email/resend.ts src/app/api/admin/photographer-applications/route.ts src/app/api/admin/users/[id]/photographer-suspension/route.ts
git commit -m "feat: add photographer application admin APIs"
```

## Task 7: Admin Application UI And User Management Integration

**Files:**
- Modify: `src/lib/admin/nav.ts`
- Modify: `src/lib/admin/nav.test.ts`
- Create: `src/app/(admin)/admin/photographer-applications/page.tsx`
- Modify: `src/app/api/admin/users/route.ts`
- Modify: `src/app/api/admin/users/[id]/route.ts`
- Modify: `src/app/(admin)/admin/users/page.tsx`

- [ ] **Step 1: Add nav test**

In `src/lib/admin/nav.test.ts`, add:

```ts
it("includes photographer approval in the user management group", () => {
  const userGroup = ADMIN_NAV_GROUPS.find((group) => group.id === "users");
  expect(userGroup?.items).toContainEqual({
    href: "/admin/photographer-applications",
    icon: "how_to_reg",
    label: "사진가 승인",
  });
});
```

- [ ] **Step 2: Update admin nav**

In `src/lib/admin/nav.ts`, add under the users group after 회원관리:

```ts
{ href: "/admin/photographer-applications", icon: "how_to_reg", label: "사진가 승인" },
```

- [ ] **Step 3: Create admin application page**

Create `src/app/(admin)/admin/photographer-applications/page.tsx` with a client component that:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "pending" | "approved" | "rejected" | "all";

interface PhotographerApplication {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  applicant_name: string;
  organization: string | null;
  phone_number: string | null;
  primary_activity_regions: string[] | null;
  bio: string | null;
  admin_note: string | null;
  rejection_reason: string | null;
  reviewed_at: string | null;
  created_at: string;
  email: string;
  profile: {
    id: string;
    full_name: string | null;
    photographer_status: string;
    created_at: string;
    last_login_at: string | null;
    login_count: number | null;
  } | null;
}

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인됨" },
  { key: "rejected", label: "거절됨" },
  { key: "all", label: "전체" },
];

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
}

export default function AdminPhotographerApplicationsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [query, setQuery] = useState("");
  const [applications, setApplications] = useState<PhotographerApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [adminNote, setAdminNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  const selected = useMemo(
    () => applications.find((application) => application.id === selectedId) ?? applications[0] ?? null,
    [applications, selectedId],
  );

  const loadApplications = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("status", tab);
    if (query.trim()) params.set("query", query.trim());
    try {
      const res = await fetch(`/api/admin/photographer-applications?${params.toString()}`);
      const body = await res.json() as { applications?: PhotographerApplication[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? "사진가 신청 목록을 불러오지 못했습니다.");
      setApplications(body.applications ?? []);
      setSelectedId((current) => current ?? body.applications?.[0]?.id ?? null);
    } catch (error) {
      alert(error instanceof Error ? error.message : "사진가 신청 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [query, tab]);

  useEffect(() => { loadApplications(); }, [loadApplications]);
  useEffect(() => {
    setAdminNote(selected?.admin_note ?? "");
    setRejectionReason(selected?.rejection_reason ?? "");
  }, [selected?.id, selected?.admin_note, selected?.rejection_reason]);

  async function review(action: "approve" | "reject") {
    if (!selected) return;
    if (action === "reject" && !rejectionReason.trim()) {
      alert("거절 사유를 입력해주세요.");
      return;
    }
    setActioning(true);
    try {
      const res = await fetch("/api/admin/photographer-applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selected.id,
          action,
          admin_note: adminNote,
          rejection_reason: rejectionReason,
        }),
      });
      const body = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? "처리하지 못했습니다.");
      await loadApplications();
    } catch (error) {
      alert(error instanceof Error ? error.message : "처리하지 못했습니다.");
    } finally {
      setActioning(false);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface tracking-tight">사진가 승인</h1>
          <p className="mt-1 text-sm text-outline">사진가 가입과 전환 신청을 검토합니다.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 이메일, 소속, 전화, 지역 검색" className="h-11 w-full rounded-lg bg-surface-container-lowest px-4 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary sm:w-80" />
          <button onClick={loadApplications} className="h-11 rounded-lg bg-primary px-4 text-xs font-bold uppercase tracking-widest text-white">조회</button>
        </div>
      </div>

      <div className="mb-6 flex w-fit gap-1 rounded-xl bg-surface-container-lowest p-1 shadow-ghost">
        {TABS.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-lg px-4 py-2 text-xs font-bold transition-colors ${tab === item.key ? "bg-primary text-white" : "text-on-surface-variant hover:text-on-surface"}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-ghost">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b border-outline-variant/20">
                {["신청자", "소속/연락처", "활동 지역", "신청일"].map((head) => (
                  <th key={head} className="px-5 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-outline">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-outline">불러오는 중...</td></tr>
              ) : applications.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-12 text-center text-outline">신청이 없습니다.</td></tr>
              ) : applications.map((application) => (
                <tr key={application.id} onClick={() => setSelectedId(application.id)} className={`cursor-pointer hover:bg-surface-container-low ${selected?.id === application.id ? "bg-primary/5" : ""}`}>
                  <td className="px-5 py-4"><p className="truncate font-semibold">{application.applicant_name}</p><p className="truncate text-xs text-outline">{application.email || application.profile_id}</p></td>
                  <td className="px-5 py-4"><p className="truncate text-xs">{application.organization ?? "-"}</p><p className="truncate text-xs text-outline">{application.phone_number ?? "-"}</p></td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant">{(application.primary_activity_regions ?? []).join(", ") || "-"}</td>
                  <td className="px-5 py-4 text-xs text-outline">{formatDate(application.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="bg-surface-container-lowest p-5 shadow-ghost">
          {!selected ? (
            <div className="flex min-h-96 items-center justify-center text-sm text-outline">신청을 선택하세요.</div>
          ) : (
            <div className="space-y-5">
              <div className="border-b border-outline-variant/20 pb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{selected.status}</p>
                <h2 className="mt-1 font-headline text-xl font-extrabold">{selected.applicant_name}</h2>
                <p className="mt-1 text-sm text-outline">{selected.email}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p><span className="text-outline">소속</span> {selected.organization ?? "-"}</p>
                  <p><span className="text-outline">전화</span> {selected.phone_number ?? "-"}</p>
                  <p><span className="text-outline">지역</span> {(selected.primary_activity_regions ?? []).join(", ") || "-"}</p>
                  <p><span className="text-outline">소개</span> {selected.bio ?? "-"}</p>
                </div>
              </div>
              <label className="block text-xs font-bold uppercase tracking-widest text-outline">관리자 메모</label>
              <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} rows={3} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary" />
              <label className="block text-xs font-bold uppercase tracking-widest text-outline">거절 사유</label>
              <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} className="w-full rounded-lg bg-surface-container-low px-4 py-3 text-sm outline-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary" />
              {selected.status === "pending" && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => review("reject")} disabled={actioning} className="rounded-lg border border-error/40 px-4 py-3 text-xs font-bold uppercase tracking-widest text-error hover:bg-error/10 disabled:opacity-50">거절</button>
                  <button onClick={() => review("approve")} disabled={actioning} className="rounded-lg bg-primary px-4 py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50">승인</button>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add status to admin users APIs**

In `src/app/api/admin/users/route.ts`, include `photographer_status` in `ProfileRow` and the profile select string.

In `src/app/api/admin/users/[id]/route.ts`, include `photographer_status` in the detail select and target select.

- [ ] **Step 5: Add status and suspension action to admin users UI**

In `src/app/(admin)/admin/users/page.tsx`, add `photographer_status` to `UserSummary` and `UserDetail`. In the detail panel, below the role label, render:

```tsx
<span className="mt-2 inline-flex rounded-full bg-surface-container-low px-2.5 py-1 text-[10px] font-bold text-on-surface-variant">
  사진가 상태: {detail.photographer_status ?? "none"}
</span>
```

Add a suspension function:

```ts
async function suspendPhotographer() {
  if (!detail) return;
  if (!confirm("사진가 권한을 비활성화할까요? 기존 이미지 조치는 별도로 처리해야 합니다.")) return;
  const res = await fetch(`/api/admin/users/${detail.id}/photographer-suspension`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ admin_note: "회원관리에서 사진가 권한 회수" }),
  });
  const body = await res.json().catch(() => null) as { error?: string } | null;
  if (!res.ok) {
    alert(body?.error ?? "사진가 권한을 비활성화하지 못했습니다.");
    return;
  }
  await loadDetail(detail.id);
  await loadUsers();
}
```

Render the button when `detail.photographer_status === "approved"`:

```tsx
<button onClick={suspendPhotographer} className="mt-3 w-full rounded-lg border border-outline-variant px-4 py-3 text-xs font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:bg-surface-container-low">
  사진가 권한 회수
</button>
```

- [ ] **Step 6: Run admin nav test and TypeScript**

Run:

```bash
npm test -- src/lib/admin/nav.test.ts
npx tsc --noEmit
```

Expected: test passes and TypeScript exits 0.

- [ ] **Step 7: Commit admin UI**

```bash
git add src/lib/admin/nav.ts src/lib/admin/nav.test.ts 'src/app/(admin)/admin/photographer-applications/page.tsx' src/app/api/admin/users/route.ts 'src/app/api/admin/users/[id]/route.ts' 'src/app/(admin)/admin/users/page.tsx'
git commit -m "feat: add photographer approval admin UI"
```

## Task 8: End-To-End Verification And Regression Sweep

**Files:**
- Modify only files needed to fix verification failures found in this task.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Next.js production build completes successfully.

- [ ] **Step 4: Manual local flow check**

Run:

```bash
npm run dev
```

Open `http://localhost:3000/signup` and verify these flows:

- Buyer signup still presents a buyer path and does not mention admin approval.
- Photographer signup copy makes clear the account can use buyer features while photographer access is pending.
- Pending photographer direct access to `/dashboard/uploads` shows a pending notice instead of an upload form.
- Admin menu includes `사진가 승인`.
- Admin can approve a pending application and the user sees photographer navigation after refresh.
- Admin can reject a pending application and the user sees a suspended/reapply state with the rejection reason.
- Admin can suspend an approved photographer from 회원관리 and existing image action is not automatic.

- [ ] **Step 5: Handle verification failures**

If any verification command fails, return to the task that introduced the failure, make the smallest correction there, rerun Task 8 from Step 1, and keep this step checked only after the full sweep passes. If all verification commands pass on the first run, do not create an extra commit.

## Task 9: Account Withdrawal Policy Review Kickoff

**Files:**
- Create: `docs/superpowers/specs/2026-07-04-account-withdrawal-approval-review.md`

- [ ] **Step 1: Create withdrawal review note**

Create `docs/superpowers/specs/2026-07-04-account-withdrawal-approval-review.md`:

```md
# Account Withdrawal And Photographer Approval Review

## Context

The photographer approval workflow adds persistent application history, admin notes, rejection reasons, and approval/suspension decisions. Withdrawal policy must decide what happens to these records when a profile asks to leave the service.

## Questions To Resolve

- Should `photographer_applications` rows be retained after profile withdrawal for audit and abuse prevention?
- Should private `admin_note` values be redacted when a profile is soft-deleted?
- Should pending applications be automatically marked rejected, canceled, or left pending with a withdrawn profile flag?
- Should withdrawal admin UI show latest photographer application status beside the existing impact assessment?
- Should suspended photographer application history prevent automatic hard deletion?

## Recommended Starting Position

- Retain application rows because they are operational audit records.
- Redact public-facing profile fields through the existing withdrawal flow.
- Add withdrawal UI context for latest photographer status and latest application result.
- Cancel pending applications as part of withdrawal approval so admin queues stay clean.
```

- [ ] **Step 2: Commit review note**

```bash
git add docs/superpowers/specs/2026-07-04-account-withdrawal-approval-review.md
git commit -m "docs: start withdrawal review for photographer approvals"
```

## Final Verification

- [ ] **Step 1: Confirm git history**

Run:

```bash
git log --oneline -n 10
```

Expected: recent commits show schema, helpers, signup flow, guards, UX, admin APIs/UI, verification fixes if any, and withdrawal review note.

- [ ] **Step 2: Confirm clean intended diff**

Run:

```bash
git status --short
```

Expected: no uncommitted changes from photographer approval work. Pre-existing unrelated dirty files may remain; do not revert them.
