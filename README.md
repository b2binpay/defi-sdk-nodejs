# @b2binpay/defi-sdk

[![npm version](https://img.shields.io/npm/v/@b2binpay/defi-sdk.svg)](https://www.npmjs.com/package/@b2binpay/defi-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

TypeScript SDK for the [B2BinPay DeFi](https://defi.b2binpay.com) platform — authenticated REST API access and blockchain transaction utilities for building non-custodial payment flows with multisig smart contracts.

## Features

- **Multi-chain** — EVM-compatible networks (Ethereum, BSC, Sepolia, …) and TRON (Mainnet, Nile)
- **Invoices & Payouts** — full lifecycle management: create, query, update
- **Multisig operations** — EIP-712 / TIP-712 typed-data signing, signature packing, on-chain execution
- **TRON staking** — Stake 2.0 freeze/unfreeze, resource delegation, and Super Representative voting
- **Cross-chain transfers** — quote and create transfers between chains
- **Operation & transaction history** — logical operations (v2) and on-chain blockchain transactions
- **Claims** — enumerate claimable deposits and build claim calldata
- **Address validation** — checksum + network + currency compatibility checks before write operations
- **Type-safe** — complete TypeScript types from the OpenAPI spec plus handcrafted blockchain types
- **Built on viem** — EVM blockchain interactions powered by [viem](https://viem.sh)

## Requirements

- Node.js 20 or newer
- Working in this repository (examples, tests) needs Node.js ^24.16.0 and npm ^12.1.0 (`devEngines`)

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
  trackingId: 'order-42',
});
console.log('Invoice ID:', invoice.id);
```

## Authentication

All requests use an API key sent as the `x-api-key` header. Pass it once at construction — the SDK attaches it to every request automatically. No token exchange or refresh is required.

Each API key is scoped to a single account. The SDK resolves the account and deployment IDs internally; you never need to pass `accountId` explicitly.

## EVM — Multisig Operation Flow

Payouts are executed on-chain through a multisig wallet. The typical flow is:

1. **Create a payout** — the API enqueues a multisig operation and returns its `queueOperationId`
2. **Fetch the queue operation** — `getQueueOperation({ operationId })`
3. **Build EIP-712 typed data and sign** — produce the off-chain approval
4. **Submit the signature** — the API records approval; once the signing threshold is met the operation becomes `READY`
5. **Execute on-chain** — wait for `READY`, then broadcast the `execute` transaction

```ts
import { createPublicClient, http } from 'viem';
import { DefiClient, MultisigBlockchainClient, OperationTypeV2, getEvmChainById } from '@b2binpay/defi-sdk';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_ID = 11155111; // Sepolia

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});

// Step 1: resolve the multisig contract and ABI
await client.selectChain(CHAIN_ID);
const { account } = await client.getAccount();
const contractAbi = await client.getContractAbi();

// Step 2: create payout
const currency = await client.getNativeCurrency({ chainId: CHAIN_ID });
const payout = await client.createPayout({
  currencyId: currency.id,
  amount: '0.001',
  recipient: '0xRecipientAddress',
});

// Step 3: set up viem and the multisig client
const chain = getEvmChainById(CHAIN_ID, process.env.RPC_URL!);
const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL!) });

const multisig = new MultisigBlockchainClient({ chainId: CHAIN_ID, publicClient, contractAbi });

// Step 4: sign
const operation = await client.getQueueOperation({ operationId: payout.queueOperationId! });

const typedData = await multisig.createExecuteTypedData({
  contractAddress: account.contract,
  operation,
});

const signer = privateKeyToAccount(process.env.WALLET_PRIVATE_KEY as `0x${string}`);
const rawSignature = await signer.signTypedData(typedData);

await client.submitOperationSignature({
  operationId: operation.id,
  signature: rawSignature,
  signerAddress: signer.address,
});

// Step 5: execute once enough approvers have signed (polls; rejects if the operation is cancelled)
const readyOp = await client.waitForQueueOperation({ operationId: operation.id });

