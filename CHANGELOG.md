# Changelog

All notable changes to `@b2binpay/defi-sdk`. Versions match the tags published to npm; the SDK's
semver is its own and does not track the DeFi API version.

## 2.0.0 - 2026-11-16

Tracks the B2BINPAY DeFi API 2.0.0.

### Breaking

- Raw per-signature material is gone from the queue surface. `QueueOperation`, `BatchCandidateOperation`
  and `Signature` no longer carry `signatures`, and the `OperationSignature` type is removed. The API
  stops returning individual signatures: `signatureBlob` is the only executable artifact, and it is
  present only once an operation has collected its required signatures and only for an approver.
- `buildExecuteTransaction` / `buildExecuteOperationsTransaction` build the `execute` call from
  `signatureBlob` and throw, naming the operation, when it is absent. They now accept the narrower
  `transactions.ExecutableQueueOperation` (`id`, `calls`, `executeOperationId`, `signatureBlob`), so the
  SDK's own domain models can be passed straight back in; `createExecuteTypedData` accepts
  `transactions.SignableQueueOperation` (`calls`, `nonce`).
- `CancelInvoiceParams`, `ExecuteOperationParams`, `ExecuteBatchOperationsParams`, `ExecuteClaimParams`
  and `ExecuteBatchClaimParams` are removed: no method or API endpoint ever took them.
- The SDK no longer writes to the console. The boxed insufficient-credits warning is gone, along
  with `formatCreditsWarning` and `parseCreditsError`; pass `logger: { warn }` to `DefiClient` to
  receive the warning as one line.
- API failures throw `DefiApiError` (`status`, `message` from the API body, `body`, `url`) instead
  of the generated `ResponseError`; transport failures throw `DefiNetworkError` instead of `FetchError`.
  `InsufficientCreditsError` now extends `DefiApiError`. A missing chain selection throws
  `ChainNotSelectedError` and an unknown chain `DeploymentNotFoundError` (`chainId`), both formerly
  plain `Error`.
- Chain-scoped reads take a params object instead of a positional `chainId`: `getStakingSummary`,
  `getStakingDelegationSummary`, `getStakingNetworkParams`, `getSuperRepresentatives`, `getVotingSummary`,
  `getCrossChainSourceCurrencies`, `getNonceInfo`, `getClaimableCurrencies` and `getNativeCurrency` —
  `client.getNativeCurrency({ chainId })`, or `()` for the selected chain.
- `MultisigBlockchainClient.buildClaimCalldata` takes `depositIds` (was `depositAccountIds`), matching the
  TRON client, and now throws on an empty list as the TRON client does.

### Added

- `idempotencyKey` on every create method that the API deduplicates — `createInvoice`, `createPayout`,
  `createCrossChainTransfer` and the eight TRON staking `create*Operation` methods. It is sent as the
  `Idempotency-Key` header, so a retry with the same key returns the original result instead of a
  duplicate. The shared shape is exported as `IdempotentCreateParams`.
- TRON Nile Testnet (`3448148188`, `network: 'nile'`, default RPC `https://nile.trongrid.io`) joins
  the supported TRON networks: `getTronChainById`, `TRON_CHAIN_IDS` and `isTronChain` all recognise it.
- `signers: QueueSigner[]` on `QueueOperation`, `BatchCandidateOperation` and `Signature` — every
  deployment approver with `isSigned` and `signedAt`, in approver order — replaces the signature array
  for "who has signed?" questions. `QueueSigner` is exported. `Signature` also carries `signatureBlob`.
- `getClaimBatches(params?)` — claimable deposits grouped by currency across invoices
  (`GET /deployments/{id}/claims/batches`): batch totals, `canBatch`, the native amounts a batch sweeps
  along, companion currencies it leaves behind, and every invoice with `isBatchable` /
  `hasRiskyNativeDeposit`. New types `ClaimBatches`, `ClaimBatch`, `ClaimBatchInvoice`,
  `ClaimBatchCompanion`, `ClaimBatchCurrencyAmount`, `GetClaimBatchesParams`.
- `currencyIsScam`, `currencyIsVerified`, `currencyIsHidden` filters on `getClaims()` and
  `getClaimBatches()` (`ClaimCurrencyFilters`).
- `Account.smartContractVersion` — the account's contract version (`id`, `version`, `isDeprecated`,
  `isVulnerable`); `isDeprecated` / `isVulnerable` are informational and block nothing.
