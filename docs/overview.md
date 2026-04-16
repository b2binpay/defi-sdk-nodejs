# SDK Overview

`@b2binpay/defi-sdk` is a TypeScript package that combines REST API access with smart-contract helpers for the B2BinPay DeFi platform. It targets Node.js server-side usage where an application needs to manage payment flows through a non-custodial multisig wallet.

## Architecture

```
@b2binpay/defi-sdk
├── src/api/              – Hand-written REST wrapper (DefiClient)
│   └── models/           – Typed interfaces and enums
├── src/blockchain/       – Chain-aware clients
│   ├── multisig-client.ts        – MultisigBlockchainClient (EVM)
│   ├── tron-multisig-client.ts   – TronMultisigBlockchainClient (TVM)
│   ├── get-chain.ts              – Chain resolver utilities
│   └── tron-chains.ts            – TRON chain configs (Mainnet, Shasta)
├── src/utils/
│   ├── transactions/     – EIP-712 / TIP-712 builders and helpers
│   ├── validation.ts     – EVM address validation
│   ├── tron-validation.ts – TRON address validation
│   └── tron-types.ts     – Branded TronAddress type
└── generated-contracts/  – OpenAPI-generated DTOs and API classes
```

## Layers

### API Layer (`src/api`)

`DefiClient` wraps the generated OpenAPI client and exposes convenience methods grouped by domain: accounts, balances, currencies, invoices, payouts, claims, transactions, and the deployment queue. It handles:

- Automatic `x-api-key` injection on every request
- Account resolution (API key → account → deployments)
- Chain selection caching (`selectChain`) so downstream calls omit explicit chain/deployment IDs
- ABI fetching and caching (`getContractAbi`) with optional disk persistence

### Blockchain Layer (`src/blockchain`)

Chain-aware helpers that bridge the API layer with on-chain operations:

- **`MultisigBlockchainClient`** (EVM) — uses a viem `PublicClient` for RPC reads; builds EIP-712 typed data for signing, encodes `execute` transactions, and assembles claim calldata
- **`TronMultisigBlockchainClient`** (TVM) — uses TronWeb; builds TIP-712 typed data, encodes `execute` and `claim` transactions for TRON

Both clients accept an `AbiCacheEntry` from `client.getContractAbi()` to support v1.0.0 and v1.1.0 signature packing formats.

### Transaction Utilities (`src/utils/transactions`)

Low-level helpers consumed by the blockchain clients but also exported directly:

- **EIP-712** — `createExecuteTypedData`, `buildExecuteTypedMessage`, `fetchExecuteTypedDataDomain`, `signExecuteTypedData`
- **TIP-712** — `buildTronExecuteTypedData`, `fetchTronExecuteTypedDataDomain`, `prepareTronTypedDataForSigning`
- **Builders** — `buildExecuteOperationsTransaction` (EVM), `packSignatures`, `packTronSignatures`

### Validation (`src/utils/validation`)

`validateAddress` enforces address correctness before write operations — EVM checksum, TRON Base58Check, chain and currency compatibility.

## High-Level Workflow

1. **Instantiate `DefiClient`** with `baseUrl` and `apiKey`
2. **Select a chain** with `selectChain(chainId)` — caches the deployment for the session
3. **Fetch the contract ABI** with `getContractAbi()` — cached in memory and optionally on disk
4. **Manage invoices and payouts** via `createInvoice`, `createPayout`, etc.
5. **Sign operations** — build EIP-712/TIP-712 typed data, sign with a wallet, submit via `submitOperationSignature`
6. **Execute on-chain** — build the `execute` transaction with `buildExecuteTransaction`, broadcast it
7. **Claim deposits** — build claim calldata with `buildClaimCalldata` or `buildClaimTransaction` (TRON), broadcast

## Signature Packing

The SDK auto-applies the correct packing format based on the contract version in the fetched ABI:

- **v1.0.0** — raw ECDSA signatures, sorted and concatenated
- **v1.1.0** — binary format with explicit signer addresses: `[address:20][sigLen:2][sig:sigLen]` sorted by signer address and concatenated.

## Published Package

The npm package exports:

- `DefiClient` and all supporting types
- `MultisigBlockchainClient` (EVM)
- `TronMultisigBlockchainClient` (TVM)
- `getEvmChainById`, `getTronChainById`, `getChainById` — chain resolver utilities
- `validateAddress` — address + network validator
- Transaction helpers under the `transactions` namespace
- `AbiProvider` and `AbiCacheEntry` — ABI fetching and caching
- Enums: `FiatCurrency`, `InvoiceStatus`, `PayoutStatus`, `QueueOperationType`, `QueueOperationStatus`, `TransactionOperationType`, and more

Refer to [`docs/api-client.md`](api-client.md) and [`docs/transactions.md`](transactions.md) for detailed reference.
