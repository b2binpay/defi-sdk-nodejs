# @b2binpay/defi-sdk

[![npm version](https://img.shields.io/npm/v/@b2binpay/defi-sdk.svg)](https://www.npmjs.com/package/@b2binpay/defi-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%5E22.16.0-brightgreen)](https://nodejs.org)

TypeScript SDK for the [B2BinPay DeFi](https://defi.b2binpay.com) platform — authenticated REST API access and blockchain transaction utilities for building non-custodial payment flows with multisig smart contracts.

## Features

- **Multi-chain** — EVM-compatible networks (Ethereum, BSC, Sepolia, …) and TRON (Mainnet, Shasta)
- **Invoices & Payouts** — full lifecycle management: create, query, update, cancel
- **Multisig operations** — EIP-712 / TIP-712 typed-data signing, signature packing, on-chain execution
- **Claims** — enumerate claimable deposits and build claim calldata
- **Address validation** — checksum + network + currency compatibility checks before write operations
- **Type-safe** — complete TypeScript types from the OpenAPI spec plus handcrafted blockchain types
- **Built on viem** — EVM blockchain interactions powered by [viem](https://viem.sh)

## Requirements

- Node.js `^22.16.0`
- npm `^10.9.2`

## Installation

```sh
npm install @b2binpay/defi-sdk
```

TRON support (`TronMultisigBlockchainClient`) is included out of the box — `tronweb` is bundled as a dependency.

## Quick Start

```ts
import { DefiClient, FiatCurrency } from '@b2binpay/defi-sdk';

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});

// Select the active chain (caches the deployment for subsequent calls)
await client.selectChain(1); // Ethereum Mainnet

// Query balance
const balance = await client.getAccountBalanceSummary({
  chainId: 1,
  baseCurrency: FiatCurrency.Usd,
});
console.log('Total balance (USD):', balance.totalBalance);

// Resolve a currency and create an invoice
const usdt = await client.findCurrencyBySymbol({ symbol: 'USDT', chainId: 1 });
const invoice = await client.createInvoice({
  requestedAmount: '100',
  currencyIds: [usdt.id],
  callbackUrl: 'https://merchant.example/webhook',
  trackingId: 'order-42',
});
console.log('Invoice ID:', invoice.id);
```

## Authentication

All requests use an API key sent as the `x-api-key` header. Pass it once at construction — the SDK attaches it to every request automatically. No token exchange or refresh is required.

Each API key is scoped to a single account. The SDK resolves the account and deployment IDs internally; you never need to pass `accountId` explicitly.

## EVM — Multisig Operation Flow

Payouts are executed on-chain through a multisig wallet. The typical flow is:

1. **Create a payout** — the API enqueues a multisig operation
2. **Fetch the queue** — retrieve the pending operation
3. **Build EIP-712 typed data and sign** — produce the off-chain approval
4. **Submit the signature** — the API records approval; once the signing threshold is met the operation becomes executable
5. **Execute on-chain** — broadcast the `execute` transaction

```ts
import { createPublicClient, http } from 'viem';
import {
  DefiClient,
  MultisigBlockchainClient,
  getEvmChainById,
  QueueOperationStatus,
} from '@b2binpay/defi-sdk';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_ID = 11155111; // Sepolia

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});

// Step 1: resolve deployment and ABI
const deployment = await client.selectChain(CHAIN_ID);
const contractAbi = await client.getContractAbi();

// Step 2: create payout
const currency = await client.getNativeCurrency(CHAIN_ID);
await client.createPayout({
  currencyId: currency.id,
  amount: '0.001',
  recipient: '0xRecipientAddress',
});

// Step 3: set up viem and the multisig client
const chain = getEvmChainById(String(CHAIN_ID), process.env.RPC_URL!);
const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL!) });

const multisig = new MultisigBlockchainClient({ chainId: String(CHAIN_ID), publicClient, contractAbi });

// Step 4: sign
const { items } = await client.getDeploymentQueue({});
const operation = items.find((op) => op.status === QueueOperationStatus.Pending);

const typedData = await multisig.createExecuteTypedData({
  contractAddress: deployment.contract as `0x${string}`,
  operation,
});

const account = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
const rawSignature = await account.signTypedData(typedData);

await client.submitOperationSignature({
  operationId: operation.executeOperationId,
  signature: rawSignature,
  signerAddress: account.address,
});

// Step 5: execute (once ready)
const readyQueue = await client.getDeploymentQueue({});
const readyOp = readyQueue.items.find((op) => op.status === QueueOperationStatus.Ready);

const tx = multisig.buildExecuteTransaction({
  contractAddress: deployment.contract as `0x${string}`,
  operations: [readyOp],
});

// Broadcast with a viem WalletClient
import { createWalletClient } from 'viem';
const walletClient = createWalletClient({ account, chain, transport: http(process.env.RPC_URL!) });
const hash = await walletClient.sendTransaction(tx);
```

See [`examples/evm-full-flow.ts`](examples/evm-full-flow.ts) for a complete runnable walkthrough including automatic deposit and confirmation polling.

## TRON — Multisig Operation Flow

The TRON flow mirrors EVM but uses `TronMultisigBlockchainClient` and `tronweb` for signing and broadcasting.

```ts
import TronWeb from 'tronweb';
import { DefiClient, TronMultisigBlockchainClient, QueueOperationStatus } from '@b2binpay/defi-sdk';

const CHAIN_ID = 728126428; // TRON Mainnet (2494104990 for Shasta)

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});

const deployment = await client.selectChain(CHAIN_ID);
const contractAbi = await client.getContractAbi();

const tronWeb = new TronWeb({
  fullHost: process.env.RPC_URL!,
  privateKey: process.env.WALLET_PRIVATE_KEY,
});

const multisig = new TronMultisigBlockchainClient({
  chainId: String(CHAIN_ID),
  tronWeb,
  contractAbi,
  defaultFeeLimit: 150_000_000, // 150 TRX in SUN
});

// Sign
const { items } = await client.getDeploymentQueue({});
const operation = items.find((op) => op.status === QueueOperationStatus.Pending);

const typedData = await multisig.createExecuteTypedData({
  contractAddress: deployment.contract,
  operation,
});

const rawSignature = await tronWeb.trx.signMessageV2(typedData.message);
await client.submitOperationSignature({
  operationId: operation.executeOperationId,
  signature: rawSignature,
  signerAddress: tronWeb.defaultAddress.base58,
});

// Execute
const readyOp = (await client.getDeploymentQueue({})).items.find(
  (op) => op.status === QueueOperationStatus.Ready,
);
const tx = await multisig.buildExecuteTransaction({
  contractAddress: deployment.contract,
  callerAddress: tronWeb.defaultAddress.base58,
  operations: [readyOp],
});
const broadcast = await tronWeb.trx.sendRawTransaction(tx.raw);
```

See [`examples/tron-full-flow.ts`](examples/tron-full-flow.ts) for the complete TRON walkthrough.

## Claims

Deposits received to the multisig wallet must be explicitly claimed on-chain.

```ts
// List claimable deposits grouped by currency
const claims = await client.getClaims({});
const depositIds = claims.items.map((c) => c.invoiceNonce);

const claimable = await client.getClaimableCurrencies();

// Build calldata
const calldata = multisig.buildClaimCalldata({
  erc20: claimable[0].address as `0x${string}`,
  depositAccountIds: depositIds,
  to: recipientAddress, // optional — omit to claim to the multisig contract itself
});

// Broadcast using walletClient
const hash = await walletClient.sendTransaction({
  to: deployment.contract as `0x${string}`,
  data: calldata,
});
```

For TRON, use `multisig.buildClaimTransaction(...)` and broadcast with `tronWeb.trx.sendRawTransaction(tx.raw)`.

## Address Validation

Use `validateAddress` before submitting payouts or invoices to catch format and network mismatches early.

```ts
import { validateAddress } from '@b2binpay/defi-sdk';

const { isValid, errors, normalizedAddress } = validateAddress({
  address: recipientAddress,
  networkChainId: CHAIN_ID,
  currency: selectedCurrency,
});

if (!isValid) {
  console.error('Invalid address:', errors);
}
```

The helper validates:
- EVM checksum (EIP-55) and format
- TRON Base58Check format and T-prefix
- Network / chain compatibility
- Currency match against the provided asset list

## Running the Examples

Clone the repository, install dependencies, and create a `.env` file:

```sh
git clone https://github.com/b2binpay/defi-sdk-nodejs.git
cd defi-sdk-nodejs
npm install
cp .env.example .env
# Edit .env with your API_BASE_URL, API_KEY, CHAIN_ID, RPC_URL, WALLET_PRIVATE_KEY
```

Available scripts:

| Script                                    | Description                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `npm run example:get-account-info`        | List deployments and per-chain balances                             |
| `npm run example:create-invoice`          | Create an invoice with currency lookup                              |
| `npm run example:get-invoice-details`     | Filter invoices, inspect deposits, show claimable assets            |
| `npm run example:create-payout`           | Create a payout and surface the queued operation                    |
| `npm run example:queue-sign`              | Build EIP-712 typed data, sign, and submit the signature            |
| `npm run example:queue-execute`           | Build and broadcast an execute transaction                          |
| `npm run example:queue-execute-batch`     | Execute two operations in a single transaction                      |
| `npm run example:claim-deposits`          | Build and broadcast a claim transaction                             |
| `npm run example:evm-full-flow`           | End-to-end EVM flow: invoice → payout → sign → execute → claim     |
| `npm run example:tron-get-account-info`   | TRON account info and balances                                      |
| `npm run example:tron-full-flow`          | End-to-end TRON flow                                                |

## Documentation

| Document                                   | Contents                                                          |
| ------------------------------------------ | ----------------------------------------------------------------- |
| [`docs/overview.md`](docs/overview.md)     | Architecture overview and high-level workflow                     |
| [`docs/api-client.md`](docs/api-client.md) | `DefiClient` configuration, all methods, error handling           |
| [`docs/transactions.md`](docs/transactions.md) | Transaction helpers, EIP-712/TIP-712, signature packing       |
| [`docs/contributing.md`](docs/contributing.md) | Repository setup, coding guidelines, release process          |

## Contributing

See [`docs/contributing.md`](docs/contributing.md) for repository conventions, build setup, and how to run the examples locally.

Bug reports and pull requests are welcome at [github.com/b2binpay/defi-sdk-nodejs](https://github.com/b2binpay/defi-sdk-nodejs/issues).

## License

MIT — see [LICENSE](LICENSE).
