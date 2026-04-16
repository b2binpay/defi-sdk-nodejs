# Contributing Guide

## Prerequisites

- Node.js `^22.16.0` and npm `^10.9.2`
- Access to the OpenAPI specification for regenerating `generated-contracts/`
- A wallet private key and API credentials for running integration examples

## Project Commands

- `npm install`: Install dependencies.
- `npm run build`: Compile TypeScript to `dist/` using `tsconfig.build.json`.
- `npm test`: Run the test suite (`jest`).
- `npm run lint`: Check and format code with Biome.
- `npm run lint:fix`: Auto-fix Biome issues.
- `npm run generate:api`: Regenerate REST client from the remote OpenAPI spec.
- `npm run generate:api:local`: Same as above but using `openapitools.local.json`.
- `npx tsc --noEmit`: Type-check the project without emitting files.
- `npm run example:get-account-info`: Run the reference example (requires `.env`).

## Running Examples

Copy `.env.example` to `.env` and fill in the required values:

```sh
cp .env.example .env
```

Required variables: `API_BASE_URL`, `API_KEY`, `CHAIN_ID`, `RPC_URL`, `WALLET_PRIVATE_KEY`.
See `.env.example` for the full list including optional TRON-specific variables.

## Workflow

1. Update or regenerate API contracts as needed with `npm run generate:api`.
2. Implement changes inside `src/` (API layer or utilities).
3. Add or update tests under `src/**/*.spec.ts`.
4. Update documentation under `docs/` and examples under `examples/`.
5. Run `npm run lint` and `npx tsc --noEmit` before opening a PR.

## Coding Guidelines

- Use TypeScript strict mode; avoid `any` — use `unknown` with type guards.
- Do not use `as` casts to suppress type errors; fix the underlying type instead.
- Prefer named exports; keep shared types in dedicated files when used across modules.
- Favour composition over inheritance; expose helper functions over classes unless stateful behaviour is required.
- Limit comments to non-obvious logic and architectural decisions.

## Code Generation

`generated-contracts/` is fully generated — never edit it manually. Regenerate when the OpenAPI spec changes:

```sh
npm run generate:api
```

## Release Preparation

- Ensure `generated-contracts/` is up to date and committed.
- Verify all examples run against the target environment.
- Run `npm test`, `npm run lint`, and `npx tsc --noEmit`.
- Version is managed by CI — do not modify it manually in `package.json`.

For architectural orientation review `docs/overview.md` first, then reference module-specific guides.
