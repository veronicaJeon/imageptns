# Base USDC Onchain Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Base USDC checkout, onchain photo proof registration, and escrow-based photographer claiming while preserving the existing Toss checkout path.

**Architecture:** Keep Supabase as the product database and entitlement system, and use Base as the proof and settlement layer. Add a Solidity escrow contract, server-side transaction verification, admin proof registration, and a second checkout path that completes the existing `orders` flow only after verified onchain payment.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, Solidity, Hardhat, OpenZeppelin, viem, wagmi, Base Sepolia/Base, USDC.

---

## File Structure

- Create `smart-contracts/contracts/ImagePartnersEscrow.sol`: escrow contract for asset proof, USDC purchase allocation, treasury balance, and photographer claims.
- Create `smart-contracts/test/ImagePartnersEscrow.test.ts`: Hardhat tests for registration, purchase, duplicate protection, and claim.
- Create `smart-contracts/hardhat.config.ts`: Solidity compiler and test config.
- Create `smart-contracts/package.json`: contract workspace scripts and dependencies.
- Create `smart-contracts/contracts/test/MockUSDC.sol`: ERC20 test token for local contract tests.
- Create `supabase/migrations/010_onchain_payments.sql`: schema extension for image proof, Base USDC orders, claim tracking, wallet addresses, and uniqueness constraints.
- Create `src/lib/onchain/chains.ts`: Base chain ids, explorer URLs, token decimals, and USDC config.
- Create `src/lib/onchain/env.ts`: server and public environment parsing with explicit errors.
- Create `src/lib/onchain/amounts.ts`: KRW-to-USDC placeholder conversion boundary and USDC unit conversion.
- Create `src/lib/onchain/ids.ts`: stable `bytes32` id helpers for image assets and orders.
- Create `src/lib/onchain/abi.ts`: escrow ABI used by server and client.
- Create `src/lib/onchain/server.ts`: viem public wallet clients for server proof registration and transaction verification.
- Create `src/lib/onchain/proof.ts`: canonical content hash generation for images.
- Create `src/app/api/onchain/checkout/prepare/route.ts`: pending Base USDC order creation with server-side price validation.
- Create `src/app/api/onchain/checkout/confirm/route.ts`: transaction receipt and event verification, then order completion.
- Create `src/app/api/onchain/claim/confirm/route.ts`: claim transaction verification and ledger update.
- Modify `src/app/api/admin/images/[id]/review/route.ts`: approve only after successful proof registration, and return proof fields.
- Modify `src/app/api/admin/images/route.ts`: include proof status and tx hash in admin list.
- Modify `src/app/(admin)/admin/page.tsx`: show proof status and retryable approval failure messages.
- Modify `src/app/(public)/checkout/page.tsx`: add Toss/Base USDC segmented payment choice and Base payment flow.
- Modify `src/app/(dashboard)/dashboard/earnings/page.tsx`: show onchain claimable amount and claim action.
- Modify `src/app/api/earnings/route.ts`: return onchain settlement fields.
- Modify `src/app/api/orders/route.ts`: expose payment provider and tx hash for order history.
- Modify `.env.example`: document Base RPC, escrow address, USDC address, operator key, treasury address, chain id, and exchange-rate inputs.
- Modify `package.json`: add app dependencies and test scripts.

## Task 1: Add Onchain Dependencies And Environment Contract

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/lib/onchain/chains.ts`
- Create: `src/lib/onchain/env.ts`
- Create: `src/lib/onchain/abi.ts`

- [ ] **Step 1: Add app dependencies**

Run:

```bash
npm install viem wagmi @tanstack/react-query
```

Expected: `package.json` includes `viem`, `wagmi`, and `@tanstack/react-query`.

- [ ] **Step 2: Add environment keys to `.env.example`**

Append this block to `.env.example`:

```dotenv

# ── Base USDC Onchain Payments ─────────────────
# Start with Base Sepolia. Switch values for Base mainnet after testnet verification.
NEXT_PUBLIC_ONCHAIN_ENABLED=false
NEXT_PUBLIC_BASE_CHAIN_ID=84532
NEXT_PUBLIC_BASE_EXPLORER_URL=https://sepolia.basescan.org
NEXT_PUBLIC_USDC_ADDRESS=0x0000000000000000000000000000000000000000
NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS=0x0000000000000000000000000000000000000000
BASE_RPC_URL=
ONCHAIN_OPERATOR_PRIVATE_KEY=
ONCHAIN_TREASURY_ADDRESS=0x0000000000000000000000000000000000000000
ONCHAIN_PLATFORM_FEE_BPS=2000
# MVP fixed quote boundary. Replace with a live quote provider in a later pricing task.
ONCHAIN_USDC_PER_KRW=0.00075
```

- [ ] **Step 3: Create chain constants**

Create `src/lib/onchain/chains.ts`:

```ts
import type { Address } from "viem";

export const BASE_MAINNET_CHAIN_ID = 8453;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const USDC_DECIMALS = 6;

export interface OnchainPublicConfig {
  enabled: boolean;
  chainId: number;
  explorerUrl: string;
  usdcAddress: Address;
  escrowAddress: Address;
}

export function isBaseChain(chainId: number) {
  return chainId === BASE_MAINNET_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID;
}
```

- [ ] **Step 4: Create environment parser**

Create `src/lib/onchain/env.ts`:

```ts
import type { Address, Hex } from "viem";
import { getAddress, isAddress } from "viem";
import type { OnchainPublicConfig } from "./chains";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalAddress(name: string): Address {
  const value = required(name);
  if (!isAddress(value)) throw new Error(`${name} must be an EVM address`);
  return getAddress(value);
}

