# API Client

The API layer is implemented in `src/api/defi-client.ts` and wraps the generated contracts to present a developer-friendly interface for authentication and API calls.

## Configuration

```ts
const client = new DefiClient({
  baseUrl: 'https://api.example.com',
  apiKey: process.env.API_KEY!,
  defaultHeaders: { 'x-app-version': '1.0.0' },
});
```

Supported options:
- `baseUrl` (required): REST endpoint (without trailing slash).
- `apiKey` (required): value sent as the `x-api-key` header on every request.
- `fetchApi`: Custom fetch implementation (useful for SSR or testing).
- `middleware`: OpenAPI middleware applied to every request.
- `defaultHeaders`, `credentials`, `queryParamsStringify`: Fine-grained HTTP control.

## Authentication

`DefiClient` authenticates purely via API key. Provide the key at construction time and every request will include `x-api-key: <value>`. There is no nonce/signature exchange or access/refresh token management in the SDK anymore.

## Account Management
- `getAccounts()` retrieves all accounts linked to the authenticated user (the first entry is cached automatically).
- `getAccount()` fetches account details as an `AccountDetailsDto`, exposing the primary `account` metadata plus network `deployments`.
- `getDeployments(accountDetails?)` returns the list of deployments for the account; pass cached account details to avoid re-fetching if you already have them.
- `selectChain(chainId)` resolves and stores the deployment for a chain so downstream calls (invoices, payouts, claims, etc.) can omit chain/deployment identifiers.
- `getSelectedDeployment()` returns the cached deployment (or `undefined` if none was selected yet).
- `getAccountBalanceSummary({ chainId, baseCurrency })` retrieves balances; `baseCurrency` must be a value from `FiatCurrency`.
- `getAssetBalances({ chainId?, baseCurrency, ...filters })` returns paginated asset balances with optional sorting/filtering by asset id or balance.
- `getDeploymentByChain(chainId, accountDetails?)` resolves the `AccountDeploymentDto` for the requested chain without affecting the cached selection (pass cached account details to avoid re-fetching).

Each API key is scoped to a single account, so the SDK auto-selects it internally and never requires an `accountId`.

## Currencies & Payouts
- `getCurrencies()` returns the list of supported currencies (native coins have `address === null`).
- `getNativeCurrency(chainId)` returns the native coin entry for a chain (i.e., the currency with `address === null`).
- `findCurrencyBySymbol({ symbol, chainId? })` searches currencies by ticker symbol (optionally constrained by chain, or falling back to the selected chain if one is cached); throws if zero or multiple matches exist.
- `createPayout({ currencyId, amount, recipient, ... })` creates a payout request and enqueues a multisig operation for the selected chain (optionally override via `chainId`; amount is passed through as-is to the REST API).
- `getPayouts({ ...filters, chainId? })` lists payouts with rich filtering (status, creator, address, etc.).
- `getPayout({ payoutId, chainId? })` retrieves on-chain and API metadata for a specific payout.
- `updatePayout({ payoutId, ...patch, chainId? })` patches tracking or callback metadata without re-creating the payout.
- `getDeploymentQueue({ chainId?, ... })` fetches pending operations for signature/execution.
- `submitOperationSignature({ operationId, signature, chainId? })` uploads an off-chain signature for an operation.

## Invoice Management
- `getInvoices({ ...filters, chainId? })` paginates invoices by status, date range, currency, or tracking ID.
- `getInvoice({ invoiceId, chainId? })` returns the full invoice details payload.
- `createInvoice({ requestedAmount, currencyIds, ... , chainId? })` creates an invoice for a chain/currency pair with optional callbacks.
- `updateInvoice({ invoiceId, ...patch, chainId? })` updates request amount, callback URLs, currency selections, or status (e.g., to cancel an invoice, set `status: InvoiceStatus.Cancelled`).

## Transactions & Claims
- `getTransactions({ ...filters, chainId? })` exposes the transaction ledger with filters for operation type, status, currency, block hash, etc.
- `getTransaction({ transactionId, chainId? })` hydrates a specific transaction with decoded metadata.
- `getClaims({ ...filters, chainId? })` lists claimable deposits grouped by invoice and currency.
- `getClaimableCurrencies(chainId?)` surfaces currencies that currently have claimable balances.
- On-chain claim broadcasting is app-controlled; use `MultisigBlockchainClient.buildClaimCalldata` (see `examples/claim-deposits.ts`) to assemble calldata for `MultiSigWallet.claim`/`claimTo`, then broadcast the transaction yourself.

## Blockchain Client & Builders
- `MultisigBlockchainClient` (in `src/blockchain`) encapsulates RPC access for multisig operations.
- `createExecuteTypedData({ contractAddress, operation, domainOverride? })` returns the EIP-712 payload ready for `signTypedData`.
- `buildExecuteTransaction({ contractAddress, operations })` builds a `MultiSigWallet.execute` transaction (single or batch) using queue operations.
- `buildClaimCalldata({ erc20, depositAccountIds, to? })` generates calldata for `claim`/`claimTo` functions.

The lower-level builders in `src/utils/transactions` are also exported if you want to construct transactions without instantiating a client. This separation keeps API usage decoupled from blockchain access so the blockchain client can be used independently of how requests are authenticated.

## Error Handling
All generated API methods throw `ResponseError` when the server responds with non-2xx status codes. Catch these errors to read the JSON body for additional context, as demonstrated in `examples/get-account-info.ts`.

## Validation Helpers
Use `validateAddress({ address, networkChainId, currency, assets })` from `src/utils/validation` (re-exported via `@b2binpay/defi-sdk`) before submitting payouts or invoices. The helper enforces checksum address formatting, verifies currency/network combinations, and ensures the currency is part of the provided asset list, returning `{ isValid, errors, normalizedAddress }`.
