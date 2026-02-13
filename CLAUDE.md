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
│   └── multisig-client.ts - MultisigBlockchainClient for EIP-712 and transactions
└── utils/         - Utilities
    ├── transactions/ - Transaction builders and EIP-712 helpers
    └── validation.ts - Address validation utilities

generated-contracts/ - OpenAPI-generated DTOs and API classes (DO NOT EDIT)
examples/           - Runnable example scripts
docs/              - Extended documentation (overview, API client, transactions, contributing)
```

### Key Components

#### DefiClient (`src/api/defi-client.ts`)
The main entry point for REST API interactions. Instantiate with `baseUrl` and `apiKey`:
```ts
const client = new DefiClient({
  baseUrl: 'https://api.example.com',
  apiKey: process.env.API_KEY!,
});
```

**Important patterns:**
- **Account selection**: The API key maps to a single account, so `accountId` is auto-resolved internally. Call `getAccount()` to fetch account details.
- **Chain selection**: Call `await client.selectChain(chainId)` to cache the deployment for a chain. Subsequent invoice/payout/claim methods use this cached deployment unless `chainId` is explicitly passed per method.
- **Automatic header injection**: The client automatically adds `x-api-key` header to all requests.

Key methods include:
- `getAccounts()`, `getAccount()`, `getDeployments()`
- `selectChain(chainId)` - Cache deployment for chain-scoped operations
- `getAccountBalanceSummary()`, `getAssetBalances()`
- `createInvoice()`, `getInvoices()`, `getInvoice()`, `updateInvoice()`
- `createPayout()`, `getPayouts()`, `getPayout()`
- `getClaims()`, `getClaimableCurrencies()`
- `findCurrencyBySymbol()`, `getNativeCurrency()`
- `getDeploymentQueue()`, `submitOperationSignature()`

#### MultisigBlockchainClient (`src/blockchain/multisig-client.ts`)
Handles blockchain-specific operations for multisig contracts:
- `createExecuteTypedData()` - Build EIP-712 typed data for signing operations
- `buildExecuteTransaction()` - Prepare execute transaction for one or more operations
- `buildClaimCalldata()` - Generate calldata for claim/claimTo functions

Requires a `viem` `PublicClient` instance for reading contract state and chain ID.

#### Transaction Utilities (`src/utils/transactions/`)
- `eip712.ts` - EIP-712 domain/message builders for multisig execute operations
- `builders.ts` - Transaction builders for execute operations

These are consumed by `MultisigBlockchainClient` but can also be used directly.

### Typical Workflow

1. **Authentication**: Create `DefiClient` with API key
2. **Chain Selection**: Call `client.selectChain(chainId)` to set active chain
3. **API Operations**: Use client methods for invoices, payouts, claims
4. **Blockchain Operations**:
   - Create `MultisigBlockchainClient` with `PublicClient`
   - Build EIP-712 typed data with `createExecuteTypedData()`
   - Sign with wallet's `signTypedData()`
   - Submit signature via `client.submitOperationSignature()`
   - Execute via `buildExecuteTransaction()` and broadcast

See `examples/queue-sign.ts` and `examples/queue-execute.ts` for complete flows.

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

No test suite is currently present. When adding tests:
- Test files should be `*.test.ts`
- `noExplicitAny` linting rule is disabled for test files (see `biome.json` overrides)

## Publishing

- Version is set to `"auto"` in `package.json` - likely managed by CI
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
