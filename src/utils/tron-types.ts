import { TronWeb } from 'tronweb';
import { zeroAddress } from 'viem';

/** Branded type for Tron Base58Check addresses */
export type TronAddress = string & { readonly __brand: 'TronAddress' };

export const TRON_ADDRESS_PREFIX = 'T';
export const TRON_ADDRESS_LENGTH = 34;

/** Tron zero address — EVM zeroAddress converted to Tron format (0x → 41 prefix). Used for native TRX in claim calls. */
export const TRON_ZERO_ADDRESS = TronWeb.address.fromHex(zeroAddress.replace('0x', '41')) as TronAddress;
