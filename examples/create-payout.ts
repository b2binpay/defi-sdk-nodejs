/**
 * Create payout use case:
 * - Authenticate via API key.
 * - Select chain, resolve currency, and create a payout with optional metadata.
 * - Fetch payout details and show the associated queue operation for follow-up signing/execution flows.
 */
import 'dotenv/config';
import { DefiClient } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'PAYOUT_RECIPIENT'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });

  const deployment = await client.selectChain(chainId);
  console.log('Using deployment:', deployment.deploymentId);

  const currency = await client.findCurrencyBySymbol({ symbol: 'ETH' });

  const payout = await client.createPayout({
    currencyId: currency.id,
    amount: '0.00005',
    recipient: env.PAYOUT_RECIPIENT,
    trackingId: undefined,
  });

  const payoutDetails = await client.getPayout({ payoutId: payout.id });

  console.log('Payout details:');
  console.table({
    id: payoutDetails.id,
    status: payoutDetails.status,
    amount: payoutDetails.amount,
    currency: payoutDetails.currency.symbol,
    queueOperationId: payoutDetails.queueOperationId,
    skipCallbacks: payoutDetails.skipCallbacks,
    trackingId: payoutDetails.trackingId,
  });

  const pendingPayouts = await client.getPayouts({
    statuses: [payout.status],
    pageSize: 5,
  });

  console.log('Pending payouts (first page):');
  console.table(
    pendingPayouts.items.map((p) => ({
      id: p.id,
      status: p.status,
      amount: `${p.amount} ${p.currency.symbol}`,
      recipient: p.toAddress,
    })),
  );

  if (!payout.queueOperationId) {
    throw new Error(`Payout ${payout.id} was created without a queue operation.`);
  }
  const operation = await client.getQueueOperation({ operationId: payout.queueOperationId });

  console.log(`Next step: sign operation ${operation.id} (nonce ${operation.nonce}) and execute when ready.`);
});
