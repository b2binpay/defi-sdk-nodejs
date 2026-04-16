# API Client

`DefiClient` (`src/api/defi-client.ts`) is the main entry point for all REST API interactions. It wraps the generated OpenAPI client with a developer-friendly interface.

## Configuration

```ts
import { DefiClient } from '@b2binpay/defi-sdk';

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});
```

All constructor options:

| Option                 | Required | Description                                             |
|------------------------|----------|---------------------------------------------------------|
| `baseUrl`              | yes      | REST endpoint base URL                                  |
| `apiKey`               | yes      | Sent as `x-api-key` header on every request             |
| `fetchApi`             | no       | Custom fetch implementation (useful for testing or SSR) |
| `middleware`           | no       | OpenAPI middleware applied to every request             |
| `defaultHeaders`       | no       | Extra headers merged into every request                 |
| `credentials`          | no       | Fetch `credentials` setting                             |
| `queryParamsStringify` | no       | Custom query parameter serializer                       |
| `abiCacheDir`          | no       | Directory for persistent ABI disk cache                 |

## Authentication

`DefiClient` authenticates purely via API key. Every request automatically includes the `x-api-key` header — no token exchange, nonce signing, or refresh is required.

Each API key is scoped to a single account. The SDK resolves and caches the account internally; you never need to pass `accountId` to any method.

## Account & Deployment Management

```ts
// Fetch account details (account metadata + deployments)
const accountDetails = await client.getAccount();

// Resolve deployments
const deployments = await client.getDeployments(accountDetails);

// Cache the deployment for a chain — subsequent chain-scoped calls omit chainId
const deployment = await client.selectChain(1);

// Retrieve the cached deployment without selecting a new one
const cached = client.getSelectedDeployment();

// Resolve a specific deployment without affecting the cache
const sepolia = await client.getDeploymentByChain(11155111);
```

## Contract ABI

`getContractAbi` fetches the multisig contract ABI for the selected deployment. The contract version (v1.0.0, v1.1.0, …) is auto-detected from the deployment and determines the signature packing format used by `submitOperationSignature`. The result is cached in memory; pass `abiCacheDir` at construction to also persist it to disk across restarts.

```ts
// Uses the version associated with the selected deployment (call selectChain first)
const contractAbi = await client.getContractAbi();

// Or request a specific version explicitly
const contractAbi = await client.getContractAbi('1.0.0');
```

Pass the result directly to `MultisigBlockchainClient` or `TronMultisigBlockchainClient`.

## Balances & Assets

```ts
import { FiatCurrency, AssetSortField, SortOrder } from '@b2binpay/defi-sdk';

// Fiat-converted totals for a chain
const summary = await client.getAccountBalanceSummary({ chainId: 1, baseCurrency: FiatCurrency.Usd });

// Paginated asset balances
const assets = await client.getAssetBalances({
  chainId: 1,
  baseCurrency: FiatCurrency.Usd,
  sortField: AssetSortField.Balance,
  sortOrder: SortOrder.Desc,
  pageSize: 20,
});
```

## Currencies

```ts
// All supported currencies on all chains
const currencies = await client.getCurrencies();

// Native coin for a chain (address === null)
const eth = await client.getNativeCurrency(1);

// Lookup by ticker (throws if zero or multiple matches)
const usdt = await client.findCurrencyBySymbol({ symbol: 'USDT', chainId: 1 });
```

> **Note (TRON):** On TRON, `getCurrencies()` may return stale EVM-format entries. Use `getNativeCurrency(chainId)` to get TRX reliably.

## Invoices

```ts
import { InvoiceStatus } from '@b2binpay/defi-sdk';

// Create
const invoice = await client.createInvoice({
  requestedAmount: '100',
  currencyIds: [usdt.id],
  callbackUrl: 'https://merchant.example/webhook',
  trackingId: 'order-42',
  // chainId: 1  — uses selected chain if omitted
});

// List with filters
const open = await client.getInvoices({
  statuses: [InvoiceStatus.Created],
  pageSize: 20,
  createdFrom: new Date('2024-01-01'),
});

// Fetch details
const details = await client.getInvoice({ invoiceId: invoice.id });

// Update (cancel, patch amount or callback URL)
await client.updateInvoice({
  invoiceId: invoice.id,
  status: InvoiceStatus.Cancelled,
});
```

## Payouts

```ts
import { PayoutStatus } from '@b2binpay/defi-sdk';

// Create — enqueues a multisig operation
const payout = await client.createPayout({
  currencyId: usdt.id,
  amount: '50',
  recipient: '0xRecipientAddress',
  trackingId: 'payout-001',
  callbackUrl: 'https://merchant.example/webhook',
});

// List
const payouts = await client.getPayouts({ statuses: [PayoutStatus.Created] });

// Fetch with on-chain metadata
const details = await client.getPayout({ payoutId: payout.id });

// Update metadata
await client.updatePayout({ payoutId: payout.id, trackingId: 'payout-001-v2' });
```

## Deployment Queue & Signatures

```ts
import { QueueOperationStatus } from '@b2binpay/defi-sdk';

// Fetch pending/ready operations
const queue = await client.getDeploymentQueue({});
const pending = queue.items.filter((op) => op.status === QueueOperationStatus.Pending);

// Submit a signature (raw ECDSA hex — packed automatically by the SDK)
await client.submitOperationSignature({
  operationId: operation.executeOperationId,
  signature: rawSignature,
  signerAddress: account.address, // required for v1.1.0 contracts
});
```

> **Signature packing:** The SDK automatically packs signatures to the format expected by the contract version. For v1.1.0 contracts, `signerAddress` is required. Pass the raw ECDSA hex from `signTypedData` — do not pre-pack.

## Transactions

```ts
import { TransactionOperationType } from '@b2binpay/defi-sdk';

const txList = await client.getTransactions({
  operationTypes: [TransactionOperationType.Payout],
  pageSize: 20,
});

const tx = await client.getTransaction({ transactionId: txList.items[0].id });
console.log('Claimed:', tx.isClaimed);
```

## Claims

```ts
// List claimable deposits
const claims = await client.getClaims({ pageSize: 50 });

// Currencies with claimable balances
const claimable = await client.getClaimableCurrencies();
```

Broadcasting claim transactions is done off-chain through `MultisigBlockchainClient.buildClaimCalldata` (EVM) or `TronMultisigBlockchainClient.buildClaimTransaction` (TRON). See [`examples/claim-deposits.ts`](../examples/claim-deposits.ts) and [`examples/tron-claim-deposits.ts`](../examples/tron-claim-deposits.ts).

## Error Handling

All API methods throw `ResponseError` on non-2xx responses. Parse the response body for details:

```ts
import { ResponseError } from '@b2binpay/defi-sdk';

try {
  await client.createPayout({ ... });
} catch (err) {
  if (err instanceof ResponseError) {
    const body = await err.response.json();
    console.error('API error:', body);
  }
  throw err;
}
```
