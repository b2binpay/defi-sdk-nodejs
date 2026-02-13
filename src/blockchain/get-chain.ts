import type { Chain } from 'viem';
import * as viemChains from 'viem/chains';

export function getChainById(chainId: string, rpcUrl?: string): Chain {
  const chain = Object.values(viemChains).find((item) => item.id.toString() === chainId);
  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}. Specified chain is not preconfigured in viem.`);
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
