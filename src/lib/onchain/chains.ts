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
