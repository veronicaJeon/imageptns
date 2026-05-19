# Base USDC Onchain Payments Design

## Context

Image Partners is an operating Next.js and Supabase marketplace for licensing photography. The current purchase path uses Toss Payments and writes completed purchases into `orders`, `order_items`, `downloads`, and `earnings_ledger`. The goal is to add onchain purchasing without disrupting the existing production flow.

The selected direction is a hybrid model:

- Keep Toss Payments for existing card and local payment use cases.
- Add USDC payments on Base as a new checkout method.
- Register photo proof onchain when an admin approves an upload.
- Hold photographer revenue in an escrow contract until each photographer claims it.

## Goals

- Let buyers purchase image licenses with USDC on Base.
- Record approved photo proof onchain during the admin approval flow.
- Split purchase value between the platform and photographers in a smart contract.
- Keep existing order history, download authorization, and dashboard flows working.
- Make future token or chain support possible through a payment-provider style boundary.

## Non-Goals

- Removing Toss Payments.
- Building a full royalty resale market.
- Minting NFTs for each photo.
- Supporting multiple chains or multiple tokens in the first implementation.
- Making every photographer pay gas during upload approval.

## Architecture

The app keeps Supabase as the product database and entitlement system. Base becomes the settlement and proof layer.

New pieces:

- `smart-contracts/`: Solidity contract source, deployment scripts, and contract tests.
- `src/lib/onchain/`: Base chain config, contract ABI/address config, USDC config, amount conversion, and transaction helpers.
- `src/app/api/onchain/...`: server endpoints for onchain order preparation, transaction confirmation, and proof registration status.
- Supabase migrations: extend image, order, and earnings records with onchain fields.
- Checkout UI: add a payment-method choice between Toss and Base USDC.
- Admin review flow: register proof on Base when an image is approved.

Supabase remains responsible for search, gallery rendering, account state, downloads, and dashboard reporting. Onchain transactions are treated as external facts that must be verified before the database marks an order completed.

## Data Model

Add image proof fields to `images`:

- `chain_id integer`
- `onchain_asset_id text`
- `content_hash text`
- `proof_tx_hash text`
- `proof_status text not null default 'not_registered'`
- `proof_registered_at timestamptz`

Allowed proof statuses:

- `not_registered`
- `pending`
- `registered`
- `failed`

Add onchain payment fields to `orders`:

- `payment_provider text not null default 'toss'`
- `chain_id integer`
- `payment_token text`
- `payment_tx_hash text`
- `contract_order_id text`
- `crypto_amount numeric`
- `crypto_decimals integer`
- `crypto_status text not null default 'not_applicable'`

Allowed payment providers:

- `toss`
- `base_usdc`

Allowed crypto statuses:

- `not_applicable`
- `pending`
- `confirmed`
- `failed`

Add claim tracking fields to `earnings_ledger`:

- `settlement_provider text not null default 'offchain'`
- `claim_status text not null default 'not_applicable'`
- `claim_tx_hash text`
- `claimable_amount numeric`

Allowed settlement providers:

- `offchain`
- `onchain_escrow`

Allowed claim statuses:

- `not_applicable`
- `claimable`
- `claimed`

## Smart Contract

The MVP contract is `ImagePartnersEscrow`.

Responsibilities:

- Register approved assets with an asset id, content hash, photographer address, and metadata URI.
- Accept USDC purchases for one or more order items.
- Allocate platform fees to the treasury balance.
- Allocate photographer revenue to photographer claimable balances.
- Let photographers claim their accumulated USDC.
- Let the owner update platform fee basis points, treasury address, and trusted operator settings.

Core methods:

- `registerAsset(bytes32 assetId, bytes32 contentHash, address photographer, string metadataURI)`
- `purchase(bytes32 orderId, bytes32[] assetIds, address[] photographers, uint256[] grossAmounts)`
- `claim()`
- `setPlatformFeeBps(uint16 feeBps)`
- `setTreasury(address treasury)`

The contract should use USDC `transferFrom` for purchases. Buyers approve USDC first, then call `purchase`. The contract records events for asset registration, purchase completion, fee allocation, and claims.

## Photo Approval Flow

1. A photographer uploads an image through the existing upload flow.
2. The image remains `pending` in Supabase.
3. An admin clicks approve.
4. The server computes or retrieves a stable `content_hash` for the original image and metadata.
5. The platform operator wallet calls `registerAsset` on Base.
6. On success, Supabase stores `proof_tx_hash`, `proof_status = 'registered'`, `onchain_asset_id`, `chain_id`, and `proof_registered_at`.
7. Supabase updates `images.status = 'approved'`.
8. On failure, Supabase stores `proof_status = 'failed'` and leaves the image review action retryable.

