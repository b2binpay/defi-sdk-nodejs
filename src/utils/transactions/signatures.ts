import { type Address, bytesToHex, concatHex, type Hex, hexToBytes } from 'viem';
import { CONTRACT_VERSION_LEGACY } from './contract-versions';

export interface SignatureEntry {
  /** Signer address */
  readonly user: Address;
  /** Hex-encoded signature */
  readonly sign: Hex;
}

/**
 * Packs an array of signatures into a single hex blob using the format appropriate
 * for the given contract version.
 *
 * - **v1.0.0**: Simple concatenation of 65-byte ECDSA signatures.
 * - **v1.1.0 and later** (v1.1.0, v1.2.0, …): Packed binary format
 *   `[signer:20 bytes][sigLen:2 bytes uint16 BE][sig:sigLen bytes]` per entry,
 *   sorted by signer address in strictly ascending order. ERC-1271 contract
 *   signatures use the same envelope with a non-65-byte inner signature.
 */
export function packSignatures(signatures: ReadonlyArray<SignatureEntry>, contractVersion: string): Hex {
  if (contractVersion === CONTRACT_VERSION_LEGACY) {
    return packSignaturesV1(signatures);
  }

  return packSignaturesV1_1(signatures);
}

/**
 * v1.0.0 signature packing: simple concatenation of raw signatures.
 */
function packSignaturesV1(signatures: ReadonlyArray<SignatureEntry>): Hex {
  return concatHex(signatures.map((sig) => sig.sign as Hex));
}

/**
 * v1.1.0+ signature packing: packed binary format with explicit signer addresses.
 *
 * Format per entry: `[signer:20 bytes][sigLen:2 bytes uint16 BE][sig:sigLen bytes]`
 * Entries are sorted by signer address in strictly ascending order.
 */
function packSignaturesV1_1(signatures: ReadonlyArray<SignatureEntry>): Hex {
  const uniqueSigners = new Set(signatures.map((s) => s.user.toLowerCase()));
  if (uniqueSigners.size !== signatures.length) {
    throw new Error('Duplicate signer addresses detected in signatures array');
  }

  const sorted = [...signatures].sort((a, b) => {
    const addrA = a.user.toLowerCase();
    const addrB = b.user.toLowerCase();
    return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
  });

  const parts: Uint8Array[] = [];

  for (const entry of sorted) {
    const addressBytes = hexToBytes(entry.user);
    const sigBytes = hexToBytes(entry.sign);

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
