/**
 * Operations history (v2) use case:
 * - Authenticate via API key and select a chain.
 * - List operations (optionally filtered by type) and fetch typed details for one.
 */
import 'dotenv/config';
import { DefiClient, OperationTypeV2 } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });

  await client.selectChain(chainId);

  const operations = await client.getOperationsV2({ pageSize: 10 });
  console.log(`Operations (page 1 of ${operations.total} total):`);
  console.table(
    operations.items.map((op) => ({
      id: op.id,
      operationType: op.operationType,
      status: op.status,
    })),
  );

  const payouts = await client.getOperationsV2({ types: [OperationTypeV2.Payout], pageSize: 5 });
  console.log(`Payout operations: ${payouts.total}`);

  const first = operations.items[0];
  if (first) {
    const details = await client.getOperationDetailsV2({
      type: first.operationType as OperationTypeV2,
      operationId: first.id,
    });
    console.log('Details for first operation:');
    console.log(JSON.stringify(details, null, 2));
  }
});
