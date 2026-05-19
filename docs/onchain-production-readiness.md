# Onchain Production Readiness

This checklist tracks the remaining work to take Base USDC payments from testnet MVP to production operation.

See `docs/onchain-production-risk-register.md` for the operating risk register and `docs/onchain-production-next-batches.md` for the staged development batches and parallel agent ownership.

## Ready Without External Credentials

- [x] Add admin onchain operations stats for proof registration, Base payment state, and claimable USDC.
- [x] Add buyer, photographer, and admin dashboard surfaces for onchain payment/proof/claim state.
- [x] Document production operating risks and follow-up development targets.
- [x] Break down remaining production work into staged batches with parallel agent ownership.
- [x] Gate Base checkout confirmation with buyer session or per-order confirmation token.
- [x] Add an admin onchain reconciliation view for pending, stale, and failed Base orders.
- [x] Add an admin retry tool for failed proof registration after operator/RPC issues are fixed.
- [x] Add an admin reconciliation view that compares pending Base orders against transaction hashes submitted by operators.
- [x] Add a cron reconciliation endpoint for stale `base_usdc` pending orders.
- [x] Add `checkout/confirm` rate limiting and backoff for repeated Base confirmation attempts.
- [x] Add order-level static USDC/KRW quote snapshot and quote expiry handling.
- [x] Add admin DB/contract claimable reconciliation for photographer escrow balances.
- [x] Add buyer order history UI that exposes Base tx hash, token address, and contract order id.
- [x] Add buyer order history recovery UI for retrying pending Base USDC confirmation with a tx hash.
- [x] Add photographer-facing claim history filters for `claimable` and `claimed` USDC rows.
- [x] Add buyer-facing copy for Base USDC checkout risks: wallet network, approval, purchase, confirmation, and retry behavior.
- [ ] Add analytics events for Base checkout prepare, approval, purchase tx, confirm success, and confirm failure.

## Needs Testnet Deployment

- [ ] Deploy `ImagePartnersEscrow` to Base Sepolia.
- [ ] Store `NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS` in the app environment.
- [ ] Store `CRON_SECRET` in production and scheduler configuration before enabling cron endpoints.
- [ ] Apply Supabase migrations `010` through `014` to the target project.
- [ ] Run an end-to-end Base Sepolia purchase with a photographer wallet and buyer wallet.
- [ ] Run an end-to-end Base Sepolia photographer claim.
- [ ] Confirm admin image approval fails safely when proof registration fails.
- [ ] Confirm a pending Base order can be retried after a wallet approval succeeds but purchase fails.

## Needs Production Decisions

- [ ] Decide the production chain launch date and whether Base mainnet launches behind `NEXT_PUBLIC_ONCHAIN_ENABLED`.
- [ ] Choose production RPC provider and rate limit budget.
- [ ] Decide operator wallet custody: hot wallet, multisig-controlled operational wallet, or managed signer.
- [ ] Decide treasury wallet custody and withdrawal process.
- [ ] Decide production USDC/KRW quote source instead of static `ONCHAIN_USDC_PER_KRW`.
- [ ] Decide VAT/tax handling for crypto checkout before mainnet, because the MVP currently settles only license proceeds onchain.
- [ ] Decide legal copy for onchain license proof, refunds, failed transaction handling, and payout timing.
- [ ] Decide whether smart contract audit is required before mainnet.

## User Action Items

- Create a testnet-only operator wallet and fund it with Base Sepolia ETH.
- Create or choose a treasury wallet for platform fees.
- Create a buyer test wallet with Base Sepolia ETH and Base Sepolia USDC.
- Create a long random `CRON_SECRET` value and configure the same bearer token in the cron scheduler.
- Fill the worktree environment file at `/Users/simini/Documents/Imgptns/imageptns/.worktrees/base-usdc-onchain-payments/.env.local`.
- After the escrow deployment prints the contract address, add it as `NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS`.
