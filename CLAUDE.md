# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@b2binpay/defi-sdk`, a TypeScript SDK that wraps the B2BinPay DeFi REST API and provides blockchain transaction utilities built on top of `viem`. The package is published to npm and consumed by applications requiring authenticated API calls plus helpers for interacting with multisig smart contracts.

## Build & Development Commands

### Core Commands
- `npm run build` - Compile TypeScript to `dist/` using `tsconfig.build.json`
- `npm run lint` - Check code with Biome (formatter + linter)
- `npm run lint:fix` - Auto-fix formatting and linting issues

### API Contract Generation
- `npm run generate:api` - Regenerate `generated-contracts/` from the OpenAPI spec at `https://api.defi.b2binpay.com/api/docs-api-user-json`

The generated code is **not manually edited** - all changes must be made to the OpenAPI spec source.

### Running Examples
- `npm run example:get-account-info` - Authenticate, list deployments, show balance summaries
- `npm run example:create-invoice` - Create invoice with currency lookup
- `npm run example:get-invoice-details` - List/filter invoices, show claimable assets
- `npm run example:create-payout` - Create payout and surface queue operation
- `npm run example:queue-sign` - Build EIP-712 typed data and submit signature
- `npm run example:queue-execute` - Build and broadcast execute transaction
- `npm run example:queue-execute-batch` - Execute multiple operations in one transaction
- `npm run example:claim-deposits` - Build claim calldata and broadcast transaction

All examples require environment variables (see `.env.example`) including `API_BASE_URL`, `API_KEY`, `CHAIN_ID`, `WALLET_PRIVATE_KEY`, and `RPC_URL`.

## Code Architecture

### Directory Structure
```
src/
├── abi/           - Contract ABIs (e.g., MULTI_SIG_WALLET_ABI)
├── api/           - Hand-written API wrappers around generated client
│   ├── defi-client.ts - Main DefiClient class with convenience methods
│   └── models/    - Type definitions and mappers for API responses
├── blockchain/    - Blockchain-specific clients
│   ├── multisig-client.ts       - MultisigBlockchainClient (EVM, EIP-712)
│   ├── tron-multisig-client.ts  - TronMultisigBlockchainClient (TVM, TIP-712)
│   ├── get-chain.ts             - Chain resolver utilities
│   └── tron-chains.ts           - TRON chain configs (Mainnet, Shasta)
└── utils/         - Utilities
    ├── transactions/ - EIP-712 / TIP-712 builders, signature packing
    ├── validation.ts - EVM address validation
    ├── tron-validation.ts - TRON address validation
    └── tron-types.ts  - Branded TronAddress type

generated-contracts/ - OpenAPI-generated DTOs and API classes (DO NOT EDIT)
examples/           - Runnable example scripts (EVM and TRON)
docs/              - Extended documentation (overview, API client, transactions, contributing)
```

### Key Components

#### DefiClient (`src/api/defi-client.ts`)
The main entry point for REST API interactions. Instantiate with `baseUrl` and `apiKey`:
```ts
const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
  abiCacheDir: '.abi-cache', // optional disk cache for contract ABIs
});
```

**Important patterns:**
- **Account resolution**: API key maps to one account — `accountId` is never required.
- **Chain selection**: `selectChain(chainId)` caches the deployment; subsequent invoice/payout/claim calls omit `chainId`.
- **ABI caching**: `getContractAbi()` fetches and caches the multisig ABI (memory + optional disk). Pass result to blockchain clients.

Key methods:
- `getAccounts()`, `getAccount()`, `getDeployments()`, `selectChain()`, `getContractAbi()`
- `getAccountBalanceSummary()`, `getAssetBalances()`
- `createInvoice()`, `getInvoices()`, `getInvoice()`, `updateInvoice()`
- `createPayout()`, `getPayouts()`, `getPayout()`, `updatePayout()`
- `getClaims()`, `getClaimableCurrencies()`
- `getTransactions()`, `getTransaction()`
- `findCurrencyBySymbol()`, `getNativeCurrency()`, `getCurrencies()`
- `getDeploymentQueue()`, `submitOperationSignature()`

#### MultisigBlockchainClient (`src/blockchain/multisig-client.ts`)
EVM multisig operations (EIP-712 signing, execute transactions, claim calldata):
- `createExecuteTypedData({ contractAddress, operation })` - Build EIP-712 typed data
- `buildExecuteTransaction({ contractAddress, operations })` - Encode execute() call
- `buildClaimCalldata({ erc20, depositAccountIds, to? })` - Generate claim calldata

Requires a viem `PublicClient` and `AbiCacheEntry` from `client.getContractAbi()`.