export function getOnchainPublicConfig(): OnchainPublicConfig {
  const enabled = process.env.NEXT_PUBLIC_ONCHAIN_ENABLED === "true";
  return {
    enabled,
    chainId: Number(process.env.NEXT_PUBLIC_BASE_CHAIN_ID ?? "84532"),
    explorerUrl: process.env.NEXT_PUBLIC_BASE_EXPLORER_URL ?? "https://sepolia.basescan.org",
    usdcAddress: optionalAddress("NEXT_PUBLIC_USDC_ADDRESS"),
    escrowAddress: optionalAddress("NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS"),
  };
}

export function getOnchainServerConfig() {
  return {
    ...getOnchainPublicConfig(),
    rpcUrl: required("BASE_RPC_URL"),
    operatorPrivateKey: required("ONCHAIN_OPERATOR_PRIVATE_KEY") as Hex,
    treasuryAddress: optionalAddress("ONCHAIN_TREASURY_ADDRESS"),
    platformFeeBps: Number(process.env.ONCHAIN_PLATFORM_FEE_BPS ?? "2000"),
    usdcPerKrw: Number(process.env.ONCHAIN_USDC_PER_KRW ?? "0.00075"),
  };
}
```

- [ ] **Step 5: Create escrow ABI file**

Create `src/lib/onchain/abi.ts`:

```ts
export const IMAGE_PARTNERS_ESCROW_ABI = [
  {
    type: "function",
    name: "registerAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "photographer", type: "address" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "purchase",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "assetIds", type: "bytes32[]" },
      { name: "photographers", type: "address[]" },
      { name: "grossAmounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "event",
    name: "AssetRegistered",
    inputs: [
      { name: "assetId", type: "bytes32", indexed: true },
      { name: "contentHash", type: "bytes32", indexed: true },
      { name: "photographer", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PurchaseCompleted",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "photographer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
```

- [ ] **Step 6: Run lint**

Run:

```bash
npm run lint
```

Expected: lint completes without errors from the new files.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .env.example src/lib/onchain/chains.ts src/lib/onchain/env.ts src/lib/onchain/abi.ts
git commit -m "feat: add onchain payment configuration"
```

## Task 2: Add Database Migration For Onchain State

**Files:**
- Create: `supabase/migrations/010_onchain_payments.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/010_onchain_payments.sql`:

```sql
-- IMAGE PARTNERS - Base USDC onchain payments

alter table public.profiles
  add column if not exists wallet_address text;

alter table public.images
  add column if not exists chain_id integer,
  add column if not exists onchain_asset_id text,
  add column if not exists content_hash text,
  add column if not exists proof_tx_hash text,
  add column if not exists proof_status text not null default 'not_registered',
  add column if not exists proof_registered_at timestamptz;

alter table public.images
  drop constraint if exists images_proof_status_check;

alter table public.images
  add constraint images_proof_status_check
  check (proof_status in ('not_registered','pending','registered','failed'));

create unique index if not exists images_onchain_asset_id_idx
  on public.images(onchain_asset_id)
  where onchain_asset_id is not null;

alter table public.orders
  add column if not exists payment_provider text not null default 'toss',
  add column if not exists chain_id integer,
  add column if not exists payment_token text,
  add column if not exists payment_tx_hash text,
  add column if not exists contract_order_id text,
  add column if not exists crypto_amount numeric,
  add column if not exists crypto_decimals integer,
  add column if not exists crypto_status text not null default 'not_applicable',
  add column if not exists buyer_wallet_address text;

alter table public.orders
  drop constraint if exists orders_payment_provider_check,
  drop constraint if exists orders_crypto_status_check;

alter table public.orders
  add constraint orders_payment_provider_check
  check (payment_provider in ('toss','base_usdc'));

alter table public.orders
  add constraint orders_crypto_status_check
  check (crypto_status in ('not_applicable','pending','confirmed','failed'));

create unique index if not exists orders_payment_tx_hash_idx
  on public.orders(payment_tx_hash)
  where payment_tx_hash is not null;

create unique index if not exists orders_contract_order_id_idx
  on public.orders(contract_order_id)
  where contract_order_id is not null;

alter table public.earnings_ledger
  add column if not exists settlement_provider text not null default 'offchain',
  add column if not exists claim_status text not null default 'not_applicable',
  add column if not exists claim_tx_hash text,
  add column if not exists claimable_amount numeric;

alter table public.earnings_ledger
  drop constraint if exists earnings_settlement_provider_check,
  drop constraint if exists earnings_claim_status_check;

alter table public.earnings_ledger
  add constraint earnings_settlement_provider_check
  check (settlement_provider in ('offchain','onchain_escrow'));

alter table public.earnings_ledger
  add constraint earnings_claim_status_check
  check (claim_status in ('not_applicable','claimable','claimed'));

create index if not exists earnings_claim_status_idx
  on public.earnings_ledger(claim_status);
```

- [ ] **Step 2: Verify migration syntax locally**

Run:

```bash
supabase db reset --workdir .
```

Expected: migrations apply without SQL errors. If Supabase CLI is unavailable, run:

```bash
npm run lint
```

Expected fallback: app lint still passes, and the SQL file is reviewed manually before deployment.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/010_onchain_payments.sql
git commit -m "feat: add onchain payment schema"
```

## Task 3: Build And Test The Escrow Contract

**Files:**
- Create: `smart-contracts/package.json`
- Create: `smart-contracts/hardhat.config.ts`
- Create: `smart-contracts/contracts/ImagePartnersEscrow.sol`
- Create: `smart-contracts/contracts/test/MockUSDC.sol`
- Create: `smart-contracts/test/ImagePartnersEscrow.test.ts`

- [ ] **Step 1: Create contract workspace**

Create `smart-contracts/package.json`:

```json
{
  "name": "imageptns-smart-contracts",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "test": "hardhat test",
    "compile": "hardhat compile"
  },
  "devDependencies": {
    "@nomicfoundation/hardhat-toolbox": "^6.0.0",
    "@openzeppelin/contracts": "^5.0.2",
    "hardhat": "^2.22.19",
    "typescript": "^5.8.3"
  }
}
```

Run:

```bash
cd smart-contracts && npm install
```

Expected: `smart-contracts/package-lock.json` is created.

- [ ] **Step 2: Create Hardhat config**

Create `smart-contracts/hardhat.config.ts`:

```ts
import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
};

export default config;
```

- [ ] **Step 3: Write failing contract tests**

Create `smart-contracts/test/ImagePartnersEscrow.test.ts`:

```ts
import { expect } from "chai";
import { ethers } from "hardhat";

describe("ImagePartnersEscrow", function () {
  async function deployFixture() {
    const [owner, operator, treasury, buyer, photographer, other] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    const usdc = await MockUSDC.deploy();

    const Escrow = await ethers.getContractFactory("ImagePartnersEscrow");
    const escrow = await Escrow.deploy(await usdc.getAddress(), treasury.address, 2000);
    await escrow.setOperator(operator.address, true);

    await usdc.mint(buyer.address, 1_000_000_000n);

    return { owner, operator, treasury, buyer, photographer, other, usdc, escrow };
  }

  it("registers an asset by an authorized operator", async function () {
    const { operator, photographer, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const contentHash = ethers.id("content");

    await expect(
      escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata")
    ).to.emit(escrow, "AssetRegistered").withArgs(assetId, contentHash, photographer.address, "ipfs://metadata");
  });

  it("rejects duplicate asset registration", async function () {
    const { operator, photographer, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const contentHash = ethers.id("content");

    await escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata");

    await expect(
      escrow.connect(operator).registerAsset(assetId, contentHash, photographer.address, "ipfs://metadata")
    ).to.be.revertedWithCustomError(escrow, "AssetAlreadyRegistered");
  });

  it("allocates purchase funds to treasury and photographer claim balance", async function () {
    const { operator, treasury, buyer, photographer, usdc, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const orderId = ethers.id("ORD-000001");
    const grossAmount = 100_000_000n;

    await escrow.connect(operator).registerAsset(assetId, ethers.id("content"), photographer.address, "ipfs://metadata");
    await usdc.connect(buyer).approve(await escrow.getAddress(), grossAmount);

    await expect(
      escrow.connect(buyer).purchase(orderId, [assetId], [photographer.address], [grossAmount])
    ).to.emit(escrow, "PurchaseCompleted").withArgs(orderId, buyer.address, grossAmount, 20_000_000n);

    expect(await usdc.balanceOf(treasury.address)).to.equal(20_000_000n);
    expect(await escrow.claimable(photographer.address)).to.equal(80_000_000n);
  });

  it("lets photographers claim their balance", async function () {
    const { operator, buyer, photographer, usdc, escrow } = await deployFixture();
    const assetId = ethers.id("IP-00001");
    const orderId = ethers.id("ORD-000001");
    const grossAmount = 100_000_000n;

    await escrow.connect(operator).registerAsset(assetId, ethers.id("content"), photographer.address, "ipfs://metadata");
    await usdc.connect(buyer).approve(await escrow.getAddress(), grossAmount);
    await escrow.connect(buyer).purchase(orderId, [assetId], [photographer.address], [grossAmount]);

    await expect(escrow.connect(photographer).claim())
      .to.emit(escrow, "Claimed")
      .withArgs(photographer.address, 80_000_000n);

    expect(await usdc.balanceOf(photographer.address)).to.equal(80_000_000n);
    expect(await escrow.claimable(photographer.address)).to.equal(0n);
  });
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```bash
cd smart-contracts && npm test
```

Expected: fail because `MockUSDC.sol` and `ImagePartnersEscrow.sol` do not exist yet.

- [ ] **Step 5: Create mock USDC**

Create `smart-contracts/contracts/test/MockUSDC.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

- [ ] **Step 6: Create escrow contract**

Create `smart-contracts/contracts/ImagePartnersEscrow.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ImagePartnersEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error AssetAlreadyRegistered();
    error AssetNotRegistered();
    error InvalidAddress();
    error InvalidArrayLength();
    error InvalidAmount();
    error NotOperator();
    error NothingToClaim();
    error OrderAlreadyPurchased();

    struct Asset {
        bytes32 contentHash;
        address photographer;
        string metadataURI;
        bool registered;
    }

    IERC20 public immutable usdc;
    address public treasury;
    uint16 public platformFeeBps;

    mapping(address => bool) public operators;
    mapping(bytes32 => Asset) public assets;
    mapping(bytes32 => bool) public purchasedOrders;
    mapping(address => uint256) public claimable;

    event AssetRegistered(bytes32 indexed assetId, bytes32 indexed contentHash, address indexed photographer, string metadataURI);
    event PurchaseCompleted(bytes32 indexed orderId, address indexed buyer, uint256 grossAmount, uint256 platformFee);
    event Claimed(address indexed photographer, uint256 amount);
    event OperatorSet(address indexed operator, bool allowed);
    event TreasurySet(address indexed treasury);
    event PlatformFeeSet(uint16 feeBps);

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) revert NotOperator();
        _;
    }

    constructor(address usdc_, address treasury_, uint16 platformFeeBps_) Ownable(msg.sender) {
        if (usdc_ == address(0) || treasury_ == address(0)) revert InvalidAddress();
        if (platformFeeBps_ > 10_000) revert InvalidAmount();
        usdc = IERC20(usdc_);
        treasury = treasury_;
        platformFeeBps = platformFeeBps_;
    }

    function setOperator(address operator, bool allowed) external onlyOwner {
        if (operator == address(0)) revert InvalidAddress();
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert InvalidAddress();
        treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function setPlatformFeeBps(uint16 feeBps) external onlyOwner {
        if (feeBps > 10_000) revert InvalidAmount();
        platformFeeBps = feeBps;
        emit PlatformFeeSet(feeBps);
    }

    function registerAsset(bytes32 assetId, bytes32 contentHash, address photographer, string calldata metadataURI) external onlyOperator {
        if (assetId == bytes32(0) || contentHash == bytes32(0) || photographer == address(0)) revert InvalidAddress();
        if (assets[assetId].registered) revert AssetAlreadyRegistered();

        assets[assetId] = Asset({
            contentHash: contentHash,
            photographer: photographer,
            metadataURI: metadataURI,
            registered: true
        });

        emit AssetRegistered(assetId, contentHash, photographer, metadataURI);
    }

    function purchase(
        bytes32 orderId,
        bytes32[] calldata assetIds,
        address[] calldata photographers,
        uint256[] calldata grossAmounts
    ) external nonReentrant {
        if (orderId == bytes32(0)) revert InvalidAddress();
        if (purchasedOrders[orderId]) revert OrderAlreadyPurchased();
        if (assetIds.length == 0 || assetIds.length != photographers.length || assetIds.length != grossAmounts.length) {
            revert InvalidArrayLength();
        }

        purchasedOrders[orderId] = true;

        uint256 totalGross;
        uint256 totalFee;

        for (uint256 i = 0; i < assetIds.length; i++) {
            Asset memory asset = assets[assetIds[i]];
            if (!asset.registered) revert AssetNotRegistered();
            if (asset.photographer != photographers[i]) revert InvalidAddress();
            if (grossAmounts[i] == 0) revert InvalidAmount();

            uint256 fee = (grossAmounts[i] * platformFeeBps) / 10_000;
            uint256 photographerAmount = grossAmounts[i] - fee;
            claimable[photographers[i]] += photographerAmount;
            totalGross += grossAmounts[i];
            totalFee += fee;
        }

        usdc.safeTransferFrom(msg.sender, address(this), totalGross);
        if (totalFee > 0) usdc.safeTransfer(treasury, totalFee);

        emit PurchaseCompleted(orderId, msg.sender, totalGross, totalFee);
    }

    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();

        claimable[msg.sender] = 0;
        usdc.safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, amount);
    }
}
```

- [ ] **Step 7: Run contract tests**

Run:

```bash
cd smart-contracts && npm test
```

Expected: all contract tests pass.

- [ ] **Step 8: Commit**

```bash
git add smart-contracts
git commit -m "feat: add Base USDC escrow contract"
```

## Task 4: Add Onchain Utility Functions

**Files:**
- Create: `src/lib/onchain/amounts.ts`
- Create: `src/lib/onchain/ids.ts`
- Create: `src/lib/onchain/proof.ts`
- Create: `src/lib/onchain/server.ts`

- [ ] **Step 1: Create amount helpers**

Create `src/lib/onchain/amounts.ts`:

```ts
import { parseUnits } from "viem";
import { USDC_DECIMALS } from "./chains";

export function krwToUsdcAmount(krw: number, usdcPerKrw: number): bigint {
  if (!Number.isFinite(krw) || krw <= 0) throw new Error("KRW amount must be positive");
  if (!Number.isFinite(usdcPerKrw) || usdcPerKrw <= 0) throw new Error("USDC quote must be positive");
  const usdc = krw * usdcPerKrw;
  return parseUnits(usdc.toFixed(USDC_DECIMALS), USDC_DECIMALS);
}

export function bigintToDecimalString(value: bigint, decimals = USDC_DECIMALS): string {
  const raw = value.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals);
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}
```

- [ ] **Step 2: Create id helpers**

Create `src/lib/onchain/ids.ts`:

```ts
import { keccak256, stringToHex, type Hex } from "viem";

export function imageAssetBytes32(assetId: string): Hex {
  if (!assetId.trim()) throw new Error("assetId is required");
  return keccak256(stringToHex(`imageptns:image:${assetId}`));
}

export function orderBytes32(orderId: string): Hex {
  if (!orderId.trim()) throw new Error("orderId is required");
  return keccak256(stringToHex(`imageptns:order:${orderId}`));
}
```

- [ ] **Step 3: Create proof hash helper**

Create `src/lib/onchain/proof.ts`:

```ts
import { createHash } from "crypto";
import { keccak256, stringToHex, type Hex } from "viem";

export interface ImageProofInput {
  assetId: string;
  photographerId: string;
  title: string;
  storagePathOriginal: string;
  originalFileSha256: string;
}

export function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function canonicalImageProofHash(input: ImageProofInput): Hex {
  const payload = JSON.stringify({
    assetId: input.assetId,
    photographerId: input.photographerId,
    storagePathOriginal: input.storagePathOriginal,
    title: input.title,
    originalFileSha256: input.originalFileSha256,
  });
  return keccak256(stringToHex(payload));
}
```

- [ ] **Step 4: Create server clients**

Create `src/lib/onchain/server.ts`:

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import { getOnchainServerConfig } from "./env";

export function getConfiguredChain(chainId: number) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  throw new Error(`Unsupported Base chain id: ${chainId}`);
}

export function getOnchainPublicClient() {
  const config = getOnchainServerConfig();
  return createPublicClient({
    chain: getConfiguredChain(config.chainId),
    transport: http(config.rpcUrl),
  });
}

export function getOnchainOperatorClient() {
  const config = getOnchainServerConfig();
  const account = privateKeyToAccount(config.operatorPrivateKey);
  return createWalletClient({
    account,
    chain: getConfiguredChain(config.chainId),
    transport: http(config.rpcUrl),
  });
}
```

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/onchain/amounts.ts src/lib/onchain/ids.ts src/lib/onchain/proof.ts src/lib/onchain/server.ts
git commit -m "feat: add onchain utility helpers"
```

## Task 5: Register Image Proof During Admin Approval

**Files:**
- Modify: `src/app/api/admin/images/[id]/review/route.ts`
- Modify: `src/app/api/admin/images/route.ts`
- Modify: `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: Update admin image list query**

In `src/app/api/admin/images/route.ts`, add proof fields to the select:

```ts
id, asset_id, title, description, category, tags,
status, rejection_reason,
chain_id, onchain_asset_id, content_hash, proof_tx_hash, proof_status, proof_registered_at,
storage_path_preview, storage_path_original,
width, height, resolution_mp, file_format, file_size_mb,
views_count, sales_count, created_at, approved_at,
photographer:profiles!photographer_id(id, full_name, avatar_url, wallet_address)
```

- [ ] **Step 2: Implement proof registration in review route**

In `src/app/api/admin/images/[id]/review/route.ts`, add imports:

```ts
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { imageAssetBytes32 } from "@/lib/onchain/ids";
import { canonicalImageProofHash, sha256Buffer } from "@/lib/onchain/proof";
import { getOnchainOperatorClient, getOnchainPublicClient } from "@/lib/onchain/server";
```

Replace the approve branch with this flow:

```ts
const existingRes = await admin
  .from("images")
  .select("id, asset_id, title, storage_path_original, photographer_id, photographer:profiles!photographer_id(wallet_address)")
  .eq("id", id)
  .single();

if (existingRes.error || !existingRes.data) {
  return NextResponse.json({ error: existingRes.error?.message ?? "Image not found" }, { status: 404 });
}

if (action === "approve") {
  const image = existingRes.data as any;
  const walletAddress = image.photographer?.wallet_address;
  if (!walletAddress) {
    return NextResponse.json({ error: "Photographer wallet address is required before onchain approval" }, { status: 400 });
  }

  const config = getOnchainServerConfig();
  const downloaded = await admin.storage.from("images-original").download(image.storage_path_original);
  if (downloaded.error || !downloaded.data) {
    return NextResponse.json({ error: downloaded.error?.message ?? "Original image download failed" }, { status: 500 });
  }

  const originalFileSha256 = sha256Buffer(Buffer.from(await downloaded.data.arrayBuffer()));
  const contentHash = canonicalImageProofHash({
    assetId: image.asset_id,
    photographerId: image.photographer_id,
    title: image.title,
    storagePathOriginal: image.storage_path_original,
    originalFileSha256,
  });
  const onchainAssetId = imageAssetBytes32(image.asset_id);

  await admin
    .from("images")
    .update({ proof_status: "pending", content_hash: contentHash, onchain_asset_id: onchainAssetId, chain_id: config.chainId })
    .eq("id", id);

  const walletClient = getOnchainOperatorClient();
  const publicClient = getOnchainPublicClient();
  const txHash = await walletClient.writeContract({
    address: config.escrowAddress,
    abi: IMAGE_PARTNERS_ESCROW_ABI,
    functionName: "registerAsset",
    args: [onchainAssetId, contentHash, walletAddress, `imageptns://${image.asset_id}`],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    await admin.from("images").update({ proof_status: "failed", proof_tx_hash: txHash }).eq("id", id);
    return NextResponse.json({ error: "Onchain proof registration failed" }, { status: 502 });
  }
}
```

Then set the approve update object to:

```ts
{
  status: "approved",
  approved_at: new Date().toISOString(),
  rejection_reason: null,
  proof_status: "registered",
  proof_registered_at: new Date().toISOString(),
}
```

- [ ] **Step 3: Add proof status to admin page interface**

In `src/app/(admin)/admin/page.tsx`, add fields to `ImageRow`:

```ts
proof_status: string | null;
proof_tx_hash: string | null;
onchain_asset_id: string | null;
chain_id: number | null;
photographer: { id: string; full_name: string; avatar_url: string | null; wallet_address?: string | null } | null;
```

- [ ] **Step 4: Render proof status in admin image cards**

Add this block below the status pill:

```tsx
{img.proof_status && img.proof_status !== "not_registered" && (
  <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-surface-container-low text-on-surface-variant">
    Base proof: {img.proof_status}
  </span>
)}
```

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/images/[id]/review/route.ts src/app/api/admin/images/route.ts src/app/'(admin)'/admin/page.tsx
git commit -m "feat: register image proof on approval"
```

## Task 6: Add Base USDC Order Prepare And Confirm APIs

**Files:**
- Create: `src/app/api/onchain/checkout/prepare/route.ts`
- Create: `src/app/api/onchain/checkout/confirm/route.ts`

- [ ] **Step 1: Create prepare route**

Create `src/app/api/onchain/checkout/prepare/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { krwToUsdcAmount, bigintToDecimalString } from "@/lib/onchain/amounts";
import { imageAssetBytes32, orderBytes32 } from "@/lib/onchain/ids";
import { randomUUID } from "crypto";

interface CartItemInput {
  id: string;
  license: string;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, billing, buyerWalletAddress }: {
    items: CartItemInput[];
    billing: { name: string; email: string; company?: string };
    buyerWalletAddress: string;
  } = await req.json();

  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });
  if (!buyerWalletAddress) return NextResponse.json({ error: "buyerWalletAddress required" }, { status: 400 });

  const config = getOnchainServerConfig();
  const licenseCodes = [...new Set(items.map((item) => item.license))];
  const imageIds = items.map((item) => item.id);

  const [{ data: licenses, error: licenseError }, { data: images, error: imageError }] = await Promise.all([
    supabase.from("license_types").select("code, price_krw").in("code", licenseCodes),
    supabase
      .from("images")
      .select("id, asset_id, photographer_id, onchain_asset_id, proof_status, photographer:profiles!photographer_id(wallet_address)")
      .in("id", imageIds)
      .eq("status", "approved"),
  ]);

  if (licenseError) return NextResponse.json({ error: licenseError.message }, { status: 500 });
  if (imageError) return NextResponse.json({ error: imageError.message }, { status: 500 });

  const licenseMap = new Map((licenses ?? []).map((license: any) => [license.code, license.price_krw]));
  const imageMap = new Map((images ?? []).map((image: any) => [image.id, image]));
  const tossOrderId = randomUUID();
  const contractOrderId = orderBytes32(tossOrderId);

  const orderItems = [];
  let subtotal = 0;

  for (const item of items) {
    const image = imageMap.get(item.id);
    const price = licenseMap.get(item.license);
    if (!image || image.proof_status !== "registered" || !image.onchain_asset_id) {
      return NextResponse.json({ error: "All images must be approved and registered onchain" }, { status: 400 });
    }
    if (!image.photographer?.wallet_address) {
      return NextResponse.json({ error: "Photographer wallet missing" }, { status: 400 });
    }
    if (!price) return NextResponse.json({ error: `Invalid license: ${item.license}` }, { status: 400 });

    const commission = Math.round(price * 0.2);
    subtotal += price;
    orderItems.push({
      image_id: item.id,
      license_code: item.license,
      price_krw: price,
      photographer_id: image.photographer_id,
      gross_krw: price,
      commission_rate: 0.2,
      commission_krw: commission,
      net_krw: price - commission,
    });
  }

  const vat = Math.round(subtotal * 0.1);
  const total = subtotal + vat;
  const cryptoAmount = krwToUsdcAmount(total, config.usdcPerKrw);

  const { data: order, error: orderError } = await supabase.from("orders").insert({
    buyer_id: user.id,
    subtotal_krw: subtotal,
    vat_krw: vat,
    total_krw: total,
    billing_name: billing.name,
    billing_email: billing.email,
    billing_company: billing.company ?? null,
    toss_order_id: tossOrderId,
    status: "pending",
    payment_provider: "base_usdc",
    chain_id: config.chainId,
    payment_token: config.usdcAddress,
    contract_order_id: contractOrderId,
    crypto_amount: bigintToDecimalString(cryptoAmount),
    crypto_decimals: 6,
    crypto_status: "pending",
    buyer_wallet_address: buyerWalletAddress,
  }).select().single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  const { error: itemsError } = await supabase
    .from("order_items")
    .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });

  return NextResponse.json({
    orderDbId: order.id,
    contractOrderId,
    chainId: config.chainId,
    usdcAddress: config.usdcAddress,
    escrowAddress: config.escrowAddress,
    cryptoAmount: cryptoAmount.toString(),
    assetIds: items.map((item) => imageAssetBytes32(imageMap.get(item.id).asset_id)),
    photographers: items.map((item) => imageMap.get(item.id).photographer.wallet_address),
    grossAmounts: items.map((item) => krwToUsdcAmount(licenseMap.get(item.license), config.usdcPerKrw).toString()),
  });
}
```

- [ ] **Step 2: Create confirm route**

Create `src/app/api/onchain/checkout/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { decodeEventLog, getAddress, type Hex } from "viem";

export async function POST(req: NextRequest) {
  const { orderDbId, txHash } = await req.json() as { orderDbId: string; txHash: Hex };
  if (!orderDbId || !txHash) return NextResponse.json({ error: "orderDbId and txHash required" }, { status: 400 });

  const admin = createAdminClient();
  const config = getOnchainServerConfig();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, contract_order_id, buyer_wallet_address, status, crypto_amount")
    .eq("id", orderDbId)
    .eq("payment_provider", "base_usdc")
    .single();

  if (error || !order) return NextResponse.json({ error: error?.message ?? "Order not found" }, { status: 404 });
  if (order.status === "completed") return NextResponse.json({ orderNumber: order.order_number, alreadyCompleted: true });

  const publicClient = getOnchainPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return NextResponse.json({ error: "Transaction failed" }, { status: 400 });

  const decodedEvents = receipt.logs
    .filter((log) => getAddress(log.address) === config.escrowAddress)
    .map((log) => {
      try {
        return decodeEventLog({
          abi: IMAGE_PARTNERS_ESCROW_ABI,
          data: log.data,
          topics: log.topics,
        });
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const decoded = decodedEvents.find((event: any) => event.eventName === "PurchaseCompleted");
  if (!decoded) return NextResponse.json({ error: "PurchaseCompleted event missing" }, { status: 400 });

  const args = decoded.args as any;
  if (args.orderId !== order.contract_order_id) return NextResponse.json({ error: "Order id mismatch" }, { status: 400 });
  if (getAddress(args.buyer) !== getAddress(order.buyer_wallet_address)) return NextResponse.json({ error: "Buyer mismatch" }, { status: 400 });

  const { data: updated, error: updateError } = await admin
    .from("orders")
    .update({
      status: "completed",
      payment_tx_hash: txHash,
      crypto_status: "confirmed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", orderDbId)
    .eq("status", "pending")
    .select("id, order_number")
    .single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data: orderItems } = await admin
    .from("order_items")
    .select("id")
    .eq("order_id", orderDbId);

  const orderItemIds = (orderItems ?? []).map((item: any) => item.id);
  if (orderItemIds.length > 0) {
    await admin
      .from("earnings_ledger")
      .update({ settlement_provider: "onchain_escrow", claim_status: "claimable" })
      .in("order_item_id", orderItemIds);
  }

  return NextResponse.json({ orderNumber: updated.order_number });
}
```

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/onchain/checkout/prepare/route.ts src/app/api/onchain/checkout/confirm/route.ts
git commit -m "feat: add Base USDC checkout APIs"
```

## Task 7: Add Base USDC Checkout UI

**Files:**
- Modify: `src/app/(public)/checkout/page.tsx`

- [ ] **Step 1: Add wagmi imports**

Add imports:

```tsx
import { createConfig, http, WagmiProvider, useAccount, useConnect, useSwitchChain, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ERC20_ABI, IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
```

- [ ] **Step 2: Wrap checkout with providers**

Add module-level config:

```tsx
const queryClient = new QueryClient();
const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});
```

Change default export to:

```tsx
export default function CheckoutPage() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <CheckoutInner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function CheckoutInner() {
  // existing component body moves here
}
```

- [ ] **Step 3: Add payment method state**

Inside `CheckoutInner`, add:

```tsx
const [paymentMethod, setPaymentMethod] = useState<"toss" | "base_usdc">("toss");
const { address, chainId, isConnected } = useAccount();
const { connectAsync, connectors } = useConnect();
const { switchChainAsync } = useSwitchChain();
const { writeContractAsync } = useWriteContract();
```

- [ ] **Step 4: Add Base payment handler**

Add this function next to `handleSubmit`:

```tsx
async function handleBasePayment() {
  if (!billing.name || !billing.email) return;
  setLoading(true);
  try {
    const walletAddress = address ?? (await connectAsync({ connector: connectors[0] })).accounts[0];
    const prepRes = await fetch("/api/onchain/checkout/prepare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ id: i.id, license: i.license })),
        billing,
        buyerWalletAddress: walletAddress,
      }),
    });
    if (!prepRes.ok) throw new Error((await prepRes.json()).error ?? "주문 생성 실패");
    const prep = await prepRes.json();

    if (chainId !== prep.chainId) {
      await switchChainAsync({ chainId: prep.chainId });
    }

    await writeContractAsync({
      address: prep.usdcAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [prep.escrowAddress, BigInt(prep.cryptoAmount)],
    });

    const purchaseHash = await writeContractAsync({
      address: prep.escrowAddress,
      abi: IMAGE_PARTNERS_ESCROW_ABI,
      functionName: "purchase",
      args: [
        prep.contractOrderId,
        prep.assetIds,
        prep.photographers,
        prep.grossAmounts.map((amount: string) => BigInt(amount)),
      ],
    });

    const confirmRes = await fetch("/api/onchain/checkout/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderDbId: prep.orderDbId, txHash: purchaseHash }),
    });
    if (!confirmRes.ok) throw new Error((await confirmRes.json()).error ?? "온체인 결제 확인 실패");
    const { orderNumber } = await confirmRes.json();
    router.push(`/checkout/success?order=${orderNumber ?? ""}`);
  } catch (err) {
    console.error(err);
    alert((err as Error).message);
  } finally {
    setLoading(false);
  }
}
```

- [ ] **Step 5: Route submit based on payment method**

At the top of `handleSubmit`, add:

```tsx
if (paymentMethod === "base_usdc") {
  await handleBasePayment();
  return;
}
```

- [ ] **Step 6: Render payment method controls**

Above the Toss widget block, render:

```tsx
<div>
  <h2 className="text-xs font-bold text-outline uppercase tracking-widest mb-5">Payment Method</h2>
  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      onClick={() => setPaymentMethod("toss")}
      className={`h-12 rounded-lg border text-xs font-bold uppercase tracking-widest ${paymentMethod === "toss" ? "border-primary bg-primary text-white" : "border-outline-variant text-on-surface"}`}
    >
      Toss
    </button>
    <button
      type="button"
      onClick={() => setPaymentMethod("base_usdc")}
      className={`h-12 rounded-lg border text-xs font-bold uppercase tracking-widest ${paymentMethod === "base_usdc" ? "border-primary bg-primary text-white" : "border-outline-variant text-on-surface"}`}
    >
      USDC on Base
    </button>
  </div>
