# Transaction Utilities

This SDK exposes a cohesive set of helpers under `src/utils/transactions` to standardise interactions with the B2BinPay smart contract ecosystem.

## Modules
- `builders/`: Functions that create transaction payloads for contract methods. Currently includes `buildExecuteOperationsTransaction`, which encodes a `MultiSigWallet.execute` call for one or more queued operations.
- `eip712/`: Helpers for building EIP-712 typed data (`createExecuteTypedData`, `buildExecuteTypedMessage`) and optional sign helpers.
- `blockchain/MultisigBlockchainClient`: RPC-aware helper that wraps `eip712` utilities, producing execute-typed data while keeping API interactions optional; also exposes `buildClaimCalldata` for claim transactions.
- ABI definitions required by these helpers are stored under `src/abi` to keep contract interfaces versioned alongside the SDK.

## Design Goals
- **Type safety**: Reuse the same DTOs/ABI typings across builders, signers, and decoders.
- **Deterministic encoding**: Ensure every canonical contract call has a single builder that validates inputs before encoding.
- **Composable flows**: Allow apps to compose API data + transaction payload generation without duplicating logic.
- **Test coverage**: Each helper will include contract-level test vectors and integration fixtures.


- Use `buildExecuteOperationsTransaction` (via `transactions.builders` or `MultisigBlockchainClient.buildExecuteTransaction`) to encode on-chain `MultiSigWallet.execute` calls for one or many queue operations.
- Use `MultisigBlockchainClient.buildClaimCalldata` to assemble calldata for `claim`/`claimTo` when broadcasting claim transactions.
- See `examples/queue-sign.ts` for signing, `examples/queue-execute.ts` / `examples/queue-execute-batch.ts` for broadcasting execute transactions, and `examples/claim-deposits.ts` for claim calldata + broadcasting.

### Signing Queue Operations
When a payout is created, the backend enqueues a multisig operation. The `executeOperationId` exposed by the queue can be signed locally using:

```ts
const typedData = await transactions.createExecuteTypedData({
  contractAddress,
  operation,
  publicClient,
});

const signature = await account.signTypedData(typedData);
```

Submit the resulting signature with `submitOperationSignature` on the `DefiClient` to record approval. If you prefer a
higher-level abstraction, instantiate `MultisigBlockchainClient` and call `createExecuteTypedData` directly.
