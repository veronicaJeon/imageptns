# Photographer Approval Design

## Goal

Image Partners will keep buyer signup friction low while changing photographer signup and buyer-to-photographer conversion into an admin approval workflow.

Buyers can sign up and use buyer features immediately. Users who choose photographer signup, or existing buyers who request photographer access, become normal buyer accounts first. Photographer-only capabilities are enabled only after admin approval.

## Policy Decisions

- Buyer accounts do not require admin approval.
- Photographer signup creates a buyer account and a photographer approval application.
- Buyer-to-photographer conversion creates a photographer approval application instead of granting the role immediately.
- Photographer application input is intentionally light: name, organization, phone number, primary activity regions, and short bio.
- The application workflow is simple: pending, approved, rejected.
- Rejected users can apply again.
- Admin approval results are communicated by email and in-dashboard status messaging.
- Existing photographer accounts are migrated as approved so active upload, sales, and payout flows are not interrupted.
- Admins can later suspend photographer access and separately choose whether existing images should remain live, be unpublished, or be handled through a cleanup flow.
- After this design, account withdrawal policy must be reviewed for pending, approved, rejected, and suspended photographer states.

## Data Model

`profiles` stores the current photographer gate state.

```text
photographer_status:
- none: no photographer application history after signup
- pending: a photographer application is waiting for admin review
- approved: photographer access is active
- suspended: photographer access is inactive because an application was rejected or an approved photographer was suspended
```

`none` is reserved for users who have never applied after account creation. Rejected applications and admin suspensions both set `photographer_status = suspended`; the reason and history live in application and audit records.

`photographer_applications` stores application history.

