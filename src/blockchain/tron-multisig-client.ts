import type { TronWeb } from 'tronweb';
import type { Abi } from 'viem';
import { concatHex, encodeFunctionData, type Hex } from 'viem';
import type { QueueOperationResponseDto } from '../../generated-contracts';
import type { AbiCacheEntry } from '../abi-provider';
import { ensureHexPrefix, normalizeCalls } from '../utils/transactions/builders';
import {
  buildTronExecuteTypedData,
  fetchTronExecuteTypedDataDomain,
  type TronExecuteTypedDataPayload,
} from '../utils/transactions/tron-tip712';
import type { TronAddress } from '../utils/tron-types';

export interface TronMultisigBlockchainClientOptions {
  chainId: string;
  tronWeb: TronWeb;
  contractAbi: AbiCacheEntry;
  defaultFeeLimit: number;
}

export interface TronPreparedTransaction {
  readonly to: TronAddress;
  readonly data: string;
  readonly chainId: string;
  readonly feeLimit: number;
  readonly callValue: number;
  readonly raw: unknown;
}

export class TronMultisigBlockchainClient {
  private readonly tronWebInstance: TronWeb;
  private readonly chainId: string;
  private readonly abi: Abi;
  private readonly feeLimit: number;
  private readonly executeFunctionSignature: string;

  constructor(options: TronMultisigBlockchainClientOptions) {
    this.chainId = options.chainId;
    this.tronWebInstance = options.tronWeb;
    this.abi = options.contractAbi.abi as Abi;
    this.feeLimit = options.defaultFeeLimit;

    const executeAbiItem = (this.abi as readonly { type: string; name?: string }[]).find(
      (item) => item.type === 'function' && item.name === 'execute',
    );
    if (!executeAbiItem) {
      throw new Error('execute function not found in contract ABI');
    }
    this.executeFunctionSignature = this.buildFunctionSignature(executeAbiItem);
  }

  async createExecuteTypedData(args: {
    contractAddress: TronAddress;
    operation: QueueOperationResponseDto;
    domainOverride?: TronExecuteTypedDataPayload['domain'];
  }): Promise<TronExecuteTypedDataPayload> {
    const calls = normalizeCalls(args.operation.calls);

    const domain =
      args.domainOverride ??
      (await fetchTronExecuteTypedDataDomain({
        tronWeb: this.tronWebInstance,
        contractAddress: args.contractAddress,
        abi: this.abi,
      }));

    return buildTronExecuteTypedData({
      domain,
      calls: calls.map((call) => ({
        to: call.to as TronAddress,
        value: typeof call.value === 'bigint' ? call.value : BigInt(call.value),
        data: call.data,
      })),
      nonce: BigInt(args.operation.nonce),
    });
  }

  async buildExecuteTransaction(params: {
    contractAddress: TronAddress;
    callerAddress: TronAddress;
    operations: QueueOperationResponseDto[];
    feeLimit?: number;
  }): Promise<TronPreparedTransaction> {
    const feeLimit = params.feeLimit ?? this.feeLimit;

    const operations = params.operations.map((operation) => ({
      calls: operation.calls.map((call) => ({
        to: call.to,
        value: call.value ? BigInt(call.value) : 0n,
        data: call.data ?? '0x',
      })),
      signatures: concatHex(operation.signatures.map((sig) => sig.sign as Hex)),
      id: operation.executeOperationId,
    }));

    const data = encodeFunctionData({
      abi: this.abi,
      functionName: 'execute',
      args: [operations],
    });

    // Build transaction via TronWeb's triggerSmartContract with rawParameter.
    // We pass the viem-encoded params (without selector) as rawParameter and derive
    // the correct function selector from the ABI name to avoid double-encoding.
    const rawParameter = data.slice(10); // ABI-encoded params without 0x + 4-byte selector

    const { transaction } = await this.tronWebInstance.transactionBuilder.triggerSmartContract(
      params.contractAddress,
      this.executeFunctionSignature,
      { feeLimit, callValue: 0, rawParameter },
      [],
      params.callerAddress,
    );

    return {
      to: params.contractAddress,
      data,
      chainId: this.chainId,
      feeLimit,
      callValue: 0,
      raw: transaction,
    };
  }

  async buildClaimTransaction(params: {
    contractAddress: TronAddress;
    callerAddress: TronAddress;
    erc20: TronAddress;
    depositIds: string[];
    to?: TronAddress;
    feeLimit?: number;
  }): Promise<TronPreparedTransaction> {
    if (params.depositIds.length === 0) {
      throw new Error('No claimable deposits found for the specified parameters.');
    }

    const feeLimit = params.feeLimit ?? this.feeLimit;
    const depositIds = params.depositIds.map(ensureHexPrefix);

    const args = params.to
      ? [
          { type: 'address', value: params.erc20 },
          { type: 'address', value: params.to },
          { type: 'bytes32[]', value: depositIds },
        ]
      : [
          { type: 'address', value: params.erc20 },
          { type: 'bytes32[]', value: depositIds },
        ];

    const functionSignature = params.to ? 'claimTo(address,address,bytes32[])' : 'claim(address,bytes32[])';

    const { transaction } = await this.tronWebInstance.transactionBuilder.triggerSmartContract(
      params.contractAddress,
      functionSignature,
      { feeLimit, callValue: 0 },
      args,
      params.callerAddress,
    );

    return {
      to: params.contractAddress,
      data: functionSignature,
      chainId: this.chainId,
      feeLimit,
      callValue: 0,
      raw: transaction,
    };
  }

  /**
   * Builds a Solidity function signature string from an ABI item.
   * e.g. `execute((address,uint256,bytes)[],bytes,bytes32)[])`
   * This is needed because TronWeb's triggerSmartContract computes the 4-byte
   * function selector by keccak256-hashing this string.
   */
  // biome-ignore lint/suspicious/noExplicitAny: ABI item structure is complex and varies
  private buildFunctionSignature(abiItem: any): string {
    const formatType = (input: { type: string; components?: unknown[] }): string => {
      if (input.type === 'tuple' || input.type.startsWith('tuple')) {
        const suffix = input.type.slice(5); // e.g. '[]' from 'tuple[]'
        const inner = (input.components as { type: string; components?: unknown[] }[]).map(formatType).join(',');
        return `(${inner})${suffix}`;
      }
      return input.type;
    };
    const params = (abiItem.inputs as { type: string; components?: unknown[] }[]).map(formatType).join(',');
    return `${abiItem.name}(${params})`;
  }
}
