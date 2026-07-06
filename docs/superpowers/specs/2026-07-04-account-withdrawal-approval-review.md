# Account Withdrawal Review After Photographer Approval

## Context

Photographer access now has a separate approval gate:

- `none`: never applied after signup.
- `pending`: application waiting for admin review.
- `approved`: photographer capabilities are active.
- `suspended`: rejected application or admin access removal.

Account withdrawal policy should not treat `role = photographer` as the only signal anymore. Legacy role fields can remain after suspension, while actual photographer access is determined by `photographer_status`.

## Current Withdrawal Behavior

User-initiated withdrawal always creates a `profile_withdrawal_requests` row with an impact snapshot.

Admin deletion from `/admin/users` tries immediate soft deletion only when the photographer-side impact is safe. It blocks into withdrawal review when the target has:

- active images
- sold images
- Base or Arweave proof records
- pending orders
- pending or processing payouts
- claimable onchain earnings

This is still the right safety model. Withdrawal risk is about operational records, buyer access, payments, settlement, and immutable proofs; it is not only about the current approval status.

## Policy Adjustments

### 1. Pending Applicants

Pending applicants with no uploaded/sold/onchain records can be withdrawn through the normal review path.

Recommended handling:

- Keep `photographer_applications` rows until profile deletion is finalized for audit context.
- If withdrawal is approved before the application is reviewed, admins should mark the withdrawal request and avoid approving the pending photographer application.
- A future automation may cancel pending photographer applications when withdrawal reaches `completed`.

### 2. Suspended Applicants Or Revoked Photographers

`photographer_status = suspended` does not mean the account is safe to delete.

Recommended handling:

- Continue running the existing withdrawal impact assessment.
- Preserve rejected application history and admin suspension audit logs.
- If the account has no blocking image/order/payout/onchain records, soft deletion can proceed.
- If there are blocking records, keep the withdrawal review workflow.

### 3. Approved Photographers

Approved photographers should follow the existing photographer withdrawal safeguards.

Recommended handling:

- Do not delete active/sold/onchain-backed photographer records automatically.
- Require admin review when impact snapshot has blocking reasons.
- Suspension can be used before withdrawal to stop new photographer actions, but suspension alone does not resolve existing operational obligations.

### 4. `none` Buyers

Buyers who never applied for photographer access should follow buyer withdrawal logic.

Recommended handling:

- Pending buyer orders should remain a blocker.
- Photographer application tables do not need special handling.

## Implementation Notes

The current implementation is acceptable for this release because impact assessment is based on actual records, not only role.

Follow-up improvements worth scheduling:

- Include `photographer_status` in withdrawal request admin target summaries.
- Add an admin warning when a pending photographer application exists for a withdrawal target.
- On withdrawal completion, mark any pending photographer application as rejected or add a dedicated cancelled status if the workflow later expands.
- Consider extending `profile_withdrawal_requests.impact_snapshot` with `photographerStatus` and `pendingPhotographerApplications` for easier audit review.
- Ensure any final hard-deletion process preserves application/audit history if legal or operational records require it.

## Decision

No immediate code change is required beyond exposing photographer status in member management. The withdrawal policy remains record-impact based:

- approval status controls future photographer access
- withdrawal assessment controls whether account removal is operationally safe
- application and audit history should remain available during admin review
