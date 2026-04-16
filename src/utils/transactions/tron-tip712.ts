import { TronWeb } from 'tronweb';
import { bytesToHex, concatHex, type Hex, hexToBytes } from 'viem';
import type { TronAddress } from '../tron-types';
import { tronToEvmHex } from '../tron-validation';
import {
  type FetchTronExecuteTypedDataDomainParams,
  TRON_EXECUTE_PRIMARY_TYPE,
  TRON_EXECUTE_TIP712_TYPES,
  type TronExecuteTypedCall,
  type TronExecuteTypedDataPayload,
  type TronSignableTypedData,
  type TronSignatureEntry,
} from './tron-tip712-types';

export * from './tron-tip712-types';

/**
 * Converts an EVM hex address (0x...) to a Tron Base58Check address (T...).
 * Used when building TIP-712 typed data where address fields must be in Tron format.
 */
function hexToTronAddress(hexAddress: string): TronAddress {
  // If already a Tron base58 address, return as-is
  if (hexAddress.startsWith('T')) return hexAddress as TronAddress;
  // Convert 0x-prefixed EVM hex to 41-prefixed Tron hex, then to base58
  const tronHex = `41${hexAddress.replace(/^0x/, '')}`;
  return TronWeb.address.fromHex(tronHex) as TronAddress;
}

export function buildTronExecuteTypedData(params: {
  domain: TronExecuteTypedDataPayload['domain'];
  calls: ReadonlyArray<TronExecuteTypedCall>;
  nonce: bigint;
}): TronExecuteTypedDataPayload {
  return {
    domain: params.domain,
    primaryType: TRON_EXECUTE_PRIMARY_TYPE,
    types: TRON_EXECUTE_TIP712_TYPES,
    message: {
      calls: params.calls.map((call) => ({
        to: hexToTronAddress(call.to),
        value: call.value,
        data: call.data,
      })),
      nonce: params.nonce,
    },
  };
}

export async function fetchTronExecuteTypedDataDomain(
  params: FetchTronExecuteTypedDataDomainParams,
): Promise<TronExecuteTypedDataPayload['domain']> {
  const { tronWeb, contractAddress, abi } = params;

  const contract = tronWeb.contract(abi as Parameters<typeof tronWeb.contract>[0], contractAddress);
  const domainTuple = await contract.eip712Domain().call();

  return {
    name: domainTuple[1] as string,
    version: domainTuple[2] as string,
    chainId: BigInt(domainTuple[3] as string),
    verifyingContract: domainTuple[4] as TronAddress,
  };
}

/**
 * Prepares TIP-712 typed data for signing with TronWeb.trx._signTypedData().
 * Converts BigInt values to plain types compatible with TronWeb's signing method:
 * - domain.chainId: bigint → number
 * - message.nonce and call values: bigint → string
 */
export function prepareTronTypedDataForSigning(typedData: TronExecuteTypedDataPayload): TronSignableTypedData {
  return {
    domain: {
      ...typedData.domain,
      chainId: typedData.domain.chainId.toString(),
      verifyingContract: typedData.domain.verifyingContract as string,
    },
    types: typedData.types as unknown as Record<string, Array<{ name: string; type: string }>>,
    message: {
      calls: typedData.message.calls.map((call) => ({
        to: call.to as string,
        value: call.value.toString(),
        data: call.data,
      })),
      nonce: typedData.message.nonce.toString(),
    },
  };
}

export function packTronSignatures(signatures: ReadonlyArray<TronSignatureEntry>, contractVersion: string): Hex {
  switch (contractVersion) {
    case '1.0.0':
      return packTronSignaturesV1(signatures);
    case '1.1.0':
      return packTronSignaturesV1_1(signatures);
    default:
      console.warn(
        `[defi-sdk] Unknown contract version "${contractVersion}" in packTronSignatures. ` +
          'Using v1.1.0 signature format as fallback.',
      );
      return packTronSignaturesV1_1(signatures);
  }
}

function packTronSignaturesV1(signatures: ReadonlyArray<TronSignatureEntry>): Hex {
  if (signatures.length === 0) return '0x' as Hex;
  return concatHex(signatures.map((s) => s.signature));
}

function packTronSignaturesV1_1(signatures: ReadonlyArray<TronSignatureEntry>): Hex {
  if (signatures.length === 0) return '0x' as Hex;

  // Pre-compute hex keys to avoid repeated base58 decoding in sort comparator
  const withHex = signatures.map((entry) => ({
    entry,
    evmHex: tronToEvmHex(entry.signer),
  }));
  withHex.sort((a, b) => {
    const hexA = a.evmHex.toLowerCase();
    const hexB = b.evmHex.toLowerCase();
    return hexA < hexB ? -1 : hexA > hexB ? 1 : 0;
  });

  const parts: Uint8Array[] = [];

  for (const { entry, evmHex } of withHex) {
    const addressBytes = hexToBytes(evmHex);
    const sigBytes = hexToBytes(entry.signature);

    const lenBytes = new Uint8Array(2);
    new DataView(lenBytes.buffer).setUint16(0, sigBytes.length, false);

    parts.push(addressBytes, lenBytes, sigBytes);
  }

  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return bytesToHex(result);
}
