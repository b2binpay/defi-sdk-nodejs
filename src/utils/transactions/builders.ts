import { type Abi, type Address, concatHex, encodeFunctionData, type Hex } from 'viem';
import type { CallDto, QueueOperationResponseDto } from '../../../generated-contracts';

export interface PreparedTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly chainId: number;
  readonly value?: bigint;
  readonly gas?: bigint;
  readonly maxFeePerGas?: bigint;
  readonly maxPriorityFeePerGas?: bigint;
}

export interface ExecuteQueueOperationInput {
  readonly operations: Array<QueueOperationResponseDto>;
  readonly contractAddress: Address;
  readonly chainId: number;
  readonly abi: Abi;
}

/** Ensures a hex string has a `0x` prefix. Idempotent. */
export function ensureHexPrefix(value: string): Hex {
  return (value.startsWith('0x') ? value : `0x${value}`) as Hex;
}

/** Normalizes raw `CallDto` from the API into a typed structure with defaults. */
export function normalizeCalls(calls: CallDto[]): Array<{ to: string; value: string | number | bigint; data: string }> {
  return calls.map((call) => ({
    to: call.to,
    value: call.value ?? '0',
    data: call.data ?? '0x',
  }));
}

/**
 * Builds a multisig execute transaction payload for one or more queue operations.
 */
export function buildExecuteOperationsTransaction(input: ExecuteQueueOperationInput): PreparedTransaction {
  const abi = input.abi;

  const operations = input.operations.map((operation) => ({
    calls: operation.calls.map((call) => ({
      to: call.to as Address,
      value: call.value ? BigInt(call.value) : 0n,
      data: (call.data ?? '0x') as Hex,
    })),
    signatures: concatHex(operation.signatures.map((sig) => sig.sign as Hex)),
    id: operation.executeOperationId as Hex,
  }));

  const data = encodeFunctionData({
    abi,
    functionName: 'execute',
    args: [operations],
  });

  return {
    to: input.contractAddress,
    chainId: input.chainId,
    data,
    value: 0n,
  };
}