- `transactions.requireSignatureBlob(operation)` — guard returning the blob or throwing.
- The package root now exports every model and params type: `Network`, `NonceInfo`,
  `DeploymentParams`, `AccountDeploymentStatus`, `GetCallbacksParams`, `ResendCallbacksParams` and
  `GetQueueOperationParams` were reachable only through return types.
- `DefiSdkError` — common base of every SDK error, so one `instanceof` separates SDK failures from
  application bugs.
- Callback verification: `parseCallback({ rawBody, signature, secret })` checks `X-CALLBACK-SIGNATURE`
  (HMAC-SHA256 of the raw body) in constant time and returns a typed `CallbackEvent` — either a
  `SettingsCallbackEvent` (`group`, `entity`, `event`, `chainId`) or a `LegacyCallbackEvent` (`type`,
  `operation_id`), told apart by `isSettingsCallbackEvent`. It throws `CallbackSignatureError` on a bad
  signature, and `CallbackPayloadError` (`body`) for a correctly signed body that is not JSON or not a known
  event — acknowledge that one instead of answering 401, or the API keeps redelivering it. `verifyCallbackSignature` returns the boolean alone; `CALLBACK_SIGNATURE_HEADER` and
  `CALLBACK_NO_SIGNATURE_HEADER` name the headers.
- `waitForQueueOperation({ operationId, statuses? })`, `waitForOperationV2({ id, statuses? })` and
  `waitForTransactionOperations({ txHash, type?, statuses? })` — the last resolves once **every** operation the
  transaction carries has settled, since a batch `execute` carries several — poll until the wanted status
  (`READY` / `CONFIRMED` by default), with `timeoutMs`,
  `intervalMs` and an `AbortSignal`. They reject with `WaitTimeoutError` or, when the entity settles
  elsewhere, `UnexpectedStatusError`. The generic `pollUntil` is exported too.
- `paginate(fetchPage, params)` — an async iterator over every item of any list method, fetching pages
  lazily — and `fetchAll(fetchPage, params)` collecting them into an array:
  `paginate((p) => client.getInvoices(p), { statuses })`. `DEFAULT_PAGE_SIZE`, `Page` and `PageParams` are
  exported with them.
- `WaitOptions`, `DEFAULT_WAIT_TIMEOUT_MS` and `DEFAULT_WAIT_INTERVAL_MS` — the options and defaults every
  `waitFor*` method and `pollUntil` take.
- `DefiClientLogger` (the `logger` option's type) and `DefiApiErrorInit` (the `DefiApiError` constructor
  argument).
- `transactions.toExecuteOperationTuples(operations)` and `transactions.ExecuteOperationTuple` — the tuples the
  multisig `execute` ABI expects.

### Notes

- `packSignatures` and `SignatureEntry` stay exported: they pack caller-supplied entries and are no
  longer used by the SDK itself.
- `engines` asks consumers for Node.js 20+ only. The Node 24 / npm 12 pins moved to `devEngines`, which
  npm checks only when installing this repository, so a consumer on Node 20 or 22 no longer hits
  `EBADENGINE`.
- Every `chainId` accepts `number | string` (`ChainIdentifier`, now exported): multisig client options,
  `getEvmChainById`, `getChainById`, `getTronChainById`, and `getAccountBalanceSummary`, whose `chainId`
  is also optional now and falls back to the selected chain.
- Date filters (`createdFrom`, `updatedTo`, `expiresFrom`, …) and `expiresAt` accept a `Date` or an ISO
  string (`DateInput`).
- Multisig clients take addresses as plain strings — `account.contract` goes in without a cast — and
  validate them, throwing `DefiSdkError` for a malformed or wrong-network address. `erc20: null` (a native
  currency's `address`) claims the native coin. `TronPreparedTransaction.raw` is typed
  (`TronUnsignedTransaction`), so it passes to `tronWeb.trx.sign()` without a cast.
- Every error the SDK throws extends `DefiSdkError`; the remaining plain `Error`s (unknown chain, missing
  symbol, empty update, …) keep their messages.
- Named argument types are exported for the multisig clients: `BuildClaimCalldataArgs`,
  `BuildExecuteTransactionArgs`, `TronCreateExecuteTypedDataArgs`, `TronBuildExecuteTransactionArgs`,
  `TronBuildClaimTransactionArgs`.

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
