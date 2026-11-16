import type { Abi, Account, Hex, PublicClient, TypedDataDomain } from 'viem';
import { encodeFunctionData, zeroAddress } from 'viem';
import type { ContractAbi } from '../abi-provider';
import type { ChainIdentifier } from '../api/defi-client';
import { DefiSdkError } from '../errors';
import { toEvmAddress } from '../utils/address-input';
import type { ExecutableQueueOperation, PreparedTransaction } from '../utils/transactions/builders';
import { buildExecuteOperationsTransaction, ensureHexPrefix, normalizeCalls } from '../utils/transactions/builders';
import type { ExecuteTypedDataPayload, SignableQueueOperation } from '../utils/transactions/eip712';
import {
  buildExecuteTypedData,
  buildExecuteTypedMessage,
  createExecuteTypedData as createExecuteTypedDataUtil,
} from '../utils/transactions/eip712';

export interface MultisigBlockchainClientOptions {
  chainId: ChainIdentifier;
  publicClient: PublicClient;
  contractAbi: ContractAbi;
}

export interface CreateExecuteTypedDataArgs {
  /** The multisig contract — `account.contract` from `DefiClient.getAccount()`. */
  contractAddress: string;
  operation: SignableQueueOperation;
  domainOverride?: TypedDataDomain;
}

export interface BuildExecuteTransactionArgs {
  contractAddress: string;
  operations: ExecutableQueueOperation[];
}

export interface BuildClaimCalldataArgs {
  /** Token to claim; `null` (a native currency's `address`) claims the native coin. */
  erc20: string | null;
  /** `invoiceNonce` of every claimable deposit to sweep — `ClaimItem.invoiceNonce`. */
  depositIds: string[];
  /** Recipient; omit to claim into the multisig contract itself. */
  to?: string;
}

export interface SignExecuteTypedDataArgs {
  account: Account & {
    signTypedData?: (parameters: ExecuteTypedDataPayload) => Promise<Hex>;
  };
  typedData: ExecuteTypedDataPayload;
}

export class MultisigBlockchainClient {
  private readonly publicClientInstance: PublicClient;
  private readonly chainIdNumber: number;
  private readonly abi: Abi;

  constructor(options: MultisigBlockchainClientOptions) {
    this.chainIdNumber = Number(options.chainId);
    this.publicClientInstance = options.publicClient;
    this.abi = options.contractAbi.abi;
  }

  async createExecuteTypedData(args: CreateExecuteTypedDataArgs): Promise<ExecuteTypedDataPayload> {
    if (args.domainOverride) {
      const message = buildExecuteTypedMessage({
        calls: normalizeCalls(args.operation.calls),
        nonce: args.operation.nonce,
      });

      return buildExecuteTypedData({ domain: args.domainOverride, message });
    }

    return createExecuteTypedDataUtil({
      contractAddress: toEvmAddress(args.contractAddress, 'contractAddress'),
      operation: args.operation,
      publicClient: this.publicClientInstance,
      abi: this.abi,
    });
  }

  buildExecuteTransaction(args: BuildExecuteTransactionArgs): PreparedTransaction {
    return buildExecuteOperationsTransaction({
      contractAddress: toEvmAddress(args.contractAddress, 'contractAddress'),
      chainId: this.chainIdNumber,
      operations: args.operations,
      abi: this.abi,
    });
  }

  buildClaimCalldata(args: BuildClaimCalldataArgs): Hex {
    if (args.depositIds.length === 0) {
      throw new DefiSdkError('No claimable deposits found for the specified parameters.');
    }

    const erc20 = args.erc20 === null ? zeroAddress : toEvmAddress(args.erc20, 'erc20');
    const depositIds = args.depositIds.map(ensureHexPrefix);

    if (args.to === undefined) {
      return encodeFunctionData({ abi: this.abi, functionName: 'claim', args: [erc20, depositIds] });
    }

    const to = toEvmAddress(args.to, 'to');
    return encodeFunctionData({ abi: this.abi, functionName: 'claimTo', args: [erc20, to, depositIds] });
  }
}
