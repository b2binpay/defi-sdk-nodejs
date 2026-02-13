import type { Address, Hex, PublicClient, SignTypedDataParameters, TypedData, TypedDataDomain } from 'viem';
import type { Account } from 'viem/accounts';
import type { CallDto, QueueOperationResponseDto } from '../../../generated-contracts';
import { MULTI_SIG_WALLET_ABI } from '../../abi';

export const EXECUTE_EIP712_TYPES = {
  Execute: [
    { name: 'calls', type: 'Call[]' },
    { name: 'nonce', type: 'uint256' },
  ],
  Call: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
} as const satisfies TypedData;

export interface ExecuteTypedCall {
  to: Address;
  value: bigint;
  data: Hex;
}

export interface ExecuteTypedMessage {
  calls: ExecuteTypedCall[];
  nonce: bigint;
}

export type ExecuteTypedDataPayload = SignTypedDataParameters<typeof EXECUTE_EIP712_TYPES, 'Execute'> & {
  message: ExecuteTypedMessage;
  types: typeof EXECUTE_EIP712_TYPES;
};

export interface BuildExecuteTypedMessageInput {
  calls: Array<{ to: string; value: string | number | bigint; data: string }>;
  nonce: string | number | bigint;
}

export function buildExecuteTypedMessage(input: BuildExecuteTypedMessageInput): ExecuteTypedMessage {
  return {
    calls: input.calls.map((call) => ({
      to: call.to as Address,
      value: typeof call.value === 'bigint' ? call.value : BigInt(call.value),
      data: call.data as Hex,
    })),
    nonce: typeof input.nonce === 'bigint' ? input.nonce : BigInt(input.nonce),
  };
}

export function buildExecuteTypedData(params: {
  domain: TypedDataDomain;
  message: ExecuteTypedMessage;
}): ExecuteTypedDataPayload {
  return {
    domain: params.domain,
    primaryType: 'Execute',
    types: EXECUTE_EIP712_TYPES,
    message: params.message,
  } as ExecuteTypedDataPayload;
}

export interface CreateExecuteTypedDataParams {
  operation: QueueOperationResponseDto;
  contractAddress: Address;
  publicClient: PublicClient;
  domainOverride?: TypedDataDomain;
}

export async function createExecuteTypedData(params: CreateExecuteTypedDataParams): Promise<ExecuteTypedDataPayload> {
  const message = buildExecuteTypedMessage({
    calls: params.operation.calls.map((call: CallDto) => ({
      to: call.to,
      value: call.value ?? '0',
      data: call.data ?? '0x',
    })),
    nonce: params.operation.nonce,
  });

  const domain =
    params.domainOverride ??
    (await fetchExecuteTypedDataDomain({
      contractAddress: params.contractAddress,
      publicClient: params.publicClient,
    }));

  return buildExecuteTypedData({ domain, message });
}

export interface FetchExecuteTypedDataDomainParams {
  contractAddress: Address;
  publicClient: PublicClient;
}

export async function fetchExecuteTypedDataDomain(params: FetchExecuteTypedDataDomainParams): Promise<TypedDataDomain> {
  const { contractAddress, publicClient } = params;

  const domainTuple = await publicClient.readContract({
    address: contractAddress,
    abi: MULTI_SIG_WALLET_ABI,
    functionName: 'eip712Domain',
  });

  const domainName = domainTuple[1] as string;
  const domainVersion = domainTuple[2] as string;
  const domainChainId = domainTuple[3] as bigint;
  const verifyingContract = domainTuple[4] as Address;

  return {
    name: domainName,
    version: domainVersion,
    chainId: domainChainId,
    verifyingContract,
  };
}

export interface SignExecuteTypedDataParams {
  account: Account & {
    signTypedData?: (parameters: SignTypedDataParameters) => Promise<Hex>;
  };
  typedData: ExecuteTypedDataPayload;
}

export async function signExecuteTypedData(params: SignExecuteTypedDataParams): Promise<Hex> {
  const { account, typedData } = params;
  const signTypedData = account.signTypedData;

  if (typeof signTypedData !== 'function') {
    throw new Error('The provided account does not support typed data signing.');
  }

  return signTypedData(typedData);
}
