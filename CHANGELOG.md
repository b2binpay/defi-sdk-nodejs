# Changelog

All notable changes to `@b2binpay/defi-sdk`. Versions match the tags published to npm; the SDK's
semver is its own and does not track the DeFi API version.

## 1.6.0 - 2026-09-01

Tracks the B2BINPAY DeFi API 1.8.0.

### Breaking

- Callbacks are configured per account instead of per entity, so `callbackUrl` is gone. It is no
  longer accepted by `createInvoice`, `createPayout`, `updateInvoice` or `updatePayout`, and no
  longer present on the invoice and payout response types.
- `CowswapPayload` is no longer a queue-operation payload variant and is no longer part of the
  payload union.
- `CrossChainTransferPayload` no longer carries `operationId`; it only carries `userSteps`.

### Added

- `skipCallbacks?: boolean` on `createInvoice` and `createPayout` suppresses callbacks for that
  entity and its downstream operations. Invoice and payout reads expose `skipCallbacks: boolean`.
- The callbacks surface is exported from the package root: types `Callback`, `CallbackList`,
  `ResendCallbacksResult` and enums `CallbackType`, `CallbackStatus`, `CallbackOperationType`. They
  existed in source since 1.3.0 but were unreachable, so `getCallbacks()` results could not be typed
  by a consumer.
- `SmartContractCapabilities` — contract version feature flags (`supportsInvoices`,
  `supportsWhitelist`, `supportsStaking`) exported from the package root, carried on `AbiCacheEntry`
  and returned by the new `DefiClient.getContractCapabilities()`. Use them to gate flows such as
  invoice creation, which the API rejects on TVM accounts below contract version 1.2.2. The flags are
  `undefined` when the API deployment does not report them — gate on an explicit `false`, since
  "unknown" is also falsy.
- `ContractAbi` — `Pick<AbiCacheEntry, 'abi' | 'version'>`, now the option type both multisig clients
  accept, so a hand-built entry does not have to carry capabilities.
- `InsufficientCreditsError` — thrown when the API returns HTTP 402 (insufficient credits). Carries
  optional `required` and `available` numeric fields from the response body, and emits a
  `console.warn` with the balance details.

### Changed

- `CallbackType` gains `QUEUE_OPERATION` and `OPERATION`; `CallbackOperationType` gains `queue` and
  `operation`. Exhaustive switches over either enum need the new cases.
- `AbiCacheEntry` carries an optional `capabilities` field. Disk cache files written by earlier
  versions predate it and are treated as a cache miss, so the ABI is refetched once per version after
  upgrading; a file written for an API that reports no flags records `capabilities: null` and is still
  served from cache.

## 1.5.0 - 2026-08-11

Tracks the B2BINPAY DeFi API 1.7.0.

### Breaking

- The legacy transactions API is gone. `deployments/{id}/transactions` no longer exists server-side,
  so the methods `getTransactions` / `getTransaction` and the types `Transaction`,
  `TransactionDetails`, `TransactionList`, `TransactionStatus`, `TransactionDirection`,
  `TransactionOperationType`, `TransactionInvoice`, `TransactionSortField`, `GetTransactionsParams`
  and `GetTransactionParams` were removed. Migrate to `getBlockchainTransactions()` /
  `getBlockchainTransaction()` for on-chain history and `getOperationsV2()` /
  `getOperationDetailsV2()` for logical operation history — both available since 1.4.0.

### Added

- `getContractCapabilities(versionId?)` returns `SmartContractCapabilities` — `supportsInvoices`,
  `supportsWhitelist`, `supportsStaking` — so a caller can branch on what the account's contract
  version exposes instead of hardcoding a semver check.
- Generated clients for three new operation families: `claim-to` (withdraw a deposit to an external
  address), `cowswap` and `set-whitelist`.
- Operation statuses `AML_CHECK`, `BLOCKED`, `REFUNDED` and operation types `CLAIM_TO`, `COWSWAP`,
  `SET_WHITELIST`, `CLAIM_WHITELIST_CHANGE`.
- Invoice expiry filtering and sorting: `InvoiceStatus.Expired`, the `expiresFrom` / `expiresTo`
  filters and the `ExpiresAt` sort field.
- AML verdicts on the invoice details payload: `riskyCurrencyIds`, `hasRiskyNativeDeposit`,
  `latestAmlCheck` and `blockedAmounts` (AML-blocked amounts aggregated per currency).

## 1.4.1 - 2026-07-20

### Fixed

- Package entry paths point at `dist/src`, so `main`, `types` and the `exports` map resolve for
  consumers.

## 1.4.0 - 2026-07-02

### Added

- Cross-chain transfers.
- TRX staking.
- Operations history v2.
- Blockchain transactions.

## 1.3.0 - 2026-06-04

### Added

- Callbacks contracts (get / resend) from the regenerated OpenAPI spec.
- `DefiClient` wrappers: `getCallbacks`, `resendCallbacks`, `getNetworks`, `getCurrency`,
  `getQueueOperation`, `getNonceInfo`, `getDeploymentInfo`.
- Mapped types and mappers for `Callback`, `Network`, `NonceInfo` and `DeploymentParams`.

## 1.2.0 - 2026-06-02

Adds support for the DeFi API of the time, including MultiSigWallet v1.2.0 operations and
backend-provided signature blobs for execute calls.

### Added

- Contract version utilities for multisig operation signing.

### Changed

- `DefiClient`, response mappers and public types updated for the new API surface.
- Transaction builders and EIP-712 / TIP-712 signing helpers updated (EVM + TRON).
- Runnable examples for payouts and the full EVM / TRON flows refreshed.

## 1.1.0 - 2026-04-16

### Added

- Second public release. No release notes were published for it.

## 1.0.0 - 2026-02-13

### Added

- First public release of the SDK: `DefiClient` for the REST API plus the EVM and TRON multisig
  blockchain clients.
