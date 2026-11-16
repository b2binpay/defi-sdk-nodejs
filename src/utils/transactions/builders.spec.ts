import { decodeFunctionData, type Hex } from 'viem';
import type { QueueOperationResponseDto } from '../../../generated-contracts';
import { buildExecuteOperationsTransaction, requireSignatureBlob } from './builders';

const CONTRACT = '0x1111111111111111111111111111111111111111' as const;
const BLOB: Hex = `0x${'ab'.repeat(65)}` as Hex;

const EXECUTE_ABI = [
  {
    type: 'function',
    name: 'execute',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'operations',
        type: 'tuple[]',
        components: [
          {
            name: 'calls',
            type: 'tuple[]',
            components: [
              { name: 'to', type: 'address' },
              { name: 'value', type: 'uint256' },
              { name: 'data', type: 'bytes' },
            ],
          },
          { name: 'signatures', type: 'bytes' },
          { name: 'id', type: 'bytes32' },
        ],
      },
    ],
    outputs: [],
  },
] as const;

function operation(overrides: Partial<QueueOperationResponseDto> = {}): QueueOperationResponseDto {
  return {
    id: '900000000000000001',
    executeOperationId: `0x${'0'.repeat(64)}`,
    calls: [{ to: '0x2222222222222222222222222222222222222222', value: '0', data: '0x' }],
    signatureBlob: BLOB,
    ...overrides,
  } as QueueOperationResponseDto;
}

describe('requireSignatureBlob', () => {
  it('returns the blob the API built', () => {
    expect(requireSignatureBlob(operation())).toBe(BLOB);
  });

  it('adds the 0x prefix when the API omits it', () => {
    expect(requireSignatureBlob(operation({ signatureBlob: BLOB.slice(2) }))).toBe(BLOB);
  });

  it('fails loudly when the operation has not reached its signing threshold', () => {
    expect(() => requireSignatureBlob(operation({ signatureBlob: null }))).toThrow(/has no signatureBlob/);
  });

  it('refuses an empty blob instead of executing with no signatures', () => {
    expect(() => requireSignatureBlob(operation({ signatureBlob: '' }))).toThrow(/has no signatureBlob/);
  });
});

describe('buildExecuteOperationsTransaction', () => {
  it('executes from the blob alone', () => {
    const transaction = buildExecuteOperationsTransaction({
      operations: [operation()],
      contractAddress: CONTRACT,
      chainId: 11155111,
      abi: EXECUTE_ABI,
    });

    const { args } = decodeFunctionData({ abi: EXECUTE_ABI, data: transaction.data });
    expect(args[0][0].signatures).toBe(BLOB);
    expect(transaction.to).toBe(CONTRACT);
  });

  it('passes a multi-signature blob through verbatim, in the order the API built it', () => {
    const multiBlob: Hex = `0x${'ff'.repeat(65)}${'11'.repeat(65)}` as Hex;

    const transaction = buildExecuteOperationsTransaction({
      operations: [operation({ signatureBlob: multiBlob })],
      contractAddress: CONTRACT,
      chainId: 11155111,
      abi: EXECUTE_ABI,
    });

    const { args } = decodeFunctionData({ abi: EXECUTE_ABI, data: transaction.data });
    expect(args[0][0].signatures).toBe(multiBlob);
  });

  it('refuses to build a batch containing an operation below its threshold', () => {
    expect(() =>
      buildExecuteOperationsTransaction({
        operations: [operation(), operation({ id: '900000000000000002', signatureBlob: null })],
        contractAddress: CONTRACT,
        chainId: 11155111,
        abi: EXECUTE_ABI,
      }),
    ).toThrow(/900000000000000002/);
  });
});
