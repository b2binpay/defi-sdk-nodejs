/**
 * Fetch invoice details use case:
 * - Authenticate via API key and select the chain.
 * - List invoices with filters (status/date/currency/tracking) to verify filtering works.
 * - Fetch a specific invoice by ID, print key fields, and surface recent incoming transactions tied to it.
 * - Retrieve claimable assets for that invoice to show what can be claimed.
 */
import 'dotenv/config';
import { DefiClient, InvoiceSortField, SortOrder, TransactionOperationType, TransactionSortField } from '../src';
import { parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const INVOICE_ID = '119445670120656900';

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  await client.selectChain(chainId);

  const invoices = await client.getInvoices({
    chainId,
    trackingId: 'API-EXAMPLE',
    sortBy: InvoiceSortField.CreatedAt,
    sortOrder: SortOrder.Desc,
    pageSize: 10,
  });

  console.log(`Invoices (first page, filtered): ${invoices.total}`);
  console.table(
    invoices.items.map((item) => ({
      id: item.id,
      status: item.status,
      trackingId: item.trackingId,
      amount: item.requestedAmount,
    })),
  );

  const invoice = await client.getInvoice({ chainId, invoiceId: INVOICE_ID });
  console.log('Invoice details:');
  console.table({
    id: invoice.invoice.id,
    status: invoice.invoice.status,
    trackingId: invoice.invoice.trackingId,
    requestedAmount: invoice.invoice.requestedAmount ?? 'N/A',
    paidAmount: invoice.invoice.paidAmount,
    currencies: invoice.invoice.availableCurrencies.map((currency) => currency.symbol).join(', '),
  });

  const recentDepositsResponse = await client.getTransactions({
    chainId,
    operationTypes: [TransactionOperationType.Invoice],
    operationId: invoice.invoice.id,
    sortBy: TransactionSortField.CreatedAt,
    sortOrder: SortOrder.Desc,
    pageSize: 10,
  });
  const recentDeposits = recentDepositsResponse.items;

  if (recentDeposits.length === 0) {
    console.log('No incoming transactions found for this invoice.');
  } else {
    console.log('Last incoming transactions:');
    console.table(
      recentDeposits.map((txn) => ({
        id: txn.id,
        status: txn.status,
        txHash: txn.txHash,
        amount: `${txn.amount} ${txn.currency?.symbol}`,
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
