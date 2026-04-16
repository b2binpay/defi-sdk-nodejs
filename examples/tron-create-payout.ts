/**
 * Tron: Create payout use case:
 * - Authenticate via API key and select a Tron chain/deployment.
 * - Resolve TRC-20 currency and create a payout to a Tron address.
 * - Show associated queue operation for follow-up signing/execution.
 */
import 'dotenv/config';
import { DefiClient } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'PAYOUT_RECIPIENT'] as const;

const PAYOUT_CURRENCY_SYMBOL = 'USDT';
const PAYOUT_AMOUNT = '1.00';

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });

  const deployment = await client.selectChain(chainId);
  console.log('Using Tron deployment:', deployment.deploymentId);

  const currency = await client.findCurrencyBySymbol({ symbol: PAYOUT_CURRENCY_SYMBOL });

  const payout = await client.createPayout({
    currencyId: currency.id,
    amount: PAYOUT_AMOUNT,
    recipient: env.PAYOUT_RECIPIENT,
    callbackUrl: undefined,
    trackingId: undefined,
  });

  const payoutDetails = await client.getPayout({ payoutId: payout.id });

  console.log('Tron payout details:');
  console.table({
    id: payoutDetails.id,
    status: payoutDetails.status,
    amount: payoutDetails.amount,
    currency: payoutDetails.currency.symbol,
    queueOperationId: payoutDetails.queueOperationId,
  });

  const queue = await client.getDeploymentQueue({ pageSize: 100 });
  const operation = queue.items.find((item) => item.operationType === 'PAYOUT' && item.payload?.payoutId === payout.id);
  if (!operation) {
    throw new Error(`Payout operation for ${payout.id} not found in queue.`);
  }

  console.log('Next step: sign operation', operation.id, 'and execute when ready.');
});
