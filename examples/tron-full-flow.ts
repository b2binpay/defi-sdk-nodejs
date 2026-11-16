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
 *   CHAIN_ID        — Tron chain ID (728126428 for mainnet, 3448148188 for Nile)
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
import {
  AssetSortField,
  AssetSortOrder,
  type ClaimItem,
  DefiClient,
  FiatCurrency,
  OperationTypeV2,
  QueueOperationStatus,
  TronMultisigBlockchainClient,
  transactions,
  type WaitOptions,
} from '../src';
import {
  assertTronBroadcast,
  DEFAULT_FEE_LIMIT,
  parseChainId,
  requireEnvVars,
  runMain,
  waitForTronReceipt,
} from './utils';

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
const TRON_SUN_PER_TRX = 1_000_000;

runMain(async () => {
  const env = requireEnvVars(REQUIRED_ENV);
  const chainId = parseChainId(env.CHAIN_ID);
  const waitOptions: WaitOptions = {
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? '5000'),
    timeoutMs: Number(process.env.POLL_TIMEOUT_MS ?? '300000'),
  };
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

  const summary = await client.getAccountBalanceSummary({ chainId, baseCurrency: BASE_CURRENCY });
  console.log('Balance summary (USD):');
  console.table({
    total: summary.totalBalance,
    uncollected: summary.uncollectedBalance,
    uncollectedInvoices: summary.uncollectedInvoices,
  });

  // ─── Step 2: Invoice ─────────────────────────────────────────────────────────
  console.log('\n═══ Step 2: Create invoice ═══');

  const nativeCurrency = await client.getNativeCurrency({ chainId });
  console.log(`Native currency: ${nativeCurrency.symbol} (${nativeCurrency.id})`);

  const trackingId = `TRON-FULL-FLOW-${Date.now()}`;

  const invoice = await client.createInvoice({
    requestedAmount: INVOICE_AMOUNT,
    trackingId,
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
  const depositTxId = assertTronBroadcast(depositResult, 'Deposit tx');
  console.log('Deposit tx broadcasted:', depositTxId);

  await waitForTronReceipt(tronWeb, depositTxId, 'Deposit tx');
  console.log('Deposit tx confirmed on-chain.');

  // ─── Step 3: Wait for deposit ─────────────────────────────────────────────────
  console.log('\n═══ Step 3: Waiting for deposit ═══');

  const [confirmedTx] = await client.waitForTransactionOperations(
    { txHash: depositTxId, type: OperationTypeV2.InvoiceDeposit },
    waitOptions,
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

  const contractAddress = accountDetails.account.contract;
  const callerAddress = signerAddress;

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

    console.log(`Claiming ${currency.symbol} for ${items.length} invoice(s)...`);

    const claimTx = await tronClient.buildClaimTransaction({
      contractAddress,
      callerAddress,
      erc20: currency.address,
      depositIds,
    });

    const signedClaimTx = await tronWeb.trx.sign(claimTx.raw);
    const claimResult = await tronWeb.trx.sendRawTransaction(signedClaimTx);

    const claimTxId = assertTronBroadcast(claimResult, 'Claim tx');
    console.log('Claim tx broadcasted:', claimTxId);

    await waitForTronReceipt(tronWeb, claimTxId, 'Claim tx');
    console.log('Claim tx confirmed on-chain.');

    console.log('Waiting for claim transaction confirmation via API...');
    const [confirmedClaim] = await client.waitForTransactionOperations(
      { txHash: claimTxId, type: OperationTypeV2.Claim },
      waitOptions,
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

  if (!payout.queueOperationId) {
    throw new Error(`Payout ${payout.id} was created without a queue operation.`);
  }
  const payoutOperation = await client.getQueueOperation({ operationId: payout.queueOperationId });

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

  // The queue was emptied before the payout was created, so no earlier nonce can block it.
  const readyOperation = await client.waitForQueueOperation({ operationId: payoutOperation.id }, waitOptions);
  const operationsToExecute = [readyOperation];

  console.log(`Executing ${operationsToExecute.length} operation(s) in batch:`);
  console.table(operationsToExecute.map((op) => ({ id: op.id, nonce: op.nonce, type: op.operationType })));

  const executeTx = await tronClient.buildExecuteTransaction({
    contractAddress,
    callerAddress,
    operations: operationsToExecute,
  });

  const signedExecuteTx = await tronWeb.trx.sign(executeTx.raw);
  const executeResult = await tronWeb.trx.sendRawTransaction(signedExecuteTx);

  const executeTxId = assertTronBroadcast(executeResult, 'Execute tx');
  console.log('Execute tx broadcasted:', executeTxId);

  await waitForTronReceipt(tronWeb, executeTxId, 'Execute tx');
  console.log('Execute tx confirmed on-chain.');

  console.log('Waiting for payout transaction confirmation via API...');
  const [confirmedPayout] = await client.waitForTransactionOperations(
    { txHash: executeTxId, type: OperationTypeV2.Payout },
    waitOptions,
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

  const finalSummary = await client.getAccountBalanceSummary({ chainId, baseCurrency: BASE_CURRENCY });
  console.log('Final balance summary (USD):');
  console.table({
    total: finalSummary.totalBalance,
    uncollected: finalSummary.uncollectedBalance,
    uncollectedInvoices: finalSummary.uncollectedInvoices,
  });

  console.log('\n✓ Full Tron flow completed successfully.');
});
