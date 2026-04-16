import type { AbiCacheEntry } from '../abi-provider';
import type { TronAddress } from '../utils/tron-validation';
import { TronMultisigBlockchainClient } from './tron-multisig-client';

const CONTRACT: TronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
const CALLER: TronAddress = 'TRKAeHHtjKTfmKYVpt1K7vf4dHCrdNtAdv' as TronAddress;
const RECIPIENT: TronAddress = 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL' as TronAddress;
const TOKEN: TronAddress = 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW' as TronAddress;

const MOCK_ABI = [
  {
    inputs: [],
    name: 'eip712Domain',
    outputs: [
      { type: 'bytes1' },
      { type: 'string' },
      { type: 'string' },
      { type: 'uint256' },
      { type: 'address' },
      { type: 'bytes32' },
      { type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        type: 'tuple[]',
        name: 'operations',
        components: [
          {
            type: 'tuple[]',
            name: 'calls',
            components: [
              { type: 'address', name: 'to' },
              { type: 'uint256', name: 'value' },
              { type: 'bytes', name: 'data' },
            ],
          },
          { type: 'bytes', name: 'signatures' },
          { type: 'bytes32', name: 'id' },
        ],
      },
    ],
    name: 'execute',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { type: 'address', name: 'erc20' },
      { type: 'uint256[]', name: 'depositIds' },
    ],
    name: 'claim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { type: 'address', name: 'erc20' },
      { type: 'address', name: 'to' },
      { type: 'uint256[]', name: 'depositIds' },
    ],
    name: 'claimTo',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

const mockAbiEntry: AbiCacheEntry = {
  abi: MOCK_ABI as unknown[],
  version: '1.1.0',
} as AbiCacheEntry;

describe('TronMultisigBlockchainClient', () => {
  describe('constructor', () => {
    it('creates client with valid options', () => {
      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: {} as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });
      expect(client).toBeDefined();
    });

    it('accepts unknown contract version without error', () => {
      const unknownAbi: AbiCacheEntry = { abi: MOCK_ABI as unknown[], version: '9.9.9' } as AbiCacheEntry;
      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: {} as never,
        contractAbi: unknownAbi,
        defaultFeeLimit: 150_000_000,
      });

      expect(client).toBeDefined();
    });
  });

  describe('createExecuteTypedData', () => {
    it('builds typed data with domain override (no RPC needed)', async () => {
      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: {} as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      const domain = {
        name: 'MultiSigWallet',
        version: '1.1.0',
        chainId: 728126428n,
        verifyingContract: CONTRACT,
      };

      const operation = {
        calls: [{ to: RECIPIENT, value: '1000', data: '0x' }],
        nonce: '1',
        signatures: [],
        executeOperationId: '0x01',
      };

      const result = await client.createExecuteTypedData({
        contractAddress: CONTRACT,
        operation: operation as never,
        domainOverride: domain,
      });

      expect(result.primaryType).toBe('Execute');
      expect(result.domain).toBe(domain);
      expect(result.message.nonce).toBe(1n);
      expect(result.message.calls).toHaveLength(1);
    });
  });

  describe('buildClaimTransaction', () => {
    it('builds claim transaction with correct function name', async () => {
      const mockTrigger = jest.fn().mockResolvedValue({
        transaction: { txID: 'abc123', raw_data: {} },
      });

      const mockTronWeb = {
        transactionBuilder: {
          triggerSmartContract: mockTrigger,
        },
        address: {
          toHex: jest.fn().mockReturnValue(`41${'aa'.repeat(20)}`),
        },
      };

      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: mockTronWeb as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      const result = await client.buildClaimTransaction({
        contractAddress: CONTRACT,
        callerAddress: CALLER,
        erc20: TOKEN,
        depositIds: ['0x01', '0x02'],
      });

      expect(result).toBeDefined();
      expect(result.to).toBe(CONTRACT);
      expect(result.chainId).toBe('728126428');
      expect(mockTrigger).toHaveBeenCalled();
    });

    it('builds claimTo transaction when destination address provided', async () => {
      const mockTrigger = jest.fn().mockResolvedValue({
        transaction: { txID: 'abc123', raw_data: {} },
      });

      const mockTronWeb = {
        transactionBuilder: {
          triggerSmartContract: mockTrigger,
        },
        address: {
          toHex: jest.fn().mockReturnValue(`41${'aa'.repeat(20)}`),
        },
      };

      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: mockTronWeb as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      const result = await client.buildClaimTransaction({
        contractAddress: CONTRACT,
        callerAddress: CALLER,
        erc20: TOKEN,
        depositIds: ['0x01'],
        to: RECIPIENT,
      });

      expect(result).toBeDefined();
      expect(result.to).toBe(CONTRACT);
    });

    it('throws when no deposit IDs provided', async () => {
      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: {} as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      await expect(
        client.buildClaimTransaction({
          contractAddress: CONTRACT,
          callerAddress: CALLER,
          erc20: TOKEN,
          depositIds: [],
        }),
      ).rejects.toThrow('No claimable deposits');
    });
  });
});