</div>
```

Wrap the existing Toss widget area with:

```tsx
{paymentMethod === "toss" && (
  <div>
    {/* existing Toss widget markup */}
  </div>
)}
```

- [ ] **Step 7: Update submit disabled state**

Change submit disabled to:

```tsx
disabled={loading || (paymentMethod === "toss" && !widgetReady)}
```

- [ ] **Step 8: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 9: Commit**

```bash
git add src/app/'(public)'/checkout/page.tsx
git commit -m "feat: add Base USDC checkout option"
```

## Task 8: Add Claim State To Earnings

**Files:**
- Modify: `src/app/api/earnings/route.ts`
- Create: `src/app/api/onchain/claim/confirm/route.ts`
- Modify: `src/app/(dashboard)/dashboard/earnings/page.tsx`

- [ ] **Step 1: Extend earnings API query**

In `src/app/api/earnings/route.ts`, include:

```ts
settlement_provider,
claim_status,
claim_tx_hash,
claimable_amount,
```

in the `earnings_ledger` select list.

- [ ] **Step 2: Add claim confirm route**

Create `src/app/api/onchain/claim/confirm/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOnchainPublicClient } from "@/lib/onchain/server";
import { getOnchainServerConfig } from "@/lib/onchain/env";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
import { decodeEventLog, getAddress, type Hex } from "viem";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { txHash, walletAddress } = await req.json() as { txHash: Hex; walletAddress: string };
  if (!txHash || !walletAddress) return NextResponse.json({ error: "txHash and walletAddress required" }, { status: 400 });

  const config = getOnchainServerConfig();
  const publicClient = getOnchainPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") return NextResponse.json({ error: "Claim transaction failed" }, { status: 400 });

  const claimLog = receipt.logs.find((log) => getAddress(log.address) === config.escrowAddress);
  if (!claimLog) return NextResponse.json({ error: "Claim event missing" }, { status: 400 });

  const decoded = decodeEventLog({
    abi: IMAGE_PARTNERS_ESCROW_ABI,
    data: claimLog.data,
    topics: claimLog.topics,
  });

  if (decoded.eventName !== "Claimed") return NextResponse.json({ error: "Claimed event missing" }, { status: 400 });
  const args = decoded.args as any;
  if (getAddress(args.photographer) !== getAddress(walletAddress)) return NextResponse.json({ error: "Photographer wallet mismatch" }, { status: 400 });

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ wallet_address: getAddress(walletAddress) })
    .eq("id", user.id);

  const { error } = await admin
    .from("earnings_ledger")
    .update({ claim_status: "claimed", claim_tx_hash: txHash })
    .eq("photographer_id", user.id)
    .eq("settlement_provider", "onchain_escrow")
    .eq("claim_status", "claimable");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Add claim wallet imports**