#### TronMultisigBlockchainClient (`src/blockchain/tron-multisig-client.ts`)
TVM multisig operations (TIP-712 signing, execute/claim transactions):
- `createExecuteTypedData({ contractAddress, operation })` - Build TIP-712 typed data
- `buildExecuteTransaction({ contractAddress, callerAddress, operations })` - Encode Tron execute
- `buildClaimTransaction({ contractAddress, callerAddress, erc20, depositIds })` - Encode Tron claim

Requires a `TronWeb` instance, `AbiCacheEntry`, and `defaultFeeLimit` (in SUN).

#### Transaction Utilities (`src/utils/transactions/`)
- `eip712.ts` - EIP-712 builders for EVM (createExecuteTypedData, buildExecuteTypedMessage, signExecuteTypedData)
- `tron-tip712.ts` - TIP-712 builders for TVM (buildTronExecuteTypedData, prepareTronTypedDataForSigning)
- `builders.ts` - Low-level transaction encoders (buildExecuteOperationsTransaction, packSignatures, packTronSignatures)

### Typical Workflow

1. **Authentication**: Create `DefiClient` with API key and base URL
2. **Chain Selection**: `client.selectChain(chainId)` to cache deployment
3. **ABI**: `client.getContractAbi()` to fetch contract ABI (required for blockchain clients)
4. **Blockchain Operations** (EVM):
   - Create `MultisigBlockchainClient` with `publicClient` and `contractAbi`
   - Build EIP-712 typed data with `createExecuteTypedData()`
   - Sign with wallet's `signTypedData()`
   - Submit via `client.submitOperationSignature()` (auto-packs)
   - Execute via `buildExecuteTransaction()` and broadcast
5. **Blockchain Operations** (TRON):
   - Same flow with `TronMultisigBlockchainClient` and TronWeb

See `examples/evm-full-flow.ts` and `examples/tron-full-flow.ts` for complete flows.

### Generated vs Hand-Written Code

**Generated (`generated-contracts/`):**
- OpenAPI client using `typescript-fetch` generator
- DTOs, API service classes, runtime helpers
- Generated by `openapi-generator-cli` from the remote spec
- Never edit manually - regenerate when API spec changes

**Hand-Written (`src/api/`):**
- `DefiClient` wraps generated APIs with cleaner interface
- `models/` directory contains mapped types for better DX
- `mappers.ts` transforms generated DTOs to hand-written types
- This layer handles chain selection caching, automatic account resolution, and convenience methods

### Type Safety & Validation

- **Address validation**: Use `validateAddress()` from `src/utils/validation.ts` before submitting payouts or operations
- **Enum types**: Leverage generated enums like `InvoiceStatus`, `PayoutStatus`, `FiatCurrency`, `TransactionOperationType`
- **Chain ID handling**: Chain IDs are numbers, but some APIs accept strings - conversion is handled internally

## Code Style

- **Formatter**: Biome with 120 character line width, 2-space indents, single quotes
- **Linting**: Biome's recommended rules
- **TypeScript**: Strict mode enabled, `NodeNext` module resolution
- **Node Version**: Requires Node.js ^22.16.0 and npm ^10.9.2

## Testing Strategy

Run tests with `npx jest --passWithNoTests`. Config: `jest.config.mjs`.

- Test files: `*.spec.ts` or `*.test.ts`
- `noExplicitAny` linting rule is disabled for test files (see `biome.json` overrides)

## Publishing

- Version is set to `"auto"` in `package.json` — managed by CI
- `npm run prepublishOnly` runs build automatically
- Exported files: `dist/`, `docs/`, `README.md`
- Entry points defined in `exports` field for CommonJS/ESM compatibility

## Documentation

Extended docs in `docs/` directory:
- `overview.md` - High-level SDK architecture and workflows
- `api-client.md` - Authentication, configuration, caching details
- `transactions.md` - Transaction helper layer reference
- `contributing.md` - Repository conventions and release guidelines

Start with `docs/overview.md` when understanding the SDK design.

## Important Conventions

1. **Never edit `generated-contracts/`** - Always regenerate from OpenAPI spec
2. **Chain selection is stateful** - Call `selectChain()` once, then chain-scoped methods work without passing `chainId` explicitly
3. **Account ID is implicit** - API key determines the account, no need to pass `accountId`
4. **EIP-712 signing flow**: Create typed data → Sign with wallet → Submit signature via API → Execute operation on-chain
5. **Viem integration**: The SDK uses `viem` for all blockchain interactions (signing, encoding, RPC calls)
6. **Environment-driven examples**: All examples read from `.env` file for configuration