```text
id uuid primary key
profile_id uuid references profiles(id)
status text check in ('pending', 'approved', 'rejected')
applicant_name text
organization text
phone_number text
primary_activity_regions text[]
bio text
admin_note text
rejection_reason text
reviewed_by uuid references profiles(id)
reviewed_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Only one pending application is allowed per profile. Historical approved and rejected rows remain available for admin context.

The existing `profiles.role` and `profiles.roles` fields remain for compatibility with current UI and queries, but photographer access must be gated by `photographer_status = 'approved'`. Approval should synchronize `role = 'photographer'` and ensure `roles` includes `photographer`. Suspension changes only `photographer_status = 'suspended'`; it does not need to remove legacy role fields. UI and APIs must therefore stop treating `role` or `roles` alone as sufficient photographer authorization.

## Signup Flow

Buyer signup:

1. Supabase auth user is created.
2. `profiles` row is created with buyer role data.
3. `photographer_status = 'none'`.
4. User can access buyer features immediately.

Photographer signup:

1. Supabase auth user is created.
2. `profiles` row is created as a buyer account.
3. A `photographer_applications` row is created from signup fields.
4. `profiles.photographer_status = 'pending'`.
5. User can access buyer features immediately.
6. Photographer-only features show an approval-pending message until admin approval.

Email/password signup and Google OAuth signup must follow the same business rule. The current OAuth callback path that directly writes `role = 'photographer'` must change to create a buyer profile plus a pending application.

Application creation should be guaranteed after the profile exists through an idempotent server helper. Email signup should call this helper after Supabase returns the created user, and the auth callback should call it again when user metadata still indicates photographer intent. Google OAuth should call the same helper after session exchange. Repeated calls must return the existing pending application instead of creating duplicates.

## Buyer-To-Photographer Conversion

The current `/api/profile/upgrade-to-photographer` behavior grants photographer access immediately. It should become a request endpoint:

1. Confirm the user is authenticated.
2. If `photographer_status = 'approved'`, return the current approved state.
3. If a pending application exists, return that pending state.
4. Otherwise create a pending application from current profile fields and request payload.
5. Set `photographer_status = 'pending'`.

The settings page should rename the action from immediate conversion to photographer application submission.

## User Experience

Pending users should not feel lost. They should see clear status messaging in the dashboard and settings page.

Pending copy should communicate:

- The photographer application has been received.
- Admin review is in progress.
- Upload, sales, earnings, photographer requests, and onchain registration open after approval.
- Buyer features remain available immediately.

Direct access to photographer pages such as uploads, earnings, photographer requests, and blockchain registration should show a status page rather than a generic error.

Approved users see photographer navigation and can use photographer features.

Suspended users see that photographer access is inactive and can submit another application. If the suspension was caused by rejection, the latest rejection reason should be shown. If suspension was caused by admin access removal, the message should direct the user to contact support or submit a new application if allowed by the UI.

Rejected users are represented as `photographer_status = 'suspended'` on `profiles` plus a rejected latest application. They can submit another application, creating a new pending application row.

## Admin UI

Add a separate admin page under the user management nav group.

```text
유저관리
- 회원관리
- 사진가 승인
- 탈퇴 검토
- 관리자 계정
```

The new page should live at `/admin/photographer-applications`.

Top controls:

- Tabs: pending, approved, rejected, all
- Search by name, email, organization, phone number, or region
- Summary counts for pending and recently reviewed applications

List columns:

- Applicant name and email
- Organization
- Phone number
- Primary activity regions
- Application date
- Status badge
- Prior rejected application indicator

Detail panel:

- Application fields: name, organization, phone number, regions, bio
- Account fields: signup date, recent login, current role, photographer status
- Buyer activity summary for context
- Application history, especially prior rejected rows
- Admin note
- Rejection reason
- Actions: approve, reject

Approval action:

1. Mark the application as approved.
2. Set `profiles.photographer_status = 'approved'`.
3. Synchronize role compatibility fields so photographer UI can open.
4. Send approval email.
5. Record an admin audit log.

Rejection action:

1. Mark the application as rejected.
2. Set `profiles.photographer_status = 'suspended'`.
3. Store rejection reason and optional admin note.
4. Send rejection email.
5. Record an admin audit log.

The existing `/admin/users` detail panel should show the current photographer status. For approved photographers, it should expose an admin suspension action. Suspension updates only `photographer_status = 'suspended'`, records an audit log, and lets the admin choose separate image actions.

## Access Control

Photographer-only functionality must be guarded server-side with a shared helper that checks:

```text
authenticated user exists
profile.photographer_status = 'approved'
```

Client navigation can hide or lock photographer menus, but APIs must enforce the same rule.

Routes and areas that need the guard include:

- Upload presign and upload creation APIs
- Upload edit/delete APIs
- Photographer dashboard upload pages
- Earnings and payout APIs
- Photographer request response APIs
- Onchain registration request and registration fee APIs
- Any future photographer-only API or dashboard route

Buyer browsing, favorites, orders, downloads, photo sourcing requests, and settings remain available to normal buyer accounts.

## Notifications

Approval and rejection should trigger email notifications. Email delivery failure must not roll back the admin decision. It should be logged for operations review.

Dashboard messaging should also show the current photographer status so users do not have to rely only on email.

## Migration

Add a migration that:

1. Adds `profiles.photographer_status` with default `none`.
2. Creates `photographer_applications`.
3. Adds a partial unique index so each profile can have only one pending application.
4. Sets existing profiles with `role = 'photographer'` or `roles` containing `photographer` to `approved`.
5. Sets all other existing profiles to `none`.

No existing photographer images, sales, orders, payouts, or onchain records should be changed during this migration.

## Edge Cases

- Duplicate pending applications must be prevented.
- Reapplying from suspended state should create a new pending application and leave prior rejected rows intact.
- Existing approved photographers must remain operational after migration.
- OAuth callback must not grant photographer access directly.
- Email-confirmation and OAuth flows should be idempotent so refreshes or repeated callbacks do not create duplicate pending applications.
- Admin rejection should require a rejection reason for user-facing clarity.
- Admin notes can be private and should not be shown to the applicant.
- Suspension should not delete or mutate purchase, download, payout, or audit history.
- Image visibility changes after suspension should be a separate explicit admin action.

## Testing

Unit and integration coverage should include:

- Signup-flow helpers for buyer and photographer intent.
- Migration behavior for existing buyer and photographer profiles.
- Application creation idempotency.
- Buyer-to-photographer request behavior.
- Admin approve, reject, reapply, and suspend flows.
- Server guards blocking pending and suspended users from photographer APIs.
- Pending dashboard and settings messaging.
- Approved photographer navigation and API access.
- Rejection/suspension reapplication UX.
- Approval and rejection email invocation.
- Regression checks that buyer features remain available without approval.

## Account Withdrawal Follow-Up

After the approval workflow is designed and implemented, account withdrawal policy needs a focused review.

The review should cover:

- Whether photographer application history and admin notes are retained after profile withdrawal.
- How pending applications are canceled when a user requests withdrawal.
- Whether suspended/rejected application history remains available for abuse prevention and audit.
- How approved or previously approved photographers interact with existing image, sales, payout, onchain, and download preservation rules.
- Whether withdrawal admin UI should show photographer application history alongside the existing impact assessment.

This is intentionally a follow-up because withdrawal has separate retention and legal/audit concerns.
