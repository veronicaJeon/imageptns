# Image Partners Platform Realignment Design

Date: 2026-06-07

## Purpose

Image Partners is being repositioned for its first practical market: Korean publishing editors and photographers. The platform's core value is not broad Web3 commerce. It is a trusted marketplace for original photographs where authorship, rights, usage conditions, and evidence records are clear enough for buyers and photographers to transact with confidence.

This design realigns the already implemented system with that product direction. It does not remove future Web3 capability. It separates Phase 1 copyright/proof infrastructure from deferred onchain payment flows so the live product can become simpler, safer, and more buyer-friendly.

## Product Principles

1. The platform sells trust, not blockchain complexity.
2. Buyers should see plain usage conditions, not internal proof mechanics.
3. Photographers should upload efficiently, but they must personally attest to authenticity and rights.
4. Onchain and Arweave records are evidence infrastructure. They should support trust without dominating the buyer UI.
5. Existing implemented modules should be reorganized around user jobs: upload/prove, search/buy, request/source, review/operate, and audit/defend.

## Confirmed Policy Decisions

### Photographer Identity

- Each photographer must have a platform photographer ID.
- Google login users must choose a separate site ID before photographer use.
- The ID is immutable after creation.
- The ID must be unique and contain no spaces.
- Allowed characters are letters, numbers, hyphen, and underscore.
- Official credit line is always:

```text
photographerID / Image Partners
```

- The credit line must be snapshotted into purchase/license records at transaction time.

### Attribution

- Attribution is mandatory for every product, including paid, free, educational-free, and commercial-use assets.
- Buyer-facing copy should not ask whether attribution is optional.
- CC or internal license mappings may exist in the backend, but the buyer-facing language should always include the mandatory credit line.

### Commercial Use

- "Commercial use allowed" means broad commercial use by default.
- The product should not split commercial use into publishing, advertising, package, and campaign subtypes in the initial UI.
- If a specific image contains higher-risk content, admin review may mark it as editorial-only or commercial-use restricted.

### Uncertain Uploads

- A photo with unresolved authenticity, rights, portrait, property, or commercial-use uncertainty cannot be submitted for sale.
- The uploader has only two actions on a flagged photo:
  - Confirm the issue is resolved and attest responsibility.
  - Exclude the photo from the current upload.
- "Unknown", "edit later", and "admin review request" are not valid upload resolution states for rights/factual risk.
- The platform treats all account actions as the account owner's responsibility. It does not need to distinguish human upload from delegated agent upload for Phase 1.

## Existing Function Areas And Realignment

### 1. Upload And Photo Review

Current state:

- `src/components/upload/UploadForm.tsx` is single-image oriented.
- It stores an image row, uploads storage, and shows an uploaded public URL preview.
- The workflow does not match the newly defined batch upload and attestation model.

Target state:

- Introduce a batch upload workflow as the main photographer upload path.
- Allow up to 30 photos per batch.
- Extract metadata per photo individually.
- Let the uploader select shared fields for the batch:
  - title
  - description/content
  - category
  - keywords
  - copyright/distribution scope
- If shared fields are AI-generated, use one representative photo as the basis.
- If the same title is applied to multiple photos, generate distinguishable numbered titles.
- Use a numbered photo navigation bar for per-photo review.
- Each photo must be reviewed once before submission.
- Completion criteria per photo:
  - required fields present
  - AI risk flags resolved
  - human assurance check completed
- Required fields:
  - title
  - category
  - copyright/distribution scope
- Human assurance check must cover:
  - authenticity/factuality
  - copyright/ownership
  - portrait/third-party rights
  - commercial-use availability, when applicable
- There should be no separate final summary page. The review workspace itself shows progress, missing items, and submission eligibility.

Implementation implication:

- Keep the current single upload only as a fallback or legacy/simple mode if useful.
- Do not extend the old single-form structure until the batch workflow is designed in code.
- Stop exposing public original URLs in success or preview states.

### 2. Watermarked Preview And Original Protection

Current issue:

- The detail page renders a preview image and overlays repeated watermark text in HTML/CSS.
- This can still expose an unwatermarked image URL to the browser.
- The watermark is visually too dense for image evaluation.

Target state:

- Buyers must never receive original image URLs before purchase or valid entitlement.
- Public library/detail/cart/receipt previews must use server-generated watermarked derivative images.
- Watermarks should be fused into the sample image, not layered over the original in HTML.
- The preview should be lower-resolution or quality-limited compared with the original.
- Watermark density should allow evaluation of composition, color, and detail while still deterring misuse.
- Purchased originals are delivered only through short-lived signed download URLs after entitlement checks.

Implementation implication:

- Treat this as P0 revenue protection.
- Add a derivative generation/storage strategy.
- Detail and card components should consume derivative preview URLs only.

### 3. Buyer Search And Filters

