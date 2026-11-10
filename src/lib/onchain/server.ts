import "server-only";

import { createPublicClient, createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BASE_MAINNET_CHAIN_ID, BASE_SEPOLIA_CHAIN_ID } from "./chains";
import { getOnchainServerConfig } from "./env";

const base = defineChain({
  id: BASE_MAINNET_CHAIN_ID,
  name: "Base",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://mainnet.base.org"] } },
  blockExplorers: { default: { name: "Basescan", url: "https://basescan.org" } },
});

const baseSepolia = defineChain({
  id: BASE_SEPOLIA_CHAIN_ID,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
  blockExplorers: { default: { name: "Basescan", url: "https://sepolia.basescan.org" } },
  testnet: true,
});

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
