# Image Sourcing Requests And Site Positioning Design

Date: 2026-06-17

## Purpose

Image Partners is not a public 1:1 buyer-photographer matching marketplace. Its buyer-facing value is reliable image sourcing for publishers: a member can describe the image they need, and Image Partners reviews rights, searches for suitable alternatives, and uses its internal photographer/supply network when necessary. The buyer should experience this as an Image Partners sourcing service, not as direct photographer matching.

This design covers two related workstreams:

1. Image sourcing request workflow.
2. Site positioning, homepage, footer, and launch copy cleanup.

Implementation should not proceed until this design is reviewed and approved.

## Product Position

### Buyer-Facing Promise

Image Partners helps publishers find accurate images and understand whether those images can be used. The platform may:

- Check rights or usage conditions for a specific image or source.
- Search for similar images when a buyer provides a sample or natural-language need.
- Check internally whether suitable registered images exist or whether the supply network can provide candidates.

The buyer-facing language should avoid "photographer matching." A photographer request is an internal supply-chain process.

### Service Access

The sourcing request service is free for members, but request submission requires login.

Reasons:

- Request history must be tied to a member account.
- Operations needs a stable reply channel.
- Abuse and duplicate requests need to be manageable.
- Future paid research, quote, or purchase conversion can build on the same record.

## Sourcing Request Workflow

### Buyer Request Input

The buyer starts with a natural-language request. The request can also be tagged with multiple request purposes:

- Rights check.
- Similar image search.
- New shoot or held-image availability check.

These are not mutually exclusive. One request can need all three.

The buyer-facing form should prioritize:

- "What image do you need?" natural-language brief.
- Optional reference URL or reference note.
- Usage purpose.
- Deadline.
- Budget range.
- Purpose tags.
- Non-copying confirmation when references are supplied.

### Public Buyer Statuses

Buyer-facing status should stay simple:

- Received.
- Under review.
- Candidates proposed / Answer ready.
- Closed.

Do not expose internal details such as which photographers were contacted or whether the platform is checking with photographers.

### Internal Admin Statuses

Admin can track more detailed internal work, including:

- Received.
- Rights check needed.
- Similar image search in progress.
- Internal supply check in progress.
- Candidate images being edited.
- Answer ready.
- Answer sent.
- Closed, on hold, or unavailable.

The exact enum can be implemented conservatively, but the UI should support this operating model.

### Photographer/Supply Network Handling

One buyer request can be sent internally to multiple photographers or supply contacts.

Rules:

- Photographers are internal supply candidates, not buyer matches.
- Buyers are not told which photographers were contacted.
- Photographer-facing language should be "Image Partners operations request" or "internal image availability request," not "buyer match."
- Buyer identity should not be disclosed to photographers by default.
- Photographers receive only the context necessary to check whether they have or can produce suitable images.

### Candidate Images

Buyer-facing candidate images must be platform-registered images only.

If an external or unregistered candidate exists, operations should first register it through the normal image workflow:

1. Register image in the platform.
2. Set rights, license, price, attribution, watermark, and publishing status.
3. Connect the registered image as a candidate result.

This keeps rights, pricing, watermarking, cart, purchase, and download flows inside the existing platform.

### Drafting And Publishing Results

Candidate images and answers are private while admins are editing.

Admin workflow:

1. Open a buyer sourcing request.
2. Search and attach registered candidate images.
3. Order, remove, or replace candidates.
4. Write buyer-facing answer text.
5. Set rights-check result if applicable.
6. Save as internal draft.
7. Click "Send answer" to publish to the buyer.

Only after "Send answer":

- Buyer status changes to Candidates proposed / Answer ready.
- Candidate images become visible to the buyer.
- Buyer-facing answer text becomes visible.
- Email notification is sent.

### Buyer Result View

Buyers should have a dedicated "My Sourcing Requests" page separate from photographer requests.

Each request result should show:

- Operations answer.
- Rights-check result and explanation, if applicable.
- Candidate image list.
- Candidate thumbnail, title, photographer ID credit line, price, and usage conditions.
- "Add to cart" directly from the result screen.
- "View details" for deeper inspection.
- Revision request button.
- Close request button.

### Revision Requests

After an answer is sent, the buyer may request revisions in the same request up to three times.

Required buyer-facing notice:

> 이 요청에서는 최대 3회까지 후보 수정 요청이 가능합니다. 추가 범위가 큰 경우 새 요청으로 접수해 주세요.

Revision input should use quick reasons plus free text.

Quick reasons:

- Wrong location.
- Wrong season or time of day.
- Wrong composition or distance.
- Commercial usage terms do not fit.
- Price does not fit.
- More candidates needed.
- Other.

Large scope changes after three revision rounds should prompt a new sourcing request.

### Rights Check Result

Rights-check results should use a standard status plus explanation:

- Usable.
- Conditionally usable.
- Unable to verify.
- Not recommended for use.

The buyer needs to know whether they can use the image. Avoid overly legalistic risk language in the primary UI. Admin explanations can include practical conditions such as attribution, non-commercial restriction, additional permission required, or usage not recommended.

