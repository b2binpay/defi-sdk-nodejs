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
    amount: '0.001',
    recipient: env.PAYOUT_RECIPIENT,
    callbackUrl: undefined,
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
    callbackUrl: payoutDetails.callbackUrl,
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

  const queue = await client.getDeploymentQueue({ pageSize: 100 });
  const operation = queue.items.find((item) => item.operationType === 'PAYOUT' && item.payload?.payoutId === payout.id);
  if (!operation) {
    throw new Error(`Payout operation for ${payout.id} not found in queue (queue size ${queue.items.length}).`);
  }

  console.log('Next step: sign operation', operation.id, 'and execute when ready.');
});