In `src/app/(dashboard)/dashboard/earnings/page.tsx`, add imports:

```tsx
import { createConfig, http, WagmiProvider, useAccount, useConnect, useWriteContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { base, baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IMAGE_PARTNERS_ESCROW_ABI } from "@/lib/onchain/abi";
```

- [ ] **Step 4: Wrap earnings page with wagmi providers**

Add module-level config:

```tsx
const earningsQueryClient = new QueryClient();
const earningsWagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});
```

Change the page export to:

```tsx
export default function EarningsPage() {
  return (
    <WagmiProvider config={earningsWagmiConfig}>
      <QueryClientProvider client={earningsQueryClient}>
        <EarningsInner />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function EarningsInner() {
  // existing component body moves here
}
```

- [ ] **Step 5: Add claim action state and handler**

Inside `EarningsInner`, add these hooks near the existing state:

```tsx
const { address } = useAccount();
const { connectAsync, connectors } = useConnect();
const { writeContractAsync } = useWriteContract();
const [claimingOnchain, setClaimingOnchain] = useState(false);
```

Add this function near `requestPayout`:

```tsx
async function claimOnchainUsdc() {
  setClaimingOnchain(true);
  try {
    const walletAddress = address ?? (await connectAsync({ connector: connectors[0] })).accounts[0];
    const escrowAddress = process.env.NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS as `0x${string}`;
    const txHash = await writeContractAsync({
      address: escrowAddress,
      abi: IMAGE_PARTNERS_ESCROW_ABI,
      functionName: "claim",
      args: [],
    });

    const res = await fetch("/api/onchain/claim/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ txHash, walletAddress }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? "USDC claim confirmation failed");

    const fresh = await fetch("/api/earnings").then((r) => r.json());
    setData(fresh);
  } catch (err) {
    console.error(err);
    alert((err as Error).message);
  } finally {
    setClaimingOnchain(false);
  }
}
```

