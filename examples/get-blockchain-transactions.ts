/**
 * Blockchain transactions use case:
 * - Authenticate via API key and select a chain.
 * - List blockchain transactions and fetch a single one by id.
 */
import 'dotenv/config';
import { DefiClient } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });

  await client.selectChain(chainId);

  const transactions = await client.getBlockchainTransactions({ pageSize: 10 });
  console.log(`Blockchain transactions (page 1 of ${transactions.total} total):`);
  console.table(
    transactions.items.map((tx) => ({
      id: tx.id,
      status: tx.status,
      txHash: tx.txHash,
      blockNumber: tx.blockNumber,
      // `value` and `blockchainFee` are the raw base-unit fields and are deprecated;
      // the formatted pair is already scaled to the chain's native decimals.
      value: tx.valueFormatted,
      fee: tx.blockchainFeeFormatted,
    })),
  );

  const first = transactions.items[0];
  if (first) {
    const details = await client.getBlockchainTransaction({ transactionId: first.id });
    console.log('Details for first transaction:');
    console.log(JSON.stringify(details, null, 2));
  }
});
