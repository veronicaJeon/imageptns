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
