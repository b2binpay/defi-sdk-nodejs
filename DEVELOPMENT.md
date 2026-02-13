# SDK

This repository hosts a TypeScript SDK that wraps the application's REST API and exposes higher-level utilities for working with the related smart contracts. The package is designed to be published to npm and consumed by web applications that need authenticated API calls plus transaction helpers built on top of `viem`.

## Repository Layout
- `src/api/` – hand-written wrappers around the generated OpenAPI client, including the `DefiClient` API helper.
- `src/utils/` – utility helpers for building/signing transaction payloads (decoders remain TODO).
- `src/blockchain/` – blockchain-focused clients, e.g., `MultisigBlockchainClient` that prepares EIP-712 payloads and exposes a shared viem `PublicClient` for contract reads.
- `src/abi/` – source-controlled contract ABIs (e.g., MultiSigWallet) reused across builders and decoders.
- `generated-contracts/` – OpenAPI-generated DTOs and API classes; updated through `npm run generate:api`.
- `examples/` – runnable examples that demonstrate the SDK end to end.
- `docs/` – in-depth documentation covering API usage, transaction utilities, and architecture decisions.
