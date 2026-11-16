import type { TronWeb } from 'tronweb';
import type { Abi } from 'viem';
import { encodeFunctionData } from 'viem';
import type { ContractAbi } from '../abi-provider';
import type { ChainIdentifier } from '../api/defi-client';
import { DefiSdkError } from '../errors';
import { toTronAddress } from '../utils/address-input';
import type { ExecutableQueueOperation } from '../utils/transactions/builders';
import { ensureHexPrefix, normalizeCalls, toExecuteOperationTuples } from '../utils/transactions/builders';
import type { SignableQueueOperation } from '../utils/transactions/eip712';
import {
  buildTronExecuteTypedData,
  fetchTronExecuteTypedDataDomain,
  type TronExecuteTypedDataPayload,
} from '../utils/transactions/tron-tip712';
import { TRON_ZERO_ADDRESS, type TronAddress } from '../utils/tron-types';

export interface TronMultisigBlockchainClientOptions {
  chainId: ChainIdentifier;
  tronWeb: TronWeb;
  contractAbi: ContractAbi;
  defaultFeeLimit: number;
}

export interface TronCreateExecuteTypedDataArgs {
  /** The multisig contract — `account.contract` from `DefiClient.getAccount()`. */
  contractAddress: string;
  operation: SignableQueueOperation;
  domainOverride?: TronExecuteTypedDataPayload['domain'];
}

export interface TronBuildExecuteTransactionArgs {
  contractAddress: string;
  /** The address that signs and pays for the transaction. */
  callerAddress: string;
  operations: ExecutableQueueOperation[];
  feeLimit?: number;
}

export interface TronBuildClaimTransactionArgs {
  contractAddress: string;
  callerAddress: string;
  /** Token to claim; `null` (a native currency's `address`) claims TRX. */
  erc20: string | null;
  /** `invoiceNonce` of every claimable deposit to sweep — `ClaimItem.invoiceNonce`. */
  depositIds: string[];
  /** Recipient; omit to claim into the multisig contract itself. */
  to?: string;
  feeLimit?: number;
}

/** The unsigned transaction TronWeb builds; pass it to `tronWeb.trx.sign()` before broadcasting. */
export type TronUnsignedTransaction = Awaited<
  ReturnType<TronWeb['transactionBuilder']['triggerSmartContract']>
>['transaction'];

export interface TronPreparedTransaction {
  readonly to: TronAddress;
  readonly data: string;
  readonly chainId: string;
  readonly feeLimit: number;
  readonly callValue: number;
  readonly raw: TronUnsignedTransaction;
}

export class TronMultisigBlockchainClient {
  private readonly tronWebInstance: TronWeb;
  private readonly chainId: string;
  private readonly abi: Abi;
  private readonly feeLimit: number;
  private readonly executeFunctionSignature: string;

  constructor(options: TronMultisigBlockchainClientOptions) {
    this.chainId = String(options.chainId);
    this.tronWebInstance = options.tronWeb;
    this.abi = options.contractAbi.abi as Abi;
    this.feeLimit = options.defaultFeeLimit;

    const executeAbiItem = (this.abi as readonly { type: string; name?: string }[]).find(
      (item) => item.type === 'function' && item.name === 'execute',
    );
    if (!executeAbiItem) {
      throw new DefiSdkError('execute function not found in contract ABI');
    }
    this.executeFunctionSignature = this.buildFunctionSignature(executeAbiItem);
  }

  async createExecuteTypedData(args: TronCreateExecuteTypedDataArgs): Promise<TronExecuteTypedDataPayload> {
    const calls = normalizeCalls(args.operation.calls);

    const domain =
      args.domainOverride ??
      (await fetchTronExecuteTypedDataDomain({
        tronWeb: this.tronWebInstance,
        contractAddress: toTronAddress(args.contractAddress, 'contractAddress'),
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

  async buildExecuteTransaction(params: TronBuildExecuteTransactionArgs): Promise<TronPreparedTransaction> {
    const feeLimit = params.feeLimit ?? this.feeLimit;
    const contractAddress = toTronAddress(params.contractAddress, 'contractAddress');
    const callerAddress = toTronAddress(params.callerAddress, 'callerAddress');

    const data = encodeFunctionData({
      abi: this.abi,
      functionName: 'execute',
      args: [toExecuteOperationTuples(params.operations)],
    });

    // Build transaction via TronWeb's triggerSmartContract with rawParameter.
    // We pass the viem-encoded params (without selector) as rawParameter and derive
    // the correct function selector from the ABI name to avoid double-encoding.
    const rawParameter = data.slice(10); // ABI-encoded params without 0x + 4-byte selector

    const { transaction } = await this.tronWebInstance.transactionBuilder.triggerSmartContract(
      contractAddress,
      this.executeFunctionSignature,
      { feeLimit, callValue: 0, rawParameter },
      [],
      callerAddress,
    );

    return {
      to: contractAddress,
      data,
      chainId: this.chainId,
      feeLimit,
      callValue: 0,
      raw: transaction,
    };
  }

  async buildClaimTransaction(params: TronBuildClaimTransactionArgs): Promise<TronPreparedTransaction> {
    if (params.depositIds.length === 0) {
      throw new DefiSdkError('No claimable deposits found for the specified parameters.');
    }

    const feeLimit = params.feeLimit ?? this.feeLimit;
    const contractAddress = toTronAddress(params.contractAddress, 'contractAddress');
    const callerAddress = toTronAddress(params.callerAddress, 'callerAddress');
    const erc20 = params.erc20 === null ? TRON_ZERO_ADDRESS : toTronAddress(params.erc20, 'erc20');
    const depositIds = params.depositIds.map(ensureHexPrefix);

    const args =
      params.to === undefined
        ? [
            { type: 'address', value: erc20 },
            { type: 'bytes32[]', value: depositIds },
          ]
        : [
            { type: 'address', value: erc20 },
            { type: 'address', value: toTronAddress(params.to, 'to') },
            { type: 'bytes32[]', value: depositIds },
          ];

    const functionSignature =
      params.to === undefined ? 'claim(address,bytes32[])' : 'claimTo(address,address,bytes32[])';

    const { transaction } = await this.tronWebInstance.transactionBuilder.triggerSmartContract(
      contractAddress,
      functionSignature,
      { feeLimit, callValue: 0 },
      args,
      callerAddress,
    );

    return {
      to: contractAddress,
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
