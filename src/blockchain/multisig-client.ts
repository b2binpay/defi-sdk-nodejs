import type { Abi, Account, Address, Hex, PublicClient, TypedDataDomain } from 'viem';
import { encodeFunctionData } from 'viem';
import type { QueueOperationResponseDto } from '../../generated-contracts';
import type { AbiCacheEntry } from '../abi-provider';
import type { PreparedTransaction } from '../utils/transactions/builders';
import { buildExecuteOperationsTransaction, ensureHexPrefix, normalizeCalls } from '../utils/transactions/builders';
import type { ExecuteTypedDataPayload } from '../utils/transactions/eip712';
import {
  buildExecuteTypedData,
  buildExecuteTypedMessage,
  createExecuteTypedData as createExecuteTypedDataUtil,
} from '../utils/transactions/eip712';

export interface MultisigBlockchainClientOptions {
  chainId: string;
  publicClient: PublicClient;
  contractAbi: AbiCacheEntry;
}

export interface CreateExecuteTypedDataArgs {
  contractAddress: Address;
  operation: QueueOperationResponseDto;
  domainOverride?: TypedDataDomain;
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
      contractAddress: args.contractAddress,
      operation: args.operation,
      publicClient: this.publicClientInstance,
      abi: this.abi,
    });
  }

  buildExecuteTransaction(params: {
    contractAddress: string;
    operations: QueueOperationResponseDto[];
  }): PreparedTransaction {
    return buildExecuteOperationsTransaction({
      contractAddress: params.contractAddress as Address,
      chainId: this.chainIdNumber,
      operations: params.operations,
      abi: this.abi,
    });
  }

  buildClaimCalldata(params: { erc20: Address; depositAccountIds: Array<string>; to?: Address }): Hex {
    const depositIds = params.depositAccountIds.map(ensureHexPrefix);
    return encodeFunctionData({
      abi: this.abi,
      functionName: params.to ? 'claimTo' : 'claim',
      args: params.to ? [params.erc20, params.to, depositIds] : [params.erc20, depositIds],
    });
  }
}
