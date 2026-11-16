import type { TronWeb, Types } from 'tronweb';
import type { TransactionReceipt } from 'viem';
import { DefiApiError, pollUntil } from '../src';

/** Default Tron fee limit in SUN (150 TRX). Used by example scripts when constructing TronMultisigBlockchainClient. */
export const DEFAULT_FEE_LIMIT = 150_000_000;

export type EnvRecord<TKeys extends readonly string[]> = {
  [K in TKeys[number]]: string;
};

export function requireEnvVars<const TKeys extends readonly string[]>(keys: TKeys): EnvRecord<TKeys> {
  const output = {} as EnvRecord<TKeys>;

  for (const key of keys) {
    const keyName = key as TKeys[number];
    const value = process.env[keyName];
    if (!value) {
      throw new Error(`Missing required environment variable: ${keyName}`);
    }

    output[keyName] = value;
  }

  return output;
}

/** Shown in place of a converted balance when the API has no rate for the asset. */
const NO_RATE_LABEL = 'no rate';

export function formatConvertedBalance(convertedBalance: string | null, baseCurrency: string): string {
  if (convertedBalance === null) {
    return NO_RATE_LABEL;
  }
  return `${convertedBalance} ${baseCurrency.toUpperCase()}`;
}

/**
 * Throw when a mined transaction reverted. `waitForTransactionReceipt` resolves for reverted
 * transactions too, so inclusion in a block alone says nothing about the outcome.
 */
export function assertReceiptSucceeded(receipt: TransactionReceipt, label: string): void {
  if (receipt.status !== 'success') {
    throw new Error(`${label} ${receipt.transactionHash} reverted in block ${receipt.blockNumber}.`);
  }
}

const TRON_RECEIPT_TIMEOUT_MS = 120_000;
const TRON_RECEIPT_POLL_MS = 3_000;
const TRON_SUCCESS_RESULT = 'SUCCESS';

type TronBroadcastResult = Pick<Types.BroadcastReturn<Types.SignedTransaction>, 'result' | 'txid' | 'code' | 'message'>;

/** Return the transaction id of an accepted broadcast; throw when the node rejected it. */
export function assertTronBroadcast(broadcast: TronBroadcastResult, label: string): string {
  if (!broadcast.result) {
    throw new Error(`${label} was rejected by the node: ${broadcast.code} ${broadcast.message}`);
  }
  return broadcast.txid;
}

/**
 * Wait until a Tron transaction is mined and throw when it reverted. Plain TRX transfers carry no
 * `receipt.result`; only contract calls report one.
 */
export async function waitForTronReceipt(tronWeb: TronWeb, txId: string, label: string): Promise<void> {
  const info = await pollUntil(
    `receipt for ${txId}`,
    async () => {
      const found = await tronWeb.trx.getTransactionInfo(txId).catch(() => undefined);
      return found && 'blockNumber' in found && found.blockNumber ? found : undefined;
    },
    { intervalMs: TRON_RECEIPT_POLL_MS, timeoutMs: TRON_RECEIPT_TIMEOUT_MS },
  );

  if (info.receipt?.result && info.receipt.result !== TRON_SUCCESS_RESULT) {
    throw new Error(`${label} ${txId} reverted on-chain: ${info.receipt.result}`);
  }
}

const GAS_BUFFER_NUMERATOR = 13n;
const GAS_BUFFER_DENOMINATOR = 10n;

/**
 * Pad an estimated gas limit by 30%. viem sends transactions with the raw `estimateGas` result and no
 * headroom; a claim/execute whose real path touches cold storage can exceed that estimate at mine-time
 * and revert out-of-gas. The padded limit only raises the ceiling — unused gas is refunded.
 */
export function bufferGas(estimate: bigint): bigint {
  return (estimate * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;
}

export function parseChainId(value: string): string {
  const chainId = Number.parseInt(value, 10);

  if (Number.isNaN(chainId)) {
    throw new Error(`Invalid CHAIN_ID value: ${value}`);
  }

  return chainId.toString();
}

export function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;

  if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
    throw new Error('WALLET_PRIVATE_KEY must be a 32-byte hex string.');
  }

  return withPrefix as `0x${string}`;
}

export function runMain(main: () => Promise<void>) {
  main().catch((error) => {
    if (error instanceof DefiApiError) {
      console.error(`API error ${error.status} at ${error.url}:`, error.body);
    }

    console.error(error);
    process.exitCode = 1;
  });
}
