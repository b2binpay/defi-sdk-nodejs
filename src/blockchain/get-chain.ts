import type { Chain } from 'viem';
import * as viemChains from 'viem/chains';
import { getTronChainById, TRON_CHAIN_IDS, type TronChainConfig } from './tron-chains';

/**
 * Resolves an EVM chain by ID. Returns a viem `Chain` type.
 * Throws if the chain ID is not a known EVM chain.
 */
export function getEvmChainById(chainId: string, rpcUrl?: string): Chain {
  const chain = Object.values(viemChains).find((item) => item.id.toString() === chainId);
  if (!chain) {
    throw new Error(`Unsupported EVM chain ID: ${chainId}. Specified chain is not preconfigured in viem.`);
  }

  if (!rpcUrl) {
    return chain as Chain;
  }

  return {
    ...chain,
    rpcUrls: {
      default: { http: [rpcUrl] },
      public: { http: [rpcUrl] },
    },
  } as Chain;
}

/**
 * Resolves a Tron (TVM) chain by ID. Returns a `TronChainConfig` type.
 * Throws if the chain ID is not a known Tron chain.
 * Re-export of `getTronChainById` with a consistent naming convention.
 */
export const getTvmChainById = getTronChainById;

/**
 * Universal chain resolver — tries EVM first, then Tron.
 * Returns `Chain | TronChainConfig`. Use `getEvmChainById` or `getTvmChainById`
 * when you need a narrowed return type.
 */
export function getChainById(chainId: string, rpcUrl?: string): Chain | TronChainConfig {
  const evmChain = Object.values(viemChains).find((item) => item.id.toString() === chainId);

  if (evmChain) {
    return getEvmChainById(chainId, rpcUrl);
  }

  const numericId = Number(chainId);
  if (TRON_CHAIN_IDS.has(numericId)) {
    return getTronChainById(chainId, rpcUrl);
  }

  throw new Error(`Unsupported chain ID: ${chainId}. Not a known EVM or Tron chain.`);
}
