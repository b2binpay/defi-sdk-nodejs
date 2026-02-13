import { ResponseError } from '../generated-contracts';

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
  main().catch(async (error) => {
    if (error instanceof ResponseError) {
      try {
        const body = await error.response.clone().json();
        console.error('API error payload:', body);
      } catch {
        // Ignore JSON parsing errors; original error will still be logged below.
      }
    }

    console.error(error);
    process.exitCode = 1;
  });
}
