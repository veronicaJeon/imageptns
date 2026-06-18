# First Release Payment Closure Design

## Goal

Close the first release payment gap by adding an offline bank-transfer purchase flow, an admin payment request queue, responsive layout fixes for dense order/user screens, and per-image admin edits for descriptions and license prices.

## Design

Bank transfer reuses the existing `orders` and `order_items` tables. Checkout creates a pending order with `payment_provider = 'bank_transfer'` and `offline_payment_status = 'requested'`, then shows the buyer the configured bank account and the message "입금 확인 즉시 구매확정처리해드립니다". Admins review these pending orders in a new payment requests page. Approving a request updates the order to `status = 'completed'`, which reuses the existing database trigger that creates download access, earnings ledger rows, subscription usage rows, and image sale/proof updates. Canceling a request updates `status = 'canceled'` and `offline_payment_status = 'canceled'`.

Image-specific prices are stored in `image_price_overrides`, keyed by image and license code. Checkout and public license-type price loading prefer the image override when present, otherwise they use `license_types.price_krw`. Admin image management exposes title, description, category, tags, publish state, and per-license override prices in an edit modal.

Dense layouts are adjusted without changing their data contracts. Buyer orders become card-first on narrow screens with a simpler desktop table. Admin users keep the detail panel but reduce the table to the highest-signal columns so Korean labels do not collapse vertically.

## Constraints

- Admin pages remain Korean-only.
- Bank account configuration is environment-backed for this release.
- Existing completed-order trigger remains the only source of download/settlement side effects.
- Onchain and Toss flows are not removed in this change; bank transfer becomes the primary release-safe fallback.