const tx = multisig.buildExecuteTransaction({
  contractAddress: account.contract,
  operations: [readyOp],
});

// Broadcast with a viem WalletClient
import { createWalletClient } from 'viem';
const walletClient = createWalletClient({ account: signer, chain, transport: http(process.env.RPC_URL!) });
const hash = await walletClient.sendTransaction(tx);

// A reverted transaction still yields a receipt — check its status
const receipt = await publicClient.waitForTransactionReceipt({ hash });
if (receipt.status !== 'success') {
  throw new Error(`Execute ${hash} reverted`);
}

// Wait for the indexer to confirm the payout
await client.waitForTransactionOperations({ txHash: hash, type: OperationTypeV2.Payout });
```

See [`examples/evm-full-flow.ts`](examples/evm-full-flow.ts) for a complete runnable walkthrough including automatic deposit and confirmation polling.

## TRON — Multisig Operation Flow

The TRON flow mirrors EVM but uses `TronMultisigBlockchainClient` and `tronweb` for signing and broadcasting.

```ts
import { TronWeb } from 'tronweb';
import {
  DefiClient,
  OperationTypeV2,
  QueueOperationStatus,
  TronMultisigBlockchainClient,
  transactions,
} from '@b2binpay/defi-sdk';

// TRON Mainnet. The Nile testnet (3448148188) is disabled by default and enabled for testing on request.
const CHAIN_ID = 728126428;

const client = new DefiClient({
  baseUrl: 'https://api.defi.b2binpay.com',
  apiKey: process.env.API_KEY!,
});

await client.selectChain(CHAIN_ID);
const { account } = await client.getAccount();
const contractAbi = await client.getContractAbi();

const tronWeb = new TronWeb({
  fullHost: process.env.RPC_URL!,
  privateKey: process.env.WALLET_PRIVATE_KEY,
});
const signerAddress = tronWeb.defaultAddress.base58;
if (!signerAddress) {
  throw new Error('TronWeb has no default address — check WALLET_PRIVATE_KEY.');
}

const multisig = new TronMultisigBlockchainClient({
  chainId: CHAIN_ID,
  tronWeb,
  contractAbi,
  defaultFeeLimit: 150_000_000, // 150 TRX in SUN
});

// Sign the oldest operation still waiting for approvals
const { items } = await client.getDeploymentQueue({ statuses: [QueueOperationStatus.Pending] });
const operation = items[0];

const typedData = await multisig.createExecuteTypedData({
  contractAddress: account.contract,
  operation,
});

const { domain, types, message } = transactions.prepareTronTypedDataForSigning(typedData);
const rawSignature = await tronWeb.trx._signTypedData(domain, types, message);
await client.submitOperationSignature({
  operationId: operation.id,
  signature: rawSignature,
  signerAddress,
});

// Execute
const readyOp = await client.waitForQueueOperation({ operationId: operation.id });
const tx = await multisig.buildExecuteTransaction({
  contractAddress: account.contract,
  callerAddress: signerAddress,
  operations: [readyOp],
});
const signedTx = await tronWeb.trx.sign(tx.raw);
const broadcast = await tronWeb.trx.sendRawTransaction(signedTx);
if (!broadcast.result) {
  throw new Error(`Broadcast rejected: ${broadcast.code} ${broadcast.message}`);
}

// Wait for the indexer to confirm the payout
await client.waitForTransactionOperations({ txHash: broadcast.txid, type: OperationTypeV2.Payout });
```

See [`examples/tron-full-flow.ts`](examples/tron-full-flow.ts) for the complete TRON walkthrough.

## Claims

Deposits received to the multisig wallet must be explicitly claimed on-chain.

```ts
import { fetchAll } from '@b2binpay/defi-sdk';

// Claim every deposit of one currency in a single transaction
const [currency] = await client.getClaimableCurrencies();
const claims = await fetchAll((p) => client.getClaims(p), { currencyIds: [currency.id] });

const calldata = multisig.buildClaimCalldata({
  erc20: currency.address, // null for the native coin
  depositIds: claims.map((c) => c.invoiceNonce),
  to: recipientAddress, // optional — omit to claim to the multisig contract itself
});