The first implementation may use a server-side operator private key for registration. This key must live only in server environment variables and must never be exposed to the browser.

## Checkout Flow

1. The buyer chooses Base USDC on the checkout page.
2. The app creates a pending order with `payment_provider = 'base_usdc'` and `crypto_status = 'pending'`.
3. The frontend connects the buyer wallet and verifies the network is Base.
4. The frontend checks USDC allowance for the escrow contract.
5. If allowance is too low, the buyer sends an USDC approve transaction.
6. The buyer sends the escrow `purchase` transaction.
7. The frontend sends the transaction hash to the confirm endpoint.
8. The server verifies the Base receipt, contract address, event data, order id, token amount, buyer wallet, and success status.
9. If valid, the server marks the order `completed`, stores the payment transaction fields, and sets `crypto_status = 'confirmed'`.
10. Existing database triggers create downloads and earnings ledger entries.
11. Onchain earnings rows are marked `settlement_provider = 'onchain_escrow'`, `claim_status = 'claimable'`, and include the claimable token amount.

## Photographer Claim Flow

1. The photographer adds a wallet address in dashboard settings or connects a wallet from the earnings page.
2. The earnings page displays claimable USDC based on verified onchain/DB state.
3. The photographer calls `claim()` from their wallet.
4. The app confirms the claim transaction and updates relevant ledger rows to `claim_status = 'claimed'` with `claim_tx_hash`.

The contract remains the source of truth for claimable token balances. Supabase provides dashboard history and reconciliation.

## Error Handling

- If proof registration fails, the admin UI should show a retry action and the image should not silently become approved.
- If a buyer abandons after order creation, the order stays `pending` and can be expired by a cleanup job.
- If USDC approval succeeds but purchase fails, the order remains pending and the buyer can retry purchase.
- If purchase succeeds but server confirmation fails, the buyer can retry confirmation with the transaction hash.
- If an event does not match the pending order exactly, the confirm endpoint rejects it and keeps the order pending or failed.
- If Base RPC is temporarily unavailable, confirmation should return a retryable error rather than marking the order failed.

## Security

- Validate all prices on the server from database license data, not from client cart prices.
- Confirm contract events against the known escrow address and expected chain id.
- Prevent duplicate completion by making `payment_tx_hash` and `contract_order_id` unique for confirmed orders.
- Treat the platform operator private key as server-only secret material.
- Keep onchain ABI and contract addresses in explicit environment-backed configuration.
- Use idempotent order confirmation so repeated confirmation attempts do not double-create entitlements.
- Avoid allowing unapproved or unregistered images in onchain checkout.

## Testing

Contract tests:

- Asset registration succeeds for authorized operator.
- Duplicate asset registration fails.
- Purchase transfers USDC into escrow and allocates platform/photographer balances correctly.
- Claim transfers only the caller's available amount.
- Invalid array lengths, unregistered assets, and zero amounts revert.

API tests or integration checks:

- Pending Base USDC order creation uses server-side prices.
- Confirmation rejects wrong chain, wrong contract, wrong order id, wrong token amount, and failed receipts.
- Confirmation is idempotent for the same valid transaction.
- Admin approval records proof status and does not approve silently on registration failure.

Frontend checks:

- Checkout can switch between Toss and Base USDC.
- Base payment path handles wallet missing, wrong network, insufficient allowance, pending transaction, success, and retryable confirmation failure.
- Earnings page shows claimable/claimed onchain settlement states.

## Rollout

1. Add database migrations and onchain configuration.
2. Add contract source and local/Base testnet deployment flow.
3. Add admin proof registration behind environment configuration.
4. Add Base USDC checkout as an additional payment method.
5. Add confirmation and reconciliation endpoints.
6. Add photographer claim UI.
7. Test end to end on Base Sepolia before configuring Base mainnet.

## Open Implementation Choices

- Whether `content_hash` should hash only the original file bytes or a canonical JSON payload containing file hash plus selected metadata.
- Whether the first deployment target should be Base Sepolia only, with mainnet gated by a separate environment flag.
- Whether photographer wallet collection should be required before image approval or only before claim.

Recommended defaults:

- Hash canonical JSON containing original file hash, asset id, photographer id, title, and storage path.
- Start with Base Sepolia and make Base mainnet opt-in by environment.
- Allow approval before wallet collection, but require a wallet before the first claim.