Current state:

- `src/app/(public)/library/page.tsx` exposes CC license filters directly.
- It has a keyword/search suggestion flow and a free-only filter.
- Buyer-facing filter language is still license-code-centric.

Target state:

- Use one search input that supports both keyword and natural-language queries.
- Short inputs can behave like keyword search.
- Longer queries should be parsed into intent chips such as:
  - place
  - subject
  - orientation
  - intended use
  - excluded elements
  - time/season when useful
- Search result filters should use buyer-friendly usage conditions:
  - free use allowed
  - educational free use allowed
  - commercial use allowed
  - modifications allowed
  - portrait/person included
  - trademark/signage included
  - building/property included
  - horizontal/vertical
  - high resolution
  - editorial-only, when relevant
- Do not expose "onchain proof complete" as a search filter.
- Onchain/Arweave proof can appear only as a trust detail in the asset detail page.
- When results are empty or sparse, show a strong "create photo sourcing request from these conditions" conversion path.
- Keep a smaller persistent "photo request" button near search.

Implementation implication:

- Replace CC chips in library filters with simple usage-condition filters.
- Add search-intent chips after natural-language parsing.
- Wire sparse/zero-result states to photo sourcing request creation.

### 4. Image Detail Page

Current state:

- `src/app/(public)/library/[id]/page.tsx` mixes CC license explanations with editorial/commercial/extended purchase licenses.
- It shows photographer display/full name rather than the immutable photographer ID credit policy.
- It places technical and license information in the right column, but not according to the newly confirmed hierarchy.

Target state:

- Use a two-level detail structure:
  - right-side purchase summary
  - lower/expanded detail information
- The purchase summary must always show:
  - price or free status
  - usage condition summary
  - mandatory credit line: `photographerID / Image Partners`
  - copy credit button
  - usage cautions
  - original resolution/aspect/file format
  - buy/cart/free-download action
- The main body should show:
  - large protected watermarked sample
  - title
  - short description
  - keywords
  - person/trademark/building/property badges
- Collapsible sections may contain:
  - place
  - capture time
  - EXIF subset
  - hash
  - Arweave/onchain evidence
  - detailed license terms
  - proof history
- Usage cautions must not be hidden in a collapsed section.

Implementation implication:

- Remove buyer-facing reliance on `editorial/commercial/extended` as the primary choice if the new usage-condition model replaces it.
- Generate and display `credit_line_snapshot` for cart/order flows.
- Use photographer ID for all buyer-facing credit lines.

### 5. License And Pricing Model

Current state:

- `src/lib/licenses/creative-commons.ts` maps CC codes and includes `standard`.
- `standard` currently says attribution is not required.
- Admin pricing manages license type prices separately.

Target state:

- Backend may still store CC-compatible structures, but buyer UI should map them to plain conditions.
- Attribution is required across all license and pricing models.
- Core buyer-facing conditions:
  - free use allowed
  - educational free use allowed
  - commercial use allowed
  - modifications allowed
- Admin pricing should control product price and policy knobs without forcing buyers to understand CC codes.
- CC code detail can be shown under "license detail" for users who need it.

Implementation implication:

- Change `standard` attribution semantics to mandatory attribution.
- Add helper functions that convert backend license/policy fields into buyer-facing condition labels.
- Audit cart, order, receipt, download, and PDF output for the unified credit line.

### 6. Photo Sourcing Requests

Current state:

- Contact submissions and photographer matches exist.
- `src/app/api/contact/route.ts` saves contact submissions and sends email.
- `src/app/api/contact/matches/route.ts` lets photographers respond with `interested` or `declined`.

Target state:

- Reframe this feature from generic contact to "photo sourcing request".
- Search conditions can generate a request draft automatically.
- Buyer fills only missing operational information:
  - deadline
  - budget range
  - reference image or URL
  - additional notes
  - contact details when needed
- Admin workflow:
  - request received
  - admin reviews manually
  - system suggests candidate photographers from region, category, keywords, recent activity, and history
  - admin selects recipients manually
  - selected photographers receive email and dashboard request
- Photographer response options:
  - have existing photos
  - can participate in shooting
  - cannot participate
- Buyer request status should be state-based with admin comments:
  - received
  - admin reviewing
  - checking with photographers
  - candidate photos available
  - closed

Implementation implication:

- Merge generic inquiry, request matching, and admin support views conceptually under photo sourcing request management.
- Keep email as the initial notification channel.
- Do not build a native app or push notifications for Phase 1.

### 7. Admin Navigation And Operations

Current state:

- Admin navigation contains many separate items:
  - image review
  - image management
  - deletion requests
  - onchain operations
  - onchain registration photos
  - onchain claims
  - pricing
  - commission
  - support
  - users
  - presence/activity/audit/stats
  - legal/notices
- Onchain payment and copyright proof operations are visually adjacent and can be confused.

