import type { Address, Hex } from "viem";
import { getAddress, isAddress } from "viem";
import { isBaseChain, type OnchainPublicConfig } from "./chains";

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

function valueWithDefault(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  if (value === undefined) return fallback;
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function integerEnv(name: string, fallback: string): number {
  const value = Number(valueWithDefault(name, fallback));
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function baseChainIdEnv(name: string): number {
  const value = integerEnv(name, "84532");
  if (!isBaseChain(value)) throw new Error(`${name} must be a Base chain id`);
  return value;
}

function privateKeyEnv(name: string): Hex {
  const value = required(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte hex private key`);
  }
  return value as Hex;
}

function platformFeeBpsEnv(name: string): number {
  const value = integerEnv(name, "2000");
  if (value < 0 || value > 10000) {
    throw new Error(`${name} must be between 0 and 10000`);
  }
  return value;
}

function positiveNumberEnv(name: string, fallback: string): number {
  const value = Number(valueWithDefault(name, fallback));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

export function getOnchainPublicConfig(): OnchainPublicConfig {
  const enabled = process.env.NEXT_PUBLIC_ONCHAIN_ENABLED === "true";
  return {
    enabled,
    chainId: baseChainIdEnv("NEXT_PUBLIC_BASE_CHAIN_ID"),
    explorerUrl: process.env.NEXT_PUBLIC_BASE_EXPLORER_URL ?? "https://sepolia.basescan.org",
    usdcAddress: optionalAddress("NEXT_PUBLIC_USDC_ADDRESS"),
    escrowAddress: optionalAddress("NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS"),
  };
}

export function getOnchainServerConfig() {
  return {
    ...getOnchainPublicConfig(),
    rpcUrl: required("BASE_RPC_URL"),
    operatorPrivateKey: privateKeyEnv("ONCHAIN_OPERATOR_PRIVATE_KEY"),
    treasuryAddress: optionalAddress("ONCHAIN_TREASURY_ADDRESS"),
    platformFeeBps: platformFeeBpsEnv("ONCHAIN_PLATFORM_FEE_BPS"),
    usdcPerKrw: positiveNumberEnv("ONCHAIN_USDC_PER_KRW", "0.00075"),
  };
}
