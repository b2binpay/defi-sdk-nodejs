import type { Account, Address, Hex, PublicClient, TypedDataDomain } from 'viem';
import { encodeFunctionData } from 'viem';
import type { CallDto, QueueOperationResponseDto } from '../../generated-contracts';
import { MULTI_SIG_WALLET_ABI } from '../abi';
import type { PreparedTransaction } from '../utils/transactions/builders';
import { buildExecuteOperationsTransaction } from '../utils/transactions/builders';
import type { ExecuteTypedDataPayload } from '../utils/transactions/eip712';
import {
  buildExecuteTypedData,
  buildExecuteTypedMessage,
  createExecuteTypedData as createExecuteTypedDataUtil,
} from '../utils/transactions/eip712';

export interface MultisigBlockchainClientOptions {
  chainId: string;
  publicClient: PublicClient;
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

  constructor(options: MultisigBlockchainClientOptions) {
    this.chainIdNumber = Number(options.chainId);

    this.publicClientInstance = options.publicClient;
  }

  async createExecuteTypedData(args: CreateExecuteTypedDataArgs): Promise<ExecuteTypedDataPayload> {
    if (args.domainOverride) {
      const message = buildExecuteTypedMessage({
        calls: this.normalizeCalls(args.operation.calls),
        nonce: args.operation.nonce,
      });

      return buildExecuteTypedData({ domain: args.domainOverride, message });
    }

    return createExecuteTypedDataUtil({
      contractAddress: args.contractAddress,
      operation: args.operation,
      publicClient: this.publicClientInstance,
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
    });
  }

  buildClaimCalldata(params: { erc20: Address; depositAccountIds: Array<string>; to?: Address }): Hex {
    const depositIds = params.depositAccountIds.map((id) => `0x${id.replace(/^0x/, '')}` as `0x${string}`);
    return encodeFunctionData({
      abi: MULTI_SIG_WALLET_ABI,
      functionName: params.to ? 'claimTo' : 'claim',
      args: params.to ? [params.erc20, params.to, depositIds] : [params.erc20, depositIds],
    });
  }

  private normalizeCalls(calls: CallDto[]): Array<{ to: string; value: string | number | bigint; data: string }> {
    return calls.map((call) => ({
      to: call.to,
      value: call.value ?? '0',
      data: call.data ?? '0x',
    }));
  }
}