## Site Positioning And IA Cleanup

### Homepage Routing

The root route `/` should become the library-first experience.

The current company-introduction landing page should move to `/about`.

Reason:

- The first user segment is Korean publishers and editors.
- Their primary job is to find an image, not read a brand landing page.
- Trust and company positioning should remain available, but as supporting content.

### Library Copy

Library hero supporting copy should change:

- From: `세계 최고의 퍼블리셔를 위한 큐레이션 이미지`
- To: `퍼블리셔를 위한 정확한 이미지`

### About Page Copy Cleanup

The moved `/about` page should avoid unverified claims and founder-history claims.

Requested Korean copy changes:

- `출판 산업을 위한 프리미엄 아카이브 및 현대 이미지 에이전시. 역사적 의미와 현대적 스토리텔링 사이의 간극을 잇습니다`
  -> `프리미엄 아카이브 및 현대 이미지 에이전시. 역사적 의미와 현대적 스토리텔링 사이의 간극을 잇습니다.`
- `우리는 큐레이션합니다 시각적 탁월함을.`
  -> `퍼블리셔를 위한 정확한 이미지`
- Mission body:
  -> `무한한 이미지 속에서 가치 있는 시각 정보를 선별합니다. 이미지파트너스는 단순한 데이터 저장소가 아닌, 엄선된 작품을 선보이는 갤러리입니다. 우리는 창작자들에게 필요한 단편적인 에셋을 넘어, 이미지에 문맥과 서사, 생명력을 불어넣어 완성된 이야기를 제공합니다.`
- `진정성 최우선`
  -> `오직 확실한 것만 전합니다`
- Add or replace a value item:
  -> `검증된 캡션 이미지의 출처 및 캡션의 정확성을 생명으로 생각합니다.`
- `글로벌 네트워크` description:
  -> `글로벌 파트너와 함께`
- `영업팀 문의`
  -> `문의`

Sections to hide/comment out for now:

- Founding date / `창립 1994`.
- Any `1994년부터...` claim.
- `우리의 핵심 역량` description about international print media archive restoration.
- Restoration mastery section.
- Timeline / `우리의 발자취`.
- Partner/logo trust section / `업계 리더들의 선택`.
- Customer support section if not operationally ready.
- Terms/legal promotional links if not operationally ready in footer.

### Footer

Footer should be simplified to confirmed company information only.

Remove or hide:

- Resources menu.
- Legal menu.
- Company menu.
- Customer support link if not ready.
- Terms/legal links if not ready.

Keep:

- Brand name.
- Short positioning line without the 1994 claim.
- Address: `서울시 서대문구 거북골로 21길57 제1호`
- Email: `helpimagepartners@gmail.com`

Phone was requested as a field but no number was provided yet. Do not invent one. Leave phone hidden until provided.

### Pricing Copy

Replace Korean `영업팀 문의` copy with `문의` where visible, including pricing CTAs.

### Authentication Copy

Remove or hide visible `Est. 1994` copy from login, signup, and forgot-password screens.

## Image Orientation Check

The user observed that deployed image orientation may still be wrong. Implementation should verify whether the current upload/orientation fix is present and working.

Acceptance:

- Landscape images remain landscape.
- Portrait images remain portrait.
- EXIF orientation is respected.
- If already fixed in current code but not deployed, no code change is required; report that it is a deployment/version issue.

## Data Model Direction For Sourcing Results

The current `contact_submissions` and `photo_request_matches` workflow can support internal operations, but buyer-facing sourcing results need additional result concepts.

The implementation plan must provide storage for these capabilities, either by adding new tables or by extending the existing contact workflow with clearly named fields:

- Admin draft answer linked to a buyer sourcing request.
- Published answer linked to a buyer sourcing request.
- Candidate image rows linked to existing `images`.
- Candidate visibility state so candidates remain private until answer publication.
- Revision request records with a maximum of three buyer-initiated revision rounds.
- Buyer-visible status mapping separate from internal operations status.
- Rights-check result status and explanation fields.

## Error Handling

Buyer-facing request submission:

- Requires login.
- Should explain validation failures in Korean.
- Should never mention internal photographer matching.

Admin result publishing:

- Should not publish candidates until "Send answer."
- Should fail clearly if candidate image is not approved/published.
- Should log answer publishing and revision handling in admin audit logs.

Email:

- Buyer notification should be sent after answer publication.
- Photographer/internal supply emails should not disclose buyer identity by default.
- Final email copy requires human review.

## Testing And Verification

Implementation should include:

- Unit tests for status mapping, revision limit, rights-check labels, and candidate publication rules.
- API tests or focused route helper tests where practical.
- TypeScript check.
- Full test suite.
- Lint.
- Production build.
- Browser verification for `/`, `/library`, `/about`, footer, buyer request result, and admin support/result editing flows.

## Human Review Required

Before production rollout, the user must approve:

- Final buyer-facing service name and Korean labels.
- Final email copy.
- Rights-check result descriptions.
- Revision limit copy.
- Footer company information, including phone number if desired.
- Whether hidden legal/support links should remain inaccessible or only visually hidden.
