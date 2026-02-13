# SDK

## Quick Start

All API calls are authenticated via an API key supplied in the `x-api-key` header. Pass the key when creating `DefiClient` and the SDK will attach it automatically.

```ts
import {
  FiatCurrency,
  InvoiceStatus,
  PayoutStatus,
  DefiClient,
} from '@b2binpay/defi-sdk';

const client = new DefiClient({
  baseUrl: 'https://api.example.com',
  apiKey: process.env.API_KEY!,
});

async function bootstrap() {
  const accounts = await client.getAccounts();
  console.log('Discovered accounts via API key:', accounts.map((account) => account.name));

  const accountDetails = await client.getAccount();
  const deployments = await client.getDeployments(accountDetails);
  console.log('Available deployments:', deployments.map((item) => `${item.chainId}:${item.deploymentStatus}`));
  const deployment = await client.selectChain(1);
  const balance = await client.getAccountBalanceSummary({
    chainId: 1,
    baseCurrency: FiatCurrency.Usd,
  });

  console.log(accountDetails.account.name, balance.totalBalance);
  console.log('Active deployment:', deployment.deploymentId);

  // Need chain-specific helpers?
  const nativeCurrency = await client.getNativeCurrency(1);
  const invoices = await client.getInvoices({
    statuses: [InvoiceStatus.Created],
    pageSize: 10,
  });
}

bootstrap();
```

### Invoices, Payouts & Transactions

```ts
import { PayoutStatus } from '@b2binpay/defi-sdk';

await client.selectChain(1);

const usdCoin = await client.findCurrencyBySymbol({ symbol: 'USDT', chainId: 1 });

const invoice = await client.createInvoice({
  requestedAmount: '100',
  currencyIds: [usdCoin.id],
  callbackUrl: 'https://merchant.example/callback',
  trackingId: 'INV-42',
});

// To cancel an invoice, use updateInvoice to set status to CANCELLED
await client.updateInvoice({
  invoiceId: invoice.id,
  status: InvoiceStatus.Cancelled
});

const payouts = await client.getPayouts({
  statuses: [PayoutStatus.Created],
});

const transactions = await client.getTransactions({
  operationTypes: ['payout'],
  pageSize: 20,
});
```

### Claims & Address Validation

```ts
import { validateAddress } from '@b2binpay/defi-sdk';

const chainId = 1;
await client.selectChain(chainId);

const claims = await client.getClaims({});
const currencies = await client.getClaimableCurrencies();

// Use MultisigBlockchainClient.buildClaimCalldata() to build claim transactions
// See examples/claim-deposits.ts for complete claim flow

const { isValid, errors } = validateAddress({
  address: env.PAYOUT_RECIPIENT,
  networkChainId: chainId,
  currency: currencies[0],
});
```

### Blockchain Helpers

When you need to prepare multisig payloads or read on-chain state, instantiate the blockchain-specific client:

```ts
import { MultisigBlockchainClient } from '@b2binpay/defi-sdk';
import { createPublicClient, defineChain, http } from 'viem';

const publicClient = createPublicClient({
  chain: defineChain({
    id: 1,
    name: 'mainnet',
    network: 'mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: {
      default: { http: [process.env.RPC_URL!] },
      public: { http: [process.env.RPC_URL!] },
    },
  }),
  transport: http(process.env.RPC_URL!),
});

const multisig = new MultisigBlockchainClient({
  chainId: 1,
  publicClient,
});

const typedData = await multisig.createExecuteTypedData({
  contractAddress: deployment.contract as `0x${string}`,
  operation,
});

const signature = await wallet.signTypedData(typedData);
```

## CLI Scripts
- `npm run example:get-account-info` – authenticates, lists deployments, prints per-chain balance summaries, and shows non-zero asset balances.
- `npm run example:create-invoice` – creates an invoice (currency resolved by ID or symbol), applies optional callbacks, and prints invoice details.
- `npm run example:get-invoice-details` – lists invoices by filters, fetches invoice details by ID, shows recent deposits, and prints claimable assets.
- `npm run example:create-payout` – creates a payout and surfaces the queue operation for later signing/execution.
- `npm run example:queue-sign` – finds the first signable operation, builds EIP-712 typed data, signs, and submits the signature.
- `npm run example:queue-execute` – finds the first executable operation, builds an execute transaction, broadcasts it, and waits for confirmation.
- `npm run example:queue-execute-batch` – if two operations are executable, executes them together in one transaction.
- `npm run example:claim-deposits` – enumerates claimable deposits, builds claim calldata, broadcasts the transaction, and fetches recent claim activity.
- `npm run generate:api` – regenerate `generated-contracts/` from the OpenAPI spec.

