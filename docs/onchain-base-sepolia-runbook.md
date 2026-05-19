# Base Sepolia Onchain Runbook

## Values You Need

Add these to `.env.local` before deployment and end-to-end testing:

```dotenv
NEXT_PUBLIC_ONCHAIN_ENABLED=true
NEXT_PUBLIC_BASE_CHAIN_ID=84532
NEXT_PUBLIC_BASE_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e
BASE_RPC_URL=
ONCHAIN_OPERATOR_PRIVATE_KEY=
ONCHAIN_TREASURY_ADDRESS=
ONCHAIN_PLATFORM_FEE_BPS=2000
ONCHAIN_USDC_PER_KRW=0.00075
NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS=
CRON_SECRET=
```

## Where To Get Them

- `BASE_RPC_URL`: use Base Sepolia public RPC (`https://sepolia.base.org`) for quick testing, or create a Base Sepolia endpoint from Alchemy, Coinbase Developer Platform, QuickNode, or another RPC provider for stability.
- `ONCHAIN_OPERATOR_PRIVATE_KEY`: create a fresh testnet-only wallet. This wallet registers approved image proofs and deploys the escrow contract.
- `ONCHAIN_TREASURY_ADDRESS`: the platform fee recipient wallet address.
- `NEXT_PUBLIC_USDC_ADDRESS`: Circle Base Sepolia USDC, `0x036CbD53842c5426634e7929541eC2318f3dCF7e`.
- `NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS`: produced by the deployment command below.
- `CRON_SECRET`: create a long random secret and store the same value in Vercel/Supabase scheduler headers as `Authorization: Bearer <value>` for cron endpoints.

## Test Funds

- Operator wallet needs Base Sepolia ETH for gas.
- Buyer test wallet needs Base Sepolia ETH for gas and Base Sepolia USDC for purchases.
- Coinbase Developer Platform Faucet can fund Base Sepolia ETH and test USDC.

## Deploy Escrow

From the project worktree:

```bash
cd smart-contracts
npm run deploy:base-sepolia
```

Copy the printed `NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS=...` value into `.env.local`.

## Apply Database Migrations

Apply the new migrations to the target Supabase project:

```bash
supabase db push --workdir .
```

If the Supabase CLI is unavailable locally, apply these files through your normal Supabase migration workflow:

- `supabase/migrations/010_onchain_payments.sql`
- `supabase/migrations/011_onchain_order_item_amounts.sql`

## End-To-End Smoke Test

1. Sign in as a photographer.
2. Open Dashboard Settings and save a Base wallet address.
3. Upload a photo.
4. Sign in as admin and approve the photo. Approval should register proof on Base.
5. Sign in as a buyer with Base Sepolia ETH and USDC.
6. Add the approved image to cart.
7. Checkout with `USDC on Base`.
8. Confirm the order appears in dashboard orders and download is available.
9. Sign in as the photographer and claim USDC from earnings.
