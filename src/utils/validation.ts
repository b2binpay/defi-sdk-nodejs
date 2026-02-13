import type { Address } from 'viem';
import { getAddress, isAddress } from 'viem';
import type { CurrencyResponseDto } from '../../generated-contracts';

export interface ValidateAddressAsset {
  currencyId: string;
  chainId?: string | number;
}

export interface ValidateAddressParams {
  address: string;
  networkChainId?: string | number;
  currency?: Pick<CurrencyResponseDto, 'id' | 'chainId'>;
  assets?: ValidateAddressAsset[];
  allowedNetworks?: Array<string | number>;
}

export interface ValidateAddressResult {
  isValid: boolean;
  errors: string[];
  normalizedAddress?: Address;
}

const normalizeChainId = (value?: string | number): string | undefined => {
  if (value == null) {
    return undefined;
  }

  return typeof value === 'number' ? value.toString() : value;
};

export function validateAddress(params: ValidateAddressParams): ValidateAddressResult {
  const errors: string[] = [];
  let normalizedAddress: Address | undefined;

  if (!params.address) {
    errors.push('Address is required.');
  } else if (!isAddress(params.address)) {
    errors.push('Address must be a valid EVM address.');
  } else {
    normalizedAddress = getAddress(params.address);
  }

  const requestedChainId = normalizeChainId(params.networkChainId);

  if (params.currency && requestedChainId && params.currency.chainId !== requestedChainId) {
    errors.push(`Currency ${params.currency.id} is not available on chain ${requestedChainId}.`);
  }

  if (params.allowedNetworks && requestedChainId) {
    const allowedChains = params.allowedNetworks.map((chainId) => normalizeChainId(chainId));
    if (!allowedChains.includes(requestedChainId)) {
      errors.push(`Chain ${requestedChainId} is not allowed for this operation.`);
    }
  }

  const currency = params.currency;

  if (params.assets && currency) {
    const matchesAsset = params.assets.some((asset) => {
      const assetChain = normalizeChainId(asset.chainId);
      return asset.currencyId === currency.id || (assetChain && assetChain === currency.chainId);
    });

    if (!matchesAsset) {
      errors.push(`Currency ${currency.id} is not part of the allowed asset list.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    normalizedAddress,
  };
}