- [ ] **Step 6: Render claimable onchain amount**

In `src/app/(dashboard)/dashboard/earnings/page.tsx`, compute claimable rows:

```tsx
const onchainClaimable = (data?.ledger ?? [])
  .filter((row: any) => row.settlement_provider === "onchain_escrow" && row.claim_status === "claimable")
  .reduce((sum: number, row: any) => sum + (Number(row.claimable_amount) || 0), 0);
```

Render above payout history:

```tsx
{onchainClaimable > 0 && (
  <div className="mb-8 p-5 bg-surface-container-lowest border border-primary/20 rounded-lg flex items-center justify-between gap-4">
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-primary">Base USDC Claim</p>
      <p className="text-sm text-on-surface-variant mt-1">You have claimable onchain USDC earnings.</p>
    </div>
    <button
      type="button"
      disabled={claimingOnchain}
      className="px-5 py-2.5 bg-primary text-white text-xs font-bold uppercase tracking-widest rounded disabled:opacity-50"
      onClick={claimOnchainUsdc}
    >
      {claimingOnchain ? "Claiming..." : "Claim USDC"}
    </button>
  </div>
)}
```

- [ ] **Step 7: Run lint**

Run:

```bash
npm run lint
```

Expected: lint passes.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/earnings/route.ts src/app/api/onchain/claim/confirm/route.ts src/app/'(dashboard)'/dashboard/earnings/page.tsx
git commit -m "feat: surface onchain claim state"
```

## Task 9: Final Integration Verification

**Files:**
- No new files required.

- [ ] **Step 1: Verify environment without printing secrets**

Run:

```bash
node -e "const fs=require('fs'); const s=fs.readFileSync('.env.local','utf8'); for (const k of ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','BASE_RPC_URL','ONCHAIN_OPERATOR_PRIVATE_KEY','NEXT_PUBLIC_USDC_ADDRESS','NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS']) { const v=(s.match(new RegExp('^'+k+'=(.*)$','m'))||[])[1]||''; console.log(k+': '+(v.trim() ? 'set' : 'empty')); }"
```

Expected: all listed values print `set` before end-to-end onchain testing.

- [ ] **Step 2: Run app lint**

Run:

```bash
npm run lint
```

Expected: no lint errors.

- [ ] **Step 3: Run contract tests**

Run:

```bash
cd smart-contracts && npm test
```

Expected: all contract tests pass.

- [ ] **Step 4: Build the app**

Run:

```bash
npm run build
```

Expected: Next.js production build completes.

- [ ] **Step 5: Start local app**

Run:

```bash
npm run dev
```

Expected: app starts at `http://localhost:3000`.

- [ ] **Step 6: Manual browser checks**

Open `http://localhost:3000` and verify:

- Login works with the configured Supabase project.
- `/checkout` renders both `Toss` and `USDC on Base` options.
- Selecting `USDC on Base` does not render the Toss widget.
- Admin image review page shows Base proof status after API data includes it.
- Earnings page renders without crashing for rows with and without onchain fields.

- [ ] **Step 7: Commit final fixes**

If verification required fixes, commit them:

```bash
git add .
git commit -m "fix: stabilize Base USDC integration"
```

Expected: working tree is clean except for `.env.local` and ignored local files.

## Self-Review

- Spec coverage: Tasks cover schema, contract, proof registration, Base USDC checkout preparation and confirmation, claim state, environment, and verification.
- Scope control: Toss remains intact, Base USDC is additive, and multi-token support is left to the provider boundary.
- Type consistency: `payment_provider`, `crypto_status`, `proof_status`, `settlement_provider`, and `claim_status` names match the design document and migration.
- Execution readiness: Every task has concrete files, commands, expected outcomes, and commit points. The plan keeps wallet writes in browser components and transaction verification in server routes.
