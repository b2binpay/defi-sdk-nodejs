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
| `logger`               | no       | `{ warn(message) }` receiving SDK diagnostics; silent if omitted |

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

## Contract Capabilities

Each contract version reports what it supports. `getContractCapabilities` returns those flags from the same cache entry as `getContractAbi`, so it costs no extra request once the ABI is loaded.

```ts
const capabilities = await client.getContractCapabilities();

if (capabilities?.supportsInvoices === false) {
  // TVM accounts below v1.2.2 cannot create invoices — hide the flow instead of hitting a 400
}
```

The result is `undefined` when the API deployment does not report the flags — they were added per flag over time, so an older API omits them. Gate on an explicit `false`, never on falsiness: `!capabilities?.supportsInvoices` is also true for "unknown" and would hide a flow that works.

| Flag                | True when                                                                  |
|---------------------|----------------------------------------------------------------------------|
| `supportsInvoices`  | invoices may be created — always on EVM, TVM requires version >= 1.2.2     |
| `supportsWhitelist` | `claim()` is gated behind the whitelist (EVM + TVM, version >= 1.2.0)      |
| `supportsStaking`   | the TRON Stake 2.0 methods are exposed (TVM-only, version >= 1.2.1)        |

The API remains the authority: a gated call still returns `400` if the flags are stale, so treat these as UI/flow hints rather than a replacement for error handling.

## Balances & Assets

```ts
import { AssetSortField, AssetSortOrder, FiatCurrency } from '@b2binpay/defi-sdk';

// Fiat-converted totals for a chain
const summary = await client.getAccountBalanceSummary({ chainId: 1, baseCurrency: FiatCurrency.Usd });

// Paginated asset balances
const assets = await client.getAssetBalances({
  chainId: 1,
  baseCurrency: FiatCurrency.Usd,
  sortBy: AssetSortField.Balance,
  sortOrder: AssetSortOrder.Desc,
  pageSize: 20,
});
```

## Currencies

```ts
// All supported currencies on all chains
const currencies = await client.getCurrencies();

// Native coin for a chain (address === null)
const eth = await client.getNativeCurrency({ chainId: 1 });

// Lookup by ticker (throws if zero or multiple matches)
const usdt = await client.findCurrencyBySymbol({ symbol: 'USDT', chainId: 1 });
```

> **Note (TRON):** On TRON, `getCurrencies()` may return stale EVM-format entries. Use `getNativeCurrency({ chainId })` to get TRX reliably.

## Invoices

```ts
import { InvoiceStatus } from '@b2binpay/defi-sdk';

// Create
const invoice = await client.createInvoice({
  requestedAmount: '100',
  currencyIds: [usdt.id],
  trackingId: 'order-42',
  skipCallbacks: false, // callbacks are configured per account; true suppresses them for this invoice
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

// Update (expire, patch amount, tracking id, payment-page fields or currencies).
// An invoice is cancelled by moving it to EXPIRED.
await client.updateInvoice({
  invoiceId: invoice.id,
  status: InvoiceStatus.Expired,
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
  skipCallbacks: false,
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

// Batch-executable candidates: contiguous nonces starting at the next executable one.
// `batchableCount` on the queue response tells you whether the batch action is worth showing.
const { candidates } = await client.getBatchCandidates({});
const uncontested = candidates.filter((group) => !group.conflict);

// Submit a signature (raw ECDSA hex — packed automatically by the SDK)
await client.submitOperationSignature({
  operationId: operation.id, // the API id, not the on-chain executeOperationId
  signature: rawSignature,
  signerAddress: account.address, // required for v1.1.0 contracts
});
```

> **Signature packing:** The SDK automatically packs signatures to the format expected by the contract version. For v1.1.0 contracts, `signerAddress` is required. Pass the raw ECDSA hex from `signTypedData` — do not pre-pack.

## Operations & blockchain transactions

History is read through two complementary APIs:

- **Operations (v2)** — logical operations (payout, claim, stake, …) with typed details.
- **Blockchain transactions** — on-chain transactions, each carrying its decoded operations.

```ts
import { OperationTypeV2 } from '@b2binpay/defi-sdk';

// Logical operations
const operations = await client.getOperationsV2({
  types: [OperationTypeV2.Payout],
  pageSize: 20,
});
const details = await client.getOperationDetailsV2({
  type: operations.items[0].operationType,
  operationId: operations.items[0].id,
});

// On-chain transactions
const txList = await client.getBlockchainTransactions({ pageSize: 20 });
const tx = await client.getBlockchainTransaction({ transactionId: txList.items[0].id });
```

## Claims

