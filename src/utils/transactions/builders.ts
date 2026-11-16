import { type Abi, type Address, encodeFunctionData, type Hex } from 'viem';
import type { CallDto, QueueOperationResponseDto } from '../../../generated-contracts';
import { DefiSdkError } from '../../errors';

export interface PreparedTransaction {
  readonly to: Address;
  readonly data: Hex;
  readonly chainId: number;
  readonly value?: bigint;
  readonly gas?: bigint;
  readonly maxFeePerGas?: bigint;
  readonly maxPriorityFeePerGas?: bigint;
}

/**
 * The fields the multisig `execute` call needs from a queue operation. The signature blob is the
 * only signing material it carries, so the SDK's own domain models — which drop the raw
 * per-signature array — satisfy this shape.
 */
export type ExecutableQueueOperation = Pick<
  QueueOperationResponseDto,
  'id' | 'calls' | 'executeOperationId' | 'signatureBlob'
>;

export interface ExecuteQueueOperationInput {
  readonly operations: ReadonlyArray<ExecutableQueueOperation>;
  readonly contractAddress: Address;
  readonly chainId: number;
  readonly abi: Abi;
}

/**
 * The signature blob the multisig `execute` consumes. The API builds it once an operation has
 * collected its required signatures and never returns the individual signatures, so an operation
 * without a blob is not executable yet.
 */
export function requireSignatureBlob(operation: Pick<ExecutableQueueOperation, 'id' | 'signatureBlob'>): Hex {
  if (!operation.signatureBlob) {
    throw new DefiSdkError(
      `[defi-sdk] Queue operation ${operation.id} has no signatureBlob: it has not collected the required number of signatures yet.`,
    );
  }

  return ensureHexPrefix(operation.signatureBlob);
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

export interface ExecuteOperationTuple {
  readonly calls: Array<{ to: Address; value: bigint; data: Hex }>;
  readonly signatures: Hex;
  readonly id: Hex;
}

/**
 * The `execute` argument tuples the multisig ABI expects: each operation's calls with their defaults
 * applied, plus the signature blob the contract verifies. Shared by the EVM and TRON execute paths.
 */
export function toExecuteOperationTuples(operations: ReadonlyArray<ExecutableQueueOperation>): ExecuteOperationTuple[] {
  return operations.map((operation) => ({
    calls: operation.calls.map((call) => ({
      to: call.to as Address,
      value: call.value ? BigInt(call.value) : 0n,
      data: (call.data ?? '0x') as Hex,
    })),
    signatures: requireSignatureBlob(operation),
    id: operation.executeOperationId as Hex,
  }));
}

/**
 * Builds a multisig execute transaction payload for one or more queue operations.
 */
export function buildExecuteOperationsTransaction(input: ExecuteQueueOperationInput): PreparedTransaction {
  const data = encodeFunctionData({
    abi: input.abi,
    functionName: 'execute',
    args: [toExecuteOperationTuples(input.operations)],
  });

  return {
    to: input.contractAddress,
    chainId: input.chainId,
    data,
    value: 0n,
  };
}
