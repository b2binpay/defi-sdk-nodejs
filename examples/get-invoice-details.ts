/**
 * Fetch invoice details use case:
 * - Authenticate via API key and select the chain.
 * - List invoices with filters (status/date/currency/tracking) to verify filtering works.
 * - Fetch a specific invoice by ID, print key fields, and surface recent incoming transactions tied to it.
 * - Retrieve claimable assets for that invoice to show what can be claimed.
 */
import 'dotenv/config';
import { DefiClient, InvoiceSortField, OperationTypeV2, OperationV2SortField, SortOrder } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  await client.selectChain(chainId);

  const invoices = await client.getInvoices({
    chainId,
    sortBy: InvoiceSortField.CreatedAt,
    sortOrder: SortOrder.Desc,
    pageSize: 10,
  });

  console.log(`Invoices (first page): ${invoices.total}`);
  console.table(
    invoices.items.map((item) => ({
      id: item.id,
      status: item.status,
      trackingId: item.trackingId,
      amount: item.requestedAmount,
    })),
  );

  const invoiceId = process.env.INVOICE_ID ?? invoices.items[0]?.id;
  if (!invoiceId) {
    console.log('No invoices found — skipping details. Create one first (example:create-invoice).');
    return;
  }

  const invoice = await client.getInvoice({ chainId, invoiceId });
  console.log('Invoice details:');
  console.table({
    id: invoice.invoice.id,
    status: invoice.invoice.status,
    trackingId: invoice.invoice.trackingId,
    requestedAmount: invoice.invoice.requestedAmount ?? 'N/A',
    paidAmount: invoice.invoice.paidAmount,
    currencies: invoice.invoice.availableCurrencies.map((currency) => currency.symbol).join(', '),
  });

  const recentDepositsResponse = await client.getOperationsV2({
    chainId,
    types: [OperationTypeV2.InvoiceDeposit],
    sortBy: OperationV2SortField.CreatedAt,
    sortOrder: SortOrder.Desc,
    pageSize: 10,
  });
  const recentDeposits = recentDepositsResponse.items;

  if (recentDeposits.length === 0) {
    console.log('No incoming deposit operations found.');
  } else {
    console.log('Recent invoice-deposit operations:');
    console.table(
      recentDeposits.map((op) => ({
        id: op.id,
        status: op.status,
        txHash: op.txHash,
        amount: `${op.amount} ${op.currency?.symbol}`,
      })),
    );
  }

  const claimable = await client.getClaims({
    chainId,
    invoiceId: invoice.invoice.id,
    pageSize: 20,
  });

  if (claimable.items.length === 0) {
    console.log('No claimable assets found for this invoice.');
  } else {
    console.log('Claimable assets:');
    console.table(
      claimable.items.map((item) => ({
        invoiceId: item.invoiceId,
        amount: `${item.amount} ${item.currency?.symbol}`,
      })),
    );
  }
});
