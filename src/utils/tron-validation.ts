import { TronWeb } from 'tronweb';
import { TRON_ADDRESS_LENGTH, TRON_ADDRESS_PREFIX, type TronAddress } from './tron-types';

export { TRON_ADDRESS_LENGTH, TRON_ADDRESS_PREFIX, TRON_ZERO_ADDRESS, type TronAddress } from './tron-types';

export enum NetworkType {
  EVM = 'evm',
  TVM = 'tvm',
}

export interface ValidateTronAddressParams {
  address: string;
}

export interface ValidateTronAddressResult {
  isValid: boolean;
  errors: string[];
  normalizedAddress?: TronAddress;
}

/** Converts a Tron Base58Check address (T...) to a 20-byte EVM hex address (0x...). */
export function tronToEvmHex(address: string): `0x${string}` {
  return `0x${TronWeb.address.toHex(address).slice(2)}`;
}

export function validateTronAddress(params: ValidateTronAddressParams): ValidateTronAddressResult {
  const errors: string[] = [];

  if (!params.address) {
    return { isValid: false, errors: ['Address is required.'], normalizedAddress: undefined };
  }

  if (params.address.length !== TRON_ADDRESS_LENGTH || !params.address.startsWith(TRON_ADDRESS_PREFIX)) {
    errors.push('Address must be a valid Tron Base58Check address (T-prefix, 34 chars).');
    return { isValid: false, errors, normalizedAddress: undefined };
  }

  if (!TronWeb.isAddress(params.address)) {
    errors.push('Address must be a valid Tron Base58Check address (T-prefix, 34 chars).');
    return { isValid: false, errors, normalizedAddress: undefined };
  }

  return {
    isValid: true,
    errors: [],
    normalizedAddress: params.address as TronAddress,
  };
}
