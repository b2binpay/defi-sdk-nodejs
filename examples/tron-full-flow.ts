/**
 * Tron full-flow example:
 * Demonstrates the complete money lifecycle on a Tron chain using the DefiSDK.
 *
 * Steps:
 *   1. Setup    — authenticate, select chain, print initial balances
 *   2. Invoice  — create a native TRX invoice and send deposit via TronWeb
 *   3. Deposit  — poll transactions API until deposit appears, then wait for CONFIRMED status
 *   4. Claim    — build and broadcast claim tx, wait for confirmation
 *   5. Payout   — create a USDT payout to a test address
 *   6. Sign     — build TIP-712 typed data and submit signature
 *   7. Execute  — wait for the operation to be ready, then broadcast execute tx
 *   8. Summary  — print final account balances
 *
 * Required environment variables:
 *   API_BASE_URL         — DeFi API base URL
 *   API_KEY              — API key
 *   CHAIN_ID        — Tron chain ID (e.g. 728126428 for mainnet, 2494104990 for Shasta)
 *   RPC_URL         — TronWeb full host URL
 *   WALLET_PRIVATE_KEY     — hex private key of the signer wallet
 *   PAYOUT_RECIPIENT — Tron address to receive the payout
 *
 * Optional:
 *   POLL_INTERVAL_MS     — polling interval in ms (default: 5000)
 *   POLL_TIMEOUT_MS      — maximum polling time in ms (default: 300000 / 5 min)
 *   PAYOUT_CURRENCY      — payout currency symbol (default: USDT)
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { instanceOfPayoutPayload } from '../generated-contracts';
import {
  AssetSortField,
  AssetSortOrder,
  type ClaimItem,
  DefiClient,
  FiatCurrency,
  OperationTypeV2,
  type OperationV2,
  OperationV2Status,
  type QueueOperation,
  QueueOperationStatus,
  TRON_ZERO_ADDRESS,
  type TronAddress,
  TronMultisigBlockchainClient,
  transactions,
} from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

const REQUIRED_ENV = [
  'API_BASE_URL',
  'API_KEY',
  'CHAIN_ID',
  'RPC_URL',
  'WALLET_PRIVATE_KEY',
  'PAYOUT_RECIPIENT',
] as const;

const INVOICE_AMOUNT = '1';
const PAYOUT_AMOUNT = '1.00';
const BASE_CURRENCY = FiatCurrency.Usd;
const TX_RECEIPT_TIMEOUT_MS = 120_000;
const TX_RECEIPT_POLL_MS = 3_000;
const TRON_SUN_PER_TRX = 1_000_000;

runMain(async () => {
  const env = requireEnvVars(REQUIRED_ENV);
  const chainId = parseChainId(env.CHAIN_ID);
  const pollInterval = Number(process.env.POLL_INTERVAL_MS ?? '5000');
  const pollTimeout = Number(process.env.POLL_TIMEOUT_MS ?? '300000');
  const payoutCurrencySymbol = process.env.PAYOUT_CURRENCY ?? 'USDT';

  // ─── Step 1: Setup ───────────────────────────────────────────────────────────
  console.log('\n═══ Step 1: Setup ═══');

  const tronWeb = new TronWeb({
    fullHost: env.RPC_URL,
    privateKey: env.WALLET_PRIVATE_KEY,
  });

  const signerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!signerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }
  console.log('Signer address:', signerAddress);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  console.log('Account:', accountDetails.account.name, `(${accountDetails.account.id})`);
  console.log('Contract:', accountDetails.account.contract);

  await client.selectChain(chainId);
  console.log('Chain ID:', chainId);

  const contractAbi = await client.getContractAbi();
  const tronClient = new TronMultisigBlockchainClient({
    chainId,
    tronWeb,
    contractAbi,
    defaultFeeLimit: DEFAULT_FEE_LIMIT,
  });

  const chainIdNumber = Number.parseInt(chainId, 10);
  const initialBalances = await client.getAssetBalances({
    chainId,
    baseCurrency: BASE_CURRENCY,
    sortBy: AssetSortField.Balance,
    sortOrder: AssetSortOrder.Desc,
    pageSize: 20,
  });

  const nonZeroInitial = initialBalances.items.filter((b) => Number(b.balance) > 0);
  if (nonZeroInitial.length > 0) {
    console.log('Initial balances:');
    console.table(nonZeroInitial.map((b) => ({ symbol: b.currency.symbol, balance: b.balance })));
  } else {
    console.log('Initial balances: all zero.');
  }

  const summary = await client.getAccountBalanceSummary({ chainId: chainIdNumber, baseCurrency: BASE_CURRENCY });
  console.log('Balance summary (USD):');
  console.table({
    total: summary.totalBalance,
    uncollected: summary.uncollectedBalance,
    uncollectedInvoices: summary.uncollectedInvoices,
  });

  // ─── Step 2: Invoice ─────────────────────────────────────────────────────────
  console.log('\n═══ Step 2: Create invoice ═══');

  const nativeCurrency = await client.getNativeCurrency(chainId);
  console.log(`Native currency: ${nativeCurrency.symbol} (${nativeCurrency.id})`);

  const trackingId = `TRON-FULL-FLOW-${Date.now()}`;

  const invoice = await client.createInvoice({
    requestedAmount: INVOICE_AMOUNT,
    trackingId,
    callbackUrl: null,
    paymentPageButtonUrl: null,
    paymentPageButtonText: null,
    currencyIds: [nativeCurrency.id],
  });

  console.log('Created invoice:');
  console.table({
    id: invoice.id,
    trackingId: invoice.trackingId,
    status: invoice.status,
    amount: invoice.requestedAmount ?? 'open',
    address: invoice.invoiceAddress,
    paymentPageUrl: invoice.paymentPageUrl,
  });

  const depositAmountSun = Number(INVOICE_AMOUNT) * TRON_SUN_PER_TRX;
  console.log(`\nSending ${INVOICE_AMOUNT} ${nativeCurrency.symbol} to invoice address ${invoice.invoiceAddress}...`);
  const depositResult = await tronWeb.trx.sendTrx(invoice.invoiceAddress, depositAmountSun);
  const depositTxId: string = depositResult.txid;
  console.log('Deposit tx broadcasted:', depositTxId);

  await waitForTronReceipt(tronWeb, depositTxId);
  console.log('Deposit tx confirmed on-chain.');

  // ─── Step 3: Wait for deposit ─────────────────────────────────────────────────
  console.log('\n═══ Step 3: Waiting for deposit ═══');

  const confirmedTx = await waitForTxConfirmation(
    client,
    depositTxId,
    OperationTypeV2.InvoiceDeposit,
    pollInterval,
    pollTimeout,
  );

  console.log('Deposit confirmed:');
  console.table({
    txHash: confirmedTx.txHash,
    status: confirmedTx.status,
    confirmations: confirmedTx.confirmations,
    confirmedAt: confirmedTx.confirmedAt,
  });

  const claimsResult = await client.getClaims({ invoiceId: invoice.id, pageSize: 50 });
  const claimItems: ClaimItem[] = claimsResult.items;

  if (claimItems.length === 0) {
    throw new Error(`No claimable items found for invoice ${invoice.id} after transaction was confirmed.`);
  }

  // ─── Step 4: Claim ────────────────────────────────────────────────────────────
  console.log('\n═══ Step 4: Claim ═══');

  const contractAddress = accountDetails.account.contract as TronAddress;
  const callerAddress = signerAddress as TronAddress;

  const currencyGroups = new Map<string, ClaimItem[]>();
  for (const item of claimItems) {
    const key = item.currency.id;
    const group = currencyGroups.get(key) ?? [];
    group.push(item);
    currencyGroups.set(key, group);
  }

  for (const [, items] of currencyGroups) {
    const currency = items[0].currency;
    const depositIds = items.map((item) => item.invoiceNonce);
    const erc20Address = (currency.address ?? TRON_ZERO_ADDRESS) as TronAddress;

    console.log(`Claiming ${currency.symbol} for ${items.length} invoice(s)...`);

    const claimTx = await tronClient.buildClaimTransaction({
      contractAddress,
      callerAddress,
      erc20: erc20Address,
      depositIds,
    });

    const signedClaimTx = await tronWeb.trx.sign(claimTx.raw as Parameters<typeof tronWeb.trx.sign>[0]);
    const claimResult = await tronWeb.trx.sendRawTransaction(
      signedClaimTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0],
    );

    const claimTxId: string = claimResult.txid;
    console.log('Claim tx broadcasted:', claimTxId);

    await waitForTronReceipt(tronWeb, claimTxId);
    console.log('Claim tx confirmed on-chain.');

    console.log('Waiting for claim transaction confirmation via API...');
    const confirmedClaim = await waitForTxConfirmation(
      client,
      claimTxId,
      OperationTypeV2.Claim,
      pollInterval,
      pollTimeout,
    );
    console.log(`Claim confirmed: ${confirmedClaim.confirmations} confirmations`);
  }

  // ─── Step 5: Payout ───────────────────────────────────────────────────────────
  console.log('\n═══ Step 5: Create payout ═══');

  const queueBefore = await client.getDeploymentQueue({
    statuses: [QueueOperationStatus.Pending, QueueOperationStatus.Ready],
    pageSize: 100,
  });
  if (queueBefore.items.length > 0) {
    console.log(
      `Found ${queueBefore.items.length} pending/ready queue operation(s); deleting before creating payout...`,
    );
    const deletedIds = await client.deleteAllQueueOperations();
    console.log(`Deleted ${deletedIds.length} operation(s).`);

    const queueAfter = await client.getDeploymentQueue({
      statuses: [QueueOperationStatus.Pending, QueueOperationStatus.Ready],
      pageSize: 100,
    });
    if (queueAfter.items.length > 0) {
      const leftover = queueAfter.items.map((op) => `${op.id} (${op.operationType}, ${op.status})`).join(', ');
      throw new Error(
        `Queue still has ${queueAfter.items.length} operation(s) after cleanup — resolve them manually before continuing: ${leftover}`,
      );
    }
  }

  const payoutCurrency = await client.findCurrencyBySymbol({ symbol: payoutCurrencySymbol });

  const payout = await client.createPayout({
    currencyId: payoutCurrency.id,
    amount: PAYOUT_AMOUNT,
    recipient: env.PAYOUT_RECIPIENT,
    trackingId: `PAYOUT-${trackingId}`,
  });

  console.log('Payout created:');
  console.table({
    id: payout.id,
    status: payout.status,
    amount: `${payout.amount} ${payout.currency.symbol}`,
    recipient: payout.toAddress,
  });

  const payoutOperation = await poll<QueueOperation>(
    'payout queue operation',
    async () => {
      const queue = await client.getDeploymentQueue({ pageSize: 100 });
      const op = queue.items.find(
        (item) =>
          item.operationType === 'PAYOUT' &&
          item.payload != null &&
          instanceOfPayoutPayload(item.payload) &&
          item.payload.payoutId === payout.id,
      );
      return op ?? null;
    },
    pollInterval,
    pollTimeout,
  );

  console.log('Queue operation:');
  console.table({
    id: payoutOperation.id,
    nonce: payoutOperation.nonce,
    status: payoutOperation.status,
    signaturesCollected: payoutOperation.signaturesCollected,
    signaturesRequired: payoutOperation.signaturesRequired,
  });

  // ─── Step 6: Sign ─────────────────────────────────────────────────────────────
  console.log('\n═══ Step 6: Sign ═══');

  const typedData = await tronClient.createExecuteTypedData({
    contractAddress,
    operation: payoutOperation,
  });

  const { domain, types, message } = transactions.prepareTronTypedDataForSigning(typedData);
  const signature = await tronWeb.trx._signTypedData(domain, types, message);
  console.log('Signature:', `${signature.slice(0, 20)}...`);

  const signatureResponse = await client.submitOperationSignature({
    operationId: payoutOperation.id,
    signature,
    signerAddress: signerAddress as string,
  });

  console.log('Signature submitted:');
  console.table({
    operationId: signatureResponse.operationId,
    signaturesCollected: signatureResponse.signaturesCollected,
    signaturesRequired: signatureResponse.signaturesRequired,
  });

  // ─── Step 7: Execute ──────────────────────────────────────────────────────────
  console.log('\n═══ Step 7: Execute ═══');

  const operationsToExecute = await poll<QueueOperation[]>(
    'executable operation',
    async () => {
      const queue = await client.getDeploymentQueue({ pageSize: 100 });

      const ourOp = queue.items.find((item) => item.id === payoutOperation.id);
      assertQueueOperationNotFailed(ourOp?.status);

      const readyItems = queue.items.filter((item) => item.status === QueueOperationStatus.Ready);
      const payoutReady = readyItems.some((item) => item.id === payoutOperation.id);
      if (!payoutReady) return null;

      const batch: QueueOperation[] = [];
      let currentNonce = Number(queue.nextExecutableNonce);
      for (const item of readyItems) {
        if (item.nonce !== currentNonce.toString()) break;
        if (item.signaturesCollected < item.signaturesRequired) break;
        batch.push(item);
        currentNonce++;
      }

      const includesOurOp = batch.some((item) => item.id === payoutOperation.id);
      return includesOurOp ? batch : null;
    },
    pollInterval,
    pollTimeout,
  );

  console.log(`Executing ${operationsToExecute.length} operation(s) in batch:`);
  console.table(operationsToExecute.map((op) => ({ id: op.id, nonce: op.nonce, type: op.operationType })));

  const executeTx = await tronClient.buildExecuteTransaction({
    contractAddress,
    callerAddress,
    operations: operationsToExecute,
  });

  const signedExecuteTx = await tronWeb.trx.sign(executeTx.raw as Parameters<typeof tronWeb.trx.sign>[0]);
  const executeResult = await tronWeb.trx.sendRawTransaction(
    signedExecuteTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0],
  );

  const executeTxId: string = executeResult.txid;
  console.log('Execute tx broadcasted:', executeTxId);

  await waitForTronReceipt(tronWeb, executeTxId);
  console.log('Execute tx confirmed on-chain.');

  console.log('Waiting for payout transaction confirmation via API...');
  const confirmedPayout = await waitForTxConfirmation(
    client,
    executeTxId,
    OperationTypeV2.Payout,
    pollInterval,
    pollTimeout,
  );
  console.log(`Payout confirmed: ${confirmedPayout.confirmations} confirmations`);

  // ─── Step 8: Summary ──────────────────────────────────────────────────────────
  console.log('\n═══ Step 8: Final balances ═══');

  const finalBalances = await client.getAssetBalances({
    chainId,
    baseCurrency: BASE_CURRENCY,
    sortBy: AssetSortField.Balance,
    sortOrder: AssetSortOrder.Desc,
    pageSize: 20,
  });

  const nonZeroFinal = finalBalances.items.filter((b) => Number(b.balance) > 0);
  if (nonZeroFinal.length > 0) {
    console.table(nonZeroFinal.map((b) => ({ symbol: b.currency.symbol, balance: b.balance })));
  } else {
    console.log('All balances are zero after the flow.');
  }

  const finalSummary = await client.getAccountBalanceSummary({ chainId: chainIdNumber, baseCurrency: BASE_CURRENCY });
  console.log('Final balance summary (USD):');
  console.table({
    total: finalSummary.totalBalance,
    uncollected: finalSummary.uncollectedBalance,
    uncollectedInvoices: finalSummary.uncollectedInvoices,
  });

  console.log('\n✓ Full Tron flow completed successfully.');
});

async function waitForTronReceipt(tronWeb: TronWeb, txId: string): Promise<void> {
  const deadline = Date.now() + TX_RECEIPT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info && 'blockNumber' in info && info.blockNumber) {
        return;
      }
    } catch {
      // Transaction not yet indexed, retry
    }

    await new Promise((resolve) => setTimeout(resolve, TX_RECEIPT_POLL_MS));
  }

  throw new Error(`Transaction receipt for ${txId} not found after ${TX_RECEIPT_TIMEOUT_MS / 1000}s`);
}

async function waitForTxConfirmation(
  apiClient: DefiClient,
  txHash: string,
  operationType: OperationTypeV2,
  pollIntervalMs: number,
  pollTimeoutMs: number,
): Promise<OperationV2> {
  const operation = await poll<OperationV2>(
    `${operationType} operation`,
    async () => {
      const result = await apiClient.getOperationsV2({ types: [operationType], pageSize: 50 });
      return result.items.find((item) => item.txHash === txHash) ?? null;
    },
    pollIntervalMs,
    pollTimeoutMs,
  );

  assertOperationNotFailed(operationType, operation.status);
  if (operation.status === OperationV2Status.Confirmed) return operation;

  return poll<OperationV2>(
    `${operationType} confirmation`,
    async () => {
      const result = await apiClient.getOperationsV2({ types: [operationType], pageSize: 50 });
      const found = result.items.find((item) => item.id === operation.id);
      if (!found) return null;
      console.log(`  confirmations: ${found.confirmations}, status: ${found.status}`);
      assertOperationNotFailed(operationType, found.status);
      return found.status === OperationV2Status.Confirmed ? found : null;
    },
    pollIntervalMs,
    pollTimeoutMs,
  );
}

const TERMINAL_FAILURE_STATUSES = new Set<OperationV2Status>([OperationV2Status.Failed, OperationV2Status.Cancelled]);

function assertOperationNotFailed(operationType: OperationTypeV2, status: OperationV2Status): void {
  if (TERMINAL_FAILURE_STATUSES.has(status)) {
    throw new Error(`${operationType} operation reached terminal status ${status} on-chain — aborting flow.`);
  }
}

const TERMINAL_QUEUE_FAILURE_STATUSES = new Set<QueueOperationStatus>([
  QueueOperationStatus.Failed,
  QueueOperationStatus.Cancelled,
]);

function assertQueueOperationNotFailed(status: QueueOperationStatus | undefined): void {
  if (status != null && TERMINAL_QUEUE_FAILURE_STATUSES.has(status)) {
    throw new Error(`Payout queue operation reached terminal status ${status} — aborting flow.`);
  }
}

async function poll<T>(label: string, fn: () => Promise<T | null>, intervalMs: number, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await fn();
    if (result !== null) {
      return result;
    }

    const remaining = Math.round((deadline - Date.now()) / 1000);
    console.log(`[${label}] not ready — retrying in ${intervalMs / 1000}s (${remaining}s remaining)...`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`[${label}] timed out after ${timeoutMs / 1000}s`);
}
