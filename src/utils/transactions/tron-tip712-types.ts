import type { TronWeb } from 'tronweb';
import type { Abi, Hex } from 'viem';
import type { TronAddress } from '../tron-types';

export const TRON_EXECUTE_TIP712_TYPES = {
  Execute: [
    { name: 'calls', type: 'Call[]' },
    { name: 'nonce', type: 'uint256' },
  ],
  Call: [
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'data', type: 'bytes' },
  ],
} as const;

export const TRON_EXECUTE_PRIMARY_TYPE = 'Execute' as const;

export interface TronExecuteTypedCall {
  to: TronAddress;
  value: bigint;
  data: string;
}

export interface TronExecuteTypedMessage {
  calls: TronExecuteTypedCall[];
  nonce: bigint;
}

export interface TronExecuteTypedDataPayload {
  readonly domain: {
    readonly name: string;
    readonly version: string;
    readonly chainId: bigint;
    readonly verifyingContract: TronAddress;
  };
  readonly types: typeof TRON_EXECUTE_TIP712_TYPES;
  readonly primaryType: typeof TRON_EXECUTE_PRIMARY_TYPE;
  readonly message: TronExecuteTypedMessage;
}

export interface FetchTronExecuteTypedDataDomainParams {
  tronWeb: TronWeb;
  contractAddress: TronAddress;
  abi: Abi;
}

/**
 * TronWeb-compatible typed data structure where BigInt values are converted
 * to plain types (number/string) for `TronWeb.trx._signTypedData()`.
 */
export interface TronSignableTypedData {
  domain: { name: string; version: string; chainId: string; verifyingContract: string };
  types: Record<string, Array<{ name: string; type: string }>>;
  message: { calls: Array<{ to: string; value: string; data: string }>; nonce: string };
}

export interface TronSignatureEntry {
  readonly signer: TronAddress;
  readonly signature: Hex;
}
