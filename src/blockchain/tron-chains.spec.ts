import { getTronChainById, isTronChain, TRON_CHAIN_IDS } from './tron-chains';

describe('getTronChainById', () => {
  describe('known chain IDs', () => {
    it('resolves Tron Mainnet (728126428)', () => {
      const chain = getTronChainById('728126428');
      expect(chain.id).toBe(728126428);
      expect(chain.name).toBe('Tron Mainnet');
      expect(chain.network).toBe('mainnet');
      expect(chain.rpcUrls.default.http.length).toBeGreaterThan(0);
    });

    it('resolves Shasta Testnet (2494104990)', () => {
      const chain = getTronChainById('2494104990');
      expect(chain.id).toBe(2494104990);
      expect(chain.name).toBe('Tron Shasta Testnet');
      expect(chain.network).toBe('shasta');
    });
  });

  describe('custom RPC override', () => {
    it('uses custom RPC URL when provided', () => {
      const customRpc = 'https://custom-tron-node.example.com';
      const chain = getTronChainById('728126428', customRpc);
      expect(chain.rpcUrls.default.http).toEqual([customRpc]);
    });

    it('uses default RPC when no custom URL provided', () => {
      const chain = getTronChainById('728126428');
      expect(chain.rpcUrls.default.http[0]).toContain('trongrid');
    });
  });

  describe('unknown chain ID', () => {
    it('throws for unknown chain ID', () => {
      expect(() => getTronChainById('999999')).toThrow('Unsupported Tron chain ID');
    });
  });
});

describe('TRON_CHAIN_IDS', () => {
  it('contains known Tron chain IDs', () => {
    expect(TRON_CHAIN_IDS.has(728126428)).toBe(true);
    expect(TRON_CHAIN_IDS.has(2494104990)).toBe(true);
  });

  it('does not contain EVM chain IDs', () => {
    expect(TRON_CHAIN_IDS.has(1)).toBe(false);
    expect(TRON_CHAIN_IDS.has(137)).toBe(false);
  });
});

describe('isTronChain', () => {
  it('returns true for TronChainConfig', () => {
    const chain = getTronChainById('728126428');
    expect(isTronChain(chain)).toBe(true);
  });

  it('returns false for viem Chain-like object', () => {
    const evmChain = {
      id: 1,
      name: 'Ethereum',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [] } },
    };
    expect(isTronChain(evmChain as never)).toBe(false);
  });
});