### Examples
- `examples/get-account-info.ts` – authenticate via API key, discover accounts, list deployments, and show balance summaries plus non-zero assets.
- `examples/create-invoice.ts` – create an invoice with callbacks and tracking metadata using a currency ID or symbol lookup.
- `examples/get-invoice-details.ts` – filter invoices, fetch invoice details by ID, inspect recent incoming transactions, and list claimable assets.
- `examples/create-payout.ts` – authenticate, create a payout, and surface its queue operation for follow-up signing/execution.
- `examples/queue-sign.ts` – locate a signable queue operation, build EIP-712 typed data, and submit a signature.
- `examples/queue-execute.ts` – find the first executable operation, broadcast the execute transaction, and wait for confirmation.
- `examples/queue-execute-batch.ts` – execute two ready operations in a batch using one transaction.
- `examples/claim-deposits.ts` – enumerate claimable invoices, build and broadcast a claim transaction, and fetch recent claim transactions.

### Environment Variables
- `API_BASE_URL`, `API_KEY` – REST endpoint and API key used for authenticated requests.
- `CHAIN_ID` – EVM chain identifier.
- `BALANCE_BASE_CURRENCY` – optional base currency (`usd`/`eur`/`cny`) for balance summaries in `get-account-info`.
- `WALLET_PRIVATE_KEY` – local hex key for signing multisig transactions (queue-sign/queue-execute).
- `RPC_URL` – JSON-RPC endpoint for the target chain (queue-sign/queue-execute examples).
- `PAYOUT_AMOUNT_WEI` or `PAYOUT_AMOUNT` – payout amount (preferred in wei; falls back to decimal string).
- `PAYOUT_CURRENCY_ID`, `PAYOUT_RECIPIENT`, `PAYOUT_CALLBACK_URL`, `PAYOUT_TRACKING_ID` – payout configuration (currency defaults to native if not provided).
- `INVOICE_CURRENCY_ID`, `INVOICE_CURRENCY_SYMBOL` – pick one to resolve invoice currency; symbol lookup filters by chain.
- `INVOICE_AMOUNT`, `INVOICE_CALLBACK_URL`, `INVOICE_TRACKING_ID`, `INVOICE_PAYMENT_PAGE_URL`, `INVOICE_PAYMENT_PAGE_TEXT` – invoice creation metadata.
- `INVOICE_ID` – target invoice for `get-invoice-details`.
- `INVOICE_STATUSES`, `INVOICE_CREATED_FROM`, `INVOICE_CREATED_TO`, `INVOICE_UPDATED_FROM`, `INVOICE_UPDATED_TO`, `INVOICE_PAGE_SIZE`, `INVOICE_TRACKING_ID`, `INVOICE_CURRENCY_ID` – invoice listing filters for `get-invoice-details`.
- `CLAIM_INVOICE_ID`, `CLAIM_CURRENCY_ID`, `CLAIM_PAGE_SIZE` – optional filters for claimable deposits in `claim-deposits`; calldata is built automatically via `MultisigBlockchainClient.buildClaimCalldata`.
- Account ownership is implicit—each API key maps to a single account, so the SDK auto-selects it and never asks for an `accountId`.
- Call `await client.selectChain(Number(process.env.CHAIN_ID))` (or pass `chainId` per method) before invoking any chain-scoped APIs such as invoices, payouts, or claims.

## Documentation
Extended documentation lives in the `docs/` folder:
- `docs/overview.md` – high-level summary of the SDK.
- `docs/api-client.md` – authentication flow, configuration options, and caching details.
- `docs/transactions.md` – roadmap and reference for the transaction helper layer.
- `docs/contributing.md` – repository conventions, build scripts, and release guidelines.

Start with `docs/overview.md` for guidance on how the pieces fit together and where to contribute.
