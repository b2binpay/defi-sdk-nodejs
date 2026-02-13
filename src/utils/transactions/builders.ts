import { type Address, concatHex, encodeFunctionData, type Hex } from 'viem';
import type { QueueOperationResponseDto } from '../../../generated-contracts';
import { MULTI_SIG_WALLET_ABI } from '../../abi/multi-sig-wallet';

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
}

/**
 * Builds a multisig execute transaction payload for one or more queue operations.
 */
export function buildExecuteOperationsTransaction(input: ExecuteQueueOperationInput): PreparedTransaction {
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
    abi: MULTI_SIG_WALLET_ABI,
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