```ts
// List claimable deposits, leaving out scam-flagged currencies
const claims = await client.getClaims({ pageSize: 50, currencyIsScam: false });

// Currencies with claimable balances
const claimable = await client.getClaimableCurrencies();

// Claimable deposits grouped by currency, ready for a batch claim
const { items: batches } = await client.getClaimBatches({ currencyIsScam: false });
for (const batch of batches.filter((b) => b.canBatch)) {
  // Invoices whose chain native coin is risky are excluded from the totals and must be claimed one by one
  const invoiceNonces = batch.invoices.filter((i) => i.isBatchable).map((i) => i.invoiceNonce);
  console.log(batch.currency.symbol, batch.totalAmount, invoiceNonces, batch.sweptNativeTotals);
}
```

`getClaimBatches()` also reports what a batch moves besides its own currency: `sweptNativeTotals` is the
native balance a token claim carries along, and `companionCurrencies` lists currencies on the same
invoices that the batch does **not** move. `currencyIsScam`, `currencyIsVerified` and `currencyIsHidden`
filter both `getClaims()` and `getClaimBatches()`; an omitted flag does not filter.

Broadcasting claim transactions is done off-chain through `MultisigBlockchainClient.buildClaimCalldata` (EVM) or `TronMultisigBlockchainClient.buildClaimTransaction` (TRON). See [`examples/claim-deposits.ts`](../examples/claim-deposits.ts) and [`examples/tron-claim-deposits.ts`](../examples/tron-claim-deposits.ts).

## Pagination

List methods return one page (`items`, `total`, `page`, `pageSize`). To walk all of them, hand the method
to `paginate`, which fetches pages lazily and keeps your filters on every request:

```ts
import { fetchAll, InvoiceStatus, paginate } from '@b2binpay/defi-sdk';

for await (const invoice of paginate((p) => client.getInvoices(p), { statuses: [InvoiceStatus.Paid] })) {
  console.log(invoice.id);
}

const allPayouts = await fetchAll((p) => client.getPayouts(p), { trackingId: 'order-42' });
```

`pageSize` defaults to 100. Iteration stops at the first short page or once `total` items have been
seen; breaking out of the loop stops further requests.

## Waiting for State Changes

Signing, execution and confirmation happen asynchronously. Instead of writing polling loops, wait on
the state you need:

```ts
// Until the queue operation has enough signatures to execute
const ready = await client.waitForQueueOperation({ operationId: payout.queueOperationId! });

// Until the indexer confirms every operation a transaction you broadcast carries
// (a batch execute carries one per queue entry; `type` narrows them)
const confirmed = await client.waitForTransactionOperations({ txHash, type: OperationTypeV2.Payout });

// Or a single v2 operation you already know by id
const operation = await client.waitForOperationV2({ id: operationId });
```

All three take `{ timeoutMs, intervalMs, signal }` (defaults: 5 minutes, 5 seconds). They reject with
`WaitTimeoutError` on timeout, `UnexpectedStatusError` (`status`) when the entity settles in a status you
did not ask for — e.g. `CANCELLED` while waiting for `READY` — and with `signal.reason` when aborted.
Pass `statuses` to wait for something other than the default. `pollUntil(label, check, options)` is
exported for waiting on anything else.

## Error Handling

Every error the SDK throws extends `DefiSdkError`, so one `instanceof` check separates SDK failures from
bugs in your own code. Narrow further by class:

| Class | When | Useful fields |
| --- | --- | --- |
| `DefiApiError` | the API answered with a non-2xx status | `status`, `message` (from the API body), `body`, `url` |
| `InsufficientCreditsError` | HTTP 402 — the account cannot pay for the operation (extends `DefiApiError`) | `required`, `available` |
| `DefiNetworkError` | no response at all: DNS, TLS, connection reset | `cause` |
| `ChainNotSelectedError` | a chain-scoped call without `chainId` before `selectChain()` | — |
| `DeploymentNotFoundError` | the account has no deployment on that chain | `chainId` |
| `WaitTimeoutError` | a `waitFor*` helper ran out of time | `label`, `timeoutMs` |
| `UnexpectedStatusError` | a `waitFor*` helper saw the entity settle in an unwanted status | `label`, `status` |
| `CallbackSignatureError` | `parseCallback`: signature missing or wrong — answer 401 | — |
| `CallbackPayloadError` | `parseCallback`: signed, but not JSON or not a known event — answer 2xx and log | `body` |

```ts
import { DefiApiError, InsufficientCreditsError } from '@b2binpay/defi-sdk';

try {
  await client.createPayout({ ... });
} catch (err) {
  if (err instanceof InsufficientCreditsError) {
    console.error(`Top up credits: need ${err.required}, have ${err.available}`);
  } else if (err instanceof DefiApiError && err.status === 400) {
    console.error('Rejected by the API:', err.message);
  }
  throw err;
}
```

The SDK writes nothing to the console. Pass `logger` (anything with a `warn(message)` method, e.g.
`console` or a pino instance) to `DefiClient` to receive its diagnostics.
