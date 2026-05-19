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