Target state:

- Split deferred onchain payment operations from Phase 1 copyright/proof operations.
- Hide or mark onchain payment/claim modules as experimental/internal until onchain payments return.
- Rename copyright evidence areas with business language:
  - Copyright Proof Requests
  - Arweave Registration
  - Proof Ledger
- Merge or regroup generic support/contact/photo request workflows under Photo Sourcing Requests.
- Keep legal document management because legal copy needs admin control.
- Keep audit/activity/presence as operational tooling, but avoid overexposing them as first-level daily menus if navigation becomes crowded.

Implementation implication:

- Refactor admin nav grouping before adding more admin pages.
- Add section labels or grouped navigation to reduce menu sprawl.
- Make Phase 1 daily operations prominent:
  - photo review
  - image management
  - photo sourcing requests
  - proof registration
  - transactions/download logs
  - users
  - legal/policy

### 8. Onchain And Arweave Strategy

Current strategic decision:

- Onchain payments are deferred for Phase 1.
- Onchain/Arweave proof remains part of the copyright evidence strategy.

Target state:

- Payment-specific routes, admin pages, and UI should be hidden, isolated, or labeled as testnet/experimental.
- Proof-specific workflows remain active:
  - photographer requests proof registration
  - admin reviews batch
  - admin pays/submits Arweave registration
  - transaction ID is collected
  - GraphQL confirmation is checked
  - result is written to internal ledger
  - photographer can see proof status and TxID
- Internal ledger must connect:
  - image ID
  - asset ID
  - image hash
  - storage/original reference
  - Arweave transaction ID
  - onchain/base proof key if applicable
  - photographer ID
  - registration actor
  - timestamps
  - proof status

Implementation implication:

- Preserve proof modules.
- Gate payment modules behind feature flags or admin-only test labels.
- Audit any buyer-facing checkout copy so it does not imply onchain payment is the main purchase path.

### 9. Data And Audit Requirements

The platform needs reliable records for disputes, buyer confidence, and photographer protection.

Required snapshots:

- `credit_line_snapshot`
- buyer-facing usage condition snapshot
- license/policy version
- photographer ID at time of transaction
- image title and asset ID at transaction time
- download entitlement window
- original file hash
- proof ledger ID or evidence reference, if registered
- uploader attestation version
- uploader attestation timestamp
- AI draft/risk flags used during upload review
- admin review decision and reviewer ID

These snapshots should live in order/license/download/proof related records, not only in mutable image/profile rows.

## Recommended Implementation Batches

### Batch 1: Revenue Protection And Buyer Language

- Replace overlay watermark previews with server-generated watermarked derivatives.
- Ensure original URLs are never exposed pre-purchase.
- Update buyer filters from CC labels to plain usage conditions.
- Remove onchain proof from buyer filters.
- Make attribution mandatory in license helpers.
- Show unified credit line on detail/cart/checkout/receipt/download flows.

### Batch 2: Detail And Search-to-Request Flow

- Rebuild image detail information hierarchy.
- Add usage cautions as always-visible detail-page information.
- Add natural-language search intent chips.
- Convert zero/sparse search results into photo sourcing request drafts.

### Batch 3: Photo Sourcing Operations

- Rename and regroup contact/support request UI as photo sourcing requests where applicable.
- Add admin candidate recommendation and manual recipient selection.
- Add photographer response options:
  - have existing photos
  - can participate
  - cannot participate
- Add buyer status timeline and admin comments.

### Batch 4: Batch Upload And Attestation

- Add batch upload up to 30 photos.
- Add representative-photo common field generation.
- Add per-photo review navigation.
- Add risk flag resolution with only confirm/exclude.
- Add mandatory human assurance checks.
- Store attestation snapshots.

### Batch 5: Admin IA And Proof Isolation

- Regroup admin navigation.
- Isolate deferred onchain payment pages behind feature flags/test labels.
- Rename proof operations around copyright evidence language.
- Add proof ledger views that connect image, Arweave, hash, and internal records.

## Non-Goals For Phase 1

- Native mobile app.
- Push notifications.
- Fully automated photographer request broadcasting.
- Onchain buyer payments.
- Buyer-facing blockchain terminology as a primary selling point.
- Complex commercial-use subcategories.
- Optional attribution.
- Admin resolving uploader rights uncertainty on behalf of photographers.

## Open Implementation Questions

These are implementation choices, not unresolved product principles:

1. Whether the legacy single-image upload remains accessible after batch upload ships.
2. Whether watermarked derivatives are generated synchronously on upload or lazily on first view.
3. Whether natural-language search parsing uses an existing AI endpoint or a new dedicated endpoint.
4. Whether payment/onchain modules are hidden by feature flag, route guard, or admin test section.
5. Whether photo sourcing request drafts are stored before buyer login or require login first.
