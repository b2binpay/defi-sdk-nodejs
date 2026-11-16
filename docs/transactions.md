# Transaction Utilities

This document covers the blockchain interaction layer: EIP-712/TIP-712 typed-data helpers, transaction builders, signature packing, and the chain-aware client wrappers.

## MultisigBlockchainClient (EVM)

`MultisigBlockchainClient` (`src/blockchain/multisig-client.ts`) encapsulates EVM multisig operations using viem.

### Construction

```ts
import { createPublicClient, http } from 'viem';
import { MultisigBlockchainClient, getEvmChainById } from '@b2binpay/defi-sdk';

const chain = getEvmChainById(CHAIN_ID, process.env.RPC_URL!);
const publicClient = createPublicClient({ chain, transport: http(process.env.RPC_URL!) });

const contractAbi = await client.getContractAbi(); // from DefiClient

const multisig = new MultisigBlockchainClient({
  chainId: CHAIN_ID, // number or string
  publicClient,
  contractAbi,
});
```

### Methods

#### `createExecuteTypedData(args)`

Builds an EIP-712 typed-data payload for signing a pending multisig operation.

```ts
const typedData = await multisig.createExecuteTypedData({
  contractAddress: account.contract, // `account` from client.getAccount(); validated by the client
  operation,               // QueueOperation from getDeploymentQueue()
  domainOverride,          // optional: skip on-chain domain fetch
});

const signature = await account.signTypedData(typedData);
```

#### `buildExecuteTransaction(params)`

Encodes a `MultiSigWallet.execute()` call for one or more ready operations.

```ts
const tx = multisig.buildExecuteTransaction({
  contractAddress: account.contract,
  operations: [op1, op2], // one or more QueueOperations
});
// tx: { to, data, chainId, value }
await walletClient.sendTransaction(tx);
```

#### `buildClaimCalldata(params)`

Generates calldata for `claim(erc20, depositIds)` or, with `to`, `claimTo(erc20, to, depositIds)`. Throws on an
empty `depositIds`; `erc20: null` claims the native coin.

```ts
const calldata = multisig.buildClaimCalldata({
  erc20: currency.address, // null for the native coin
  depositIds: claims.items.map((c) => c.invoiceNonce),
  to: recipientAddress, // optional: omitted, the deposits are claimed into the multisig itself
});
```

---

## TronMultisigBlockchainClient (TVM)

`TronMultisigBlockchainClient` (`src/blockchain/tron-multisig-client.ts`) mirrors the EVM client for TRON chains.

### Construction

```ts
import { TronWeb } from 'tronweb';
import { TronMultisigBlockchainClient, transactions } from '@b2binpay/defi-sdk';

const tronWeb = new TronWeb({
  fullHost: process.env.RPC_URL!,
  privateKey: process.env.WALLET_PRIVATE_KEY,
});

const multisig = new TronMultisigBlockchainClient({
  chainId: CHAIN_ID, // number or string
  tronWeb,
  contractAbi, // from client.getContractAbi()
  defaultFeeLimit: 150_000_000, // 150 TRX in SUN
});
```

### Methods

#### `createExecuteTypedData(args)`

Builds a TIP-712 typed-data payload for signing.

```ts
const typedData = await multisig.createExecuteTypedData({
  contractAddress: account.contract, // `account` from client.getAccount(); validated by the client
  operation,
});

const { domain, types, message } = transactions.prepareTronTypedDataForSigning(typedData);
const signature = await tronWeb.trx._signTypedData(domain, types, message);
```

#### `buildExecuteTransaction(params)`

Encodes a TRON `execute()` transaction.

```ts
const tx = await multisig.buildExecuteTransaction({
  contractAddress: account.contract,
  callerAddress: signerAddress, // tronWeb.defaultAddress.base58, checked for `false`
  operations: [readyOp],
  feeLimit: 200_000_000, // optional override
});
await tronWeb.trx.sendRawTransaction(await tronWeb.trx.sign(tx.raw));
```

#### `buildClaimTransaction(params)`

Encodes a TRON claim transaction.

```ts
const tx = await multisig.buildClaimTransaction({
  contractAddress: account.contract,
  callerAddress: signerAddress, // tronWeb.defaultAddress.base58, checked for `false`
  erc20: currency.address,
  depositIds: claims.items.map((c) => c.invoiceNonce),
});
await tronWeb.trx.sendRawTransaction(await tronWeb.trx.sign(tx.raw));
```

---

## Chain Resolvers

```ts
import { getEvmChainById, getTronChainById, getChainById } from '@b2binpay/defi-sdk';

// Returns a viem Chain object for known EVM chains; throws on unknown IDs
const chain = getEvmChainById('11155111', process.env.RPC_URL);

// Returns a TronChainConfig ({ id, name, network, rpcUrls })
const tronChain = getTronChainById('728126428');

// Universal resolver — returns viem Chain or TronChainConfig
const unknown = getChainById(String(chainId));
```

---

## Low-Level Transaction Utilities

The utilities in `src/utils/transactions` are re-exported from the package under the `transactions` namespace. Use them if you need finer control than the blockchain clients provide.

### EIP-712 (EVM)

```ts
import { transactions } from '@b2binpay/defi-sdk';

// Full pipeline: fetch domain from contract, build message, return typed data
const typedData = await transactions.createExecuteTypedData({
  contractAddress,
  operation,
  publicClient,
  abi: contractAbi.abi, // from client.getContractAbi()
});

// Build a typed message directly (no RPC call)
const message = transactions.buildExecuteTypedMessage({ calls, nonce });

// Sign with a viem LocalAccount
const sig = await transactions.signExecuteTypedData({ account, typedData });
```

### TIP-712 (TVM)

```ts
import { transactions } from '@b2binpay/defi-sdk';

const typedData = transactions.buildTronExecuteTypedData({
  domain,
  calls,
  nonce, // bigint
});

// Prepare for TronWeb signing (converts BigInt to string)
const signable = transactions.prepareTronTypedDataForSigning(typedData);
```

### Signature Packing

Signatures are packed automatically by `submitOperationSignature`. If you need direct access:

```ts
import { transactions } from '@b2binpay/defi-sdk';

// EVM
const packed = transactions.packSignatures([{ user: signer, sign: signature }], contractVersion);

// TVM
const packedTron = transactions.packTronSignatures([{ signer, signature }], contractVersion);
```

- **v1.0.0**: raw 65-byte ECDSA signatures sorted and concatenated
- **v1.1.0**: `[signer:20 bytes][sigLen:2 bytes uint16 BE][sig:sigLen bytes]` entries sorted by signer address and concatenated.

---

## Signing Flow Summary

```
createPayout()
    ↓
getDeploymentQueue()        — fetch pending operation
    ↓
createExecuteTypedData()    — build EIP-712 / TIP-712 payload
    ↓
wallet.signTypedData()      — sign off-chain
    ↓
submitOperationSignature()  — submit to API (auto-packs signature)
    ↓
waitForQueueOperation()     — wait until status = Ready
    ↓
buildExecuteTransaction()   — encode on-chain call
    ↓
walletClient.sendTransaction() — broadcast
```

See [`examples/evm-full-flow.ts`](../examples/evm-full-flow.ts) and [`examples/tron-full-flow.ts`](../examples/tron-full-flow.ts) for end-to-end runnable examples.
