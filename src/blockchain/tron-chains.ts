export interface TronChainConfig {
  readonly id: number;
  readonly name: string;
  readonly network: string;
  readonly rpcUrls: {
    readonly default: { readonly http: readonly string[] };
  };
}

const TRON_CHAINS: ReadonlyMap<number, TronChainConfig> = new Map([
  [
    728126428,
    {
      id: 728126428,
      name: 'Tron Mainnet',
      network: 'mainnet',
      rpcUrls: { default: { http: ['https://api.trongrid.io'] } },
    },
  ],
  [
    2494104990,
    {
      id: 2494104990,
      name: 'Tron Shasta Testnet',
      network: 'shasta',
      rpcUrls: { default: { http: ['https://api.shasta.trongrid.io'] } },
    },
  ],
]);

export const TRON_CHAIN_IDS: ReadonlySet<number> = new Set(TRON_CHAINS.keys());

export function getTronChainById(chainId: string, rpcUrl?: string): TronChainConfig {
  const id = Number(chainId);
  const chain = TRON_CHAINS.get(id);

  if (!chain) {
    throw new Error(`Unsupported Tron chain ID: ${chainId}. Known Tron chains: ${[...TRON_CHAIN_IDS].join(', ')}`);
  }

  if (!rpcUrl) {
    return chain;
  }

  return {
    ...chain,
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

export function isTronChain(chain: unknown): chain is TronChainConfig {
  if (typeof chain !== 'object' || chain === null) return false;
  const candidate = chain as Record<string, unknown>;
  return typeof candidate.id === 'number' && TRON_CHAIN_IDS.has(candidate.id as number);
}