const hash = await walletClient.sendTransaction({
  to: account.contract as `0x${string}`, // viem's sendTransaction wants a typed address
  data: calldata,
});
```

For TRON, use `multisig.buildClaimTransaction(...)`, sign `tx.raw` with `tronWeb.trx.sign()` and broadcast the
result with `tronWeb.trx.sendRawTransaction()`.

## Callbacks (Webhooks)

Every callback is signed: `X-CALLBACK-SIGNATURE` is the hex HMAC-SHA256 of the raw request body under
your callback secret. `parseCallback` verifies it in constant time and returns the typed event; verify
against the body bytes as received — a re-serialized object will not match.

```ts
import express from 'express';
import {
  CALLBACK_SIGNATURE_HEADER,
  CallbackPayloadError,
  CallbackSignatureError,
  isSettingsCallbackEvent,
  parseCallback,
} from '@b2binpay/defi-sdk';

const app = express();

app.post('/webhooks/defi', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    const event = parseCallback({
      rawBody: req.body, // Buffer, thanks to express.raw()
      signature: req.headers[CALLBACK_SIGNATURE_HEADER],
      secret: process.env.CALLBACK_SECRET!,
    });

    // `id` is stable across redeliveries — use it to drop duplicates.
    if (isSettingsCallbackEvent(event)) {
      console.log(event.group, event.entity, event.event, event.data);
    } else {
      console.log(event.type, event.operation_id, event.data);
    }
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof CallbackSignatureError) {
      return res.sendStatus(401); // not from the API — do not act on it
    }
    if (err instanceof CallbackPayloadError) {
      console.warn('Unrecognised signed callback', err.body);
      return res.sendStatus(200); // genuine delivery; an error status only makes the API redeliver it
    }
    throw err;
  }
});
```

`verifyCallbackSignature` returns the boolean alone if you parse the body yourself.

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

Examples load `.env` through `dotenv/config`. To keep several environments side by side, point `DOTENV_CONFIG_PATH` at another file: `DOTENV_CONFIG_PATH=.env.nile npm run example:tron-full-flow`.

Available scripts:

| Script                                    | Description                                                         |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `npm run example:get-account-info`        | List deployments and per-chain balances                             |
| `npm run example:create-invoice`          | Create an invoice with currency lookup                              |
| `npm run example:get-invoice-details`     | Filter invoices, inspect deposits, show claimable assets            |
| `npm run example:create-payout`           | Create a payout and surface the queued operation                    |
| `npm run example:queue-sign`              | Build EIP-712 typed data, sign, and submit the signature            |
| `npm run example:queue-execute`           | Build and broadcast an execute transaction                          |
| `npm run example:queue-execute-batch`     | Execute the backend-reported batch candidates in a single transaction |
| `npm run example:claim-deposits`          | Build and broadcast a claim transaction                             |
| `npm run example:evm-full-flow`           | End-to-end EVM flow: invoice → payout → sign → execute → claim     |
| `npm run example:tron-get-account-info`   | TRON account info and balances                                      |
| `npm run example:tron-create-invoice`     | Create a TRON invoice with currency lookup                          |
| `npm run example:tron-create-payout`      | Create a TRON payout and surface the queued operation               |
| `npm run example:tron-claim-deposits`     | Build and broadcast a TRON claim transaction                        |
| `npm run example:tron-queue-sign`         | Build TIP-712 typed data, sign, and submit the signature            |
| `npm run example:tron-queue-execute`      | Build and broadcast a TRON execute transaction                      |
| `npm run example:tron-queue-execute-batch`| Execute the backend-reported TRON batch candidates in one transaction |
| `npm run example:tron-full-flow`          | End-to-end TRON flow                                                |
| `npm run example:tron-staking-flow`       | Read staking summary, create a TRON stake, sign and execute it on-chain |
| `npm run example:get-operations-v2`       | List v2 operations and fetch typed operation details                |
| `npm run example:get-blockchain-transactions` | List blockchain transactions and fetch one by id                |

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
