/**
 * Tron: Create invoice use case:
 * - Authenticate via API key and select a Tron chain/deployment.
 * - Find TRC-20 currency by symbol scoped to the Tron chain.
 * - Create an invoice with requested amount and tracking ID.
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

  const currency = await client.findCurrencyBySymbol({ symbol: 'USDT' });

  const invoice = await client.createInvoice({
    requestedAmount: '100.56',
    trackingId: `TRON-EXAMPLE-${Date.now()}`,
    callbackUrl: null,
    paymentPageButtonUrl: null,
    paymentPageButtonText: null,
    currencyIds: [currency.id],
  });

  console.log('Created Tron invoice:');
  console.table({
    id: invoice.id,
    currencies: invoice.availableCurrencies.map((c) => c.symbol).join(', '),
    amount: invoice.requestedAmount ?? 'N/A',
    status: invoice.status,
    trackingId: invoice.trackingId,
    paymentPageUrl: invoice.paymentPageUrl,
    invoiceAddress: invoice.invoiceAddress,
  });
});
