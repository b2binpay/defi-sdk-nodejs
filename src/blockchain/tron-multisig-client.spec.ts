import { type Abi, decodeFunctionData, type Hex } from 'viem';
import type { AbiCacheEntry, SmartContractCapabilities } from '../abi-provider';
import { DefiSdkError } from '../errors';
import { TRON_ZERO_ADDRESS, type TronAddress } from '../utils/tron-types';
import { TronMultisigBlockchainClient } from './tron-multisig-client';

const CONTRACT: TronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
const CALLER: TronAddress = 'TRKAeHHtjKTfmKYVpt1K7vf4dHCrdNtAdv' as TronAddress;
const RECIPIENT: TronAddress = 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL' as TronAddress;
const TOKEN: TronAddress = 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW' as TronAddress;
const EVM_RECIPIENT = '0x2222222222222222222222222222222222222222';
const BLOB: Hex = `0x${'ab'.repeat(65)}` as Hex;

const MOCK_ABI: Abi = [
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

const MOCK_CAPABILITIES: SmartContractCapabilities = {
  supportsInvoices: true,
  supportsWhitelist: false,
  supportsStaking: false,
};

const mockAbiEntry: AbiCacheEntry = {
  abi: MOCK_ABI,
  version: '1.1.0',
  capabilities: MOCK_CAPABILITIES,
};

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
      const unknownAbi: AbiCacheEntry = {
        abi: MOCK_ABI,
        version: '9.9.9',
        capabilities: MOCK_CAPABILITIES,
      };
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

  describe('buildExecuteTransaction', () => {
    function executeClient() {
      const triggerSmartContract = jest.fn().mockResolvedValue({
        transaction: { txID: 'abc123', raw_data: {} },
      });

      const client = new TronMultisigBlockchainClient({
        chainId: '728126428',
        tronWeb: { transactionBuilder: { triggerSmartContract } } as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      return { client, triggerSmartContract };
    }

    function operation(overrides: { id?: string; signatureBlob?: string | null } = {}) {
      return {
        id: '900000000000000001',
        executeOperationId: `0x${'0'.repeat(64)}`,
        calls: [{ to: EVM_RECIPIENT, value: '0', data: '0x' }],
        signatureBlob: BLOB,
        ...overrides,
      } as never;
    }

    it('executes from the blob alone', async () => {
      const { client, triggerSmartContract } = executeClient();

      const result = await client.buildExecuteTransaction({
        contractAddress: CONTRACT,
        callerAddress: CALLER,
        operations: [operation()],
      });

      const { args } = decodeFunctionData({ abi: MOCK_ABI, data: result.data as Hex });
      expect((args as [Array<{ signatures: Hex }>])[0][0].signatures).toBe(BLOB);
      expect(result.to).toBe(CONTRACT);
      expect(triggerSmartContract).toHaveBeenCalled();
    });

    it('refuses to build when an operation has not reached its signing threshold', async () => {
      const { client, triggerSmartContract } = executeClient();

      await expect(
        client.buildExecuteTransaction({
          contractAddress: CONTRACT,
          callerAddress: CALLER,
          operations: [operation(), operation({ id: '900000000000000002', signatureBlob: null })],
        }),
      ).rejects.toThrow(/900000000000000002/);
      expect(triggerSmartContract).not.toHaveBeenCalled();
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

    it('claims native TRX when erc20 is null, accepting a numeric chainId', async () => {
      const mockTrigger = jest.fn().mockResolvedValue({ transaction: { txID: 'abc123', raw_data: {} } });
      const client = new TronMultisigBlockchainClient({
        chainId: 728126428,
        tronWeb: { transactionBuilder: { triggerSmartContract: mockTrigger } } as never,
        contractAbi: mockAbiEntry,
        defaultFeeLimit: 150_000_000,
      });

      const result = await client.buildClaimTransaction({
        contractAddress: CONTRACT,
        callerAddress: CALLER,
        erc20: null,
        depositIds: ['0x01'],
      });

      expect(result.chainId).toBe('728126428');
      const [, signature, , args] = mockTrigger.mock.calls[0];
      expect(signature).toBe('claim(address,bytes32[])');
      expect(args[0]).toEqual({ type: 'address', value: TRON_ZERO_ADDRESS });
    });

    it('rejects an EVM address passed where a TRON address is expected', async () => {
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
          depositIds: ['0x01'],
          to: EVM_RECIPIENT,
        }),
      ).rejects.toBeInstanceOf(DefiSdkError);
    });
  });
});
