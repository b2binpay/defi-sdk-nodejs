# SDK Overview

This SDK provides a single TypeScript entry point that combines REST API access with smart-contract helpers tailored to the B2BinPay DeFi stack.

- The **API layer** lives under `src/api` and wraps the generated `AccountsApi` (and related REST modules) so consumers interact with concise methods like `getAccountBalanceSummary`.
- The **transaction utilities** under `src/utils/transactions` encapsulate `viem` logic for composing, signing, and (soon) decoding contract payloads.
- Shared contract interfaces live under `src/abi`, ensuring builders/decoders stay consistent with the deployed contracts.
- Documentation is collated in the `docs/` folder and is shipped with the npm package for discoverability.

## High-Level Workflow
1. Authenticate requests by instantiating `DefiClient` with your API key (sent automatically via `x-api-key`).
2. Interact with REST endpoints using the client’s convenience methods.
3. Build and sign contract transactions through the utility layer.
4. Decode on-chain data returned from contract calls with the same helper set (decoders WIP).

## Supported Workflows
- **Authentication management** – every client instance binds to a sandbox or production base URL and injects the API key automatically.
- **Account & ledger data** – fetch account details, balances, deployment queues, invoices, payouts, and transactions with a single method call.
- **Chain selection** – use `selectChain(chainId)` to cache the deployment for a target network so subsequent invoice/payout/claim calls don’t need explicit deployment IDs.
- **Invoice lifecycle** – create, update, and cancel invoices with tracking IDs, callback URLs, and custom currency selections.
- **Payout lifecycle** – list payouts with filters, fetch payout details, patch metadata, and submit multisig signatures.
- **Claims management** – enumerate claimable deposits and trigger single/batch claim executions tied to signed transaction hashes.
- **Validation helpers** – `validateAddress` enforces address + network correctness before hitting write endpoints, reducing API errors.

## Published Package
The publishable module exports:
- `DefiClient` and supporting types for API-key-based account flows.
- Transaction helper utilities (`transactions.buildExecuteOperationsTransaction`, `transactions.createExecuteTypedData`, `transactions.signExecuteTypedData`, etc.) under a dedicated namespace.
- Shared ABI exports (`abi.MULTI_SIG_WALLET_ABI`) for contract-aware integrations.

See `examples/queue-sign.ts` for a combined flow that authenticates, fetches the linked account, builds a payout execute payload, and signs it, `examples/queue-execute.ts` for broadcasting the execute transaction, and `examples/claim-deposits.ts` for on-chain claim calldata and broadcasting.

Refer to `docs/api-client.md` and `docs/transactions.md` for deep dives into each layer.
