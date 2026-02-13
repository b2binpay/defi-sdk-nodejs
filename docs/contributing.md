# Contributing Guide

## Prerequisites
- Node `^22.16.0` and npm `^10.9.2`.
- Access to the OpenAPI specification for regenerating `generated-contracts/`.
- Wallet tooling capable of signing messages for integration testing.

## Project Commands
- `npm install`: Install dependencies.
- `npm run generate:api`: Regenerate REST client from the remote OpenAPI spec.
- `npm run lint`: Check and format code with Biome.
- `npm run example:get-account-info`: Run the reference example (requires `.env`).
- `npx tsc --noEmit`: Type-check the project.

## Workflow
1. Update or regenerate API contracts as needed.
2. Implement changes inside `src/` (API layer or utilities).
3. Add or update documentation under `docs/`.
4. Update examples/tests to reflect new behaviour.
5. Run `npx tsc --noEmit` before opening a PR.

## Coding Guidelines
- Prefer TypeScript modules in `src/` with explicit named exports.
- Keep shared interfaces/types in dedicated files when used by multiple modules.
- Favour composition over inheritance; expose helper functions over classes unless stateful behaviour is required.
- Limit comments to non-obvious logic and architectural decisions.

## Release Preparation
- Ensure `generated-contracts/` is up to date and committed.
- Bump the version in `package.json` (to be configured once publishing is in place).
- Attach release notes referencing relevant documentation updates.

For architectural orientation review `docs/overview.md` first, then reference module-specific guides.
