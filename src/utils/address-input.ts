import { TronWeb } from 'tronweb';
import { type Address, getAddress, isAddress } from 'viem';
import { DefiSdkError } from '../errors';
import { TRON_ADDRESS_PREFIX, type TronAddress } from './tron-types';

/** Narrows an API-supplied string (e.g. `account.contract`) to a checksummed EVM address, or throws. */
export function toEvmAddress(value: string, field: string): Address {
  if (!isAddress(value, { strict: false })) {
    throw new DefiSdkError(`${field} is not a valid EVM address: ${value}`);
  }
  return getAddress(value);
}

function isTronAddress(value: string): value is TronAddress {
  return value.startsWith(TRON_ADDRESS_PREFIX) && TronWeb.isAddress(value);
}

/** Narrows an API-supplied string to a Base58Check TRON address, or throws. */
export function toTronAddress(value: string, field: string): TronAddress {
  if (!isTronAddress(value)) {
    throw new DefiSdkError(`${field} is not a valid TRON address: ${value}`);
  }
  return value;
}
