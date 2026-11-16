/**
 * EVM full-flow example:
 * Demonstrates the complete money lifecycle on an EVM chain using the DefiSDK.
 *
 * Steps:
 *   1. Setup    — authenticate, select chain, print initial balances
 *   2. Invoice  — create a native currency invoice and automatically send the deposit from the signer wallet
 *   3. Deposit  — poll transactions API until deposit appears, then wait for CONFIRMED status
 *   4. Claim    — build and broadcast claim tx, wait for confirmation
 *   5. Payout   — create a native currency payout back to a test address
 *   6. Sign     — build EIP-712 typed data and submit signature
 *   7. Execute  — wait for the operation to be ready, then broadcast execute tx
 *   8. Summary  — print final account balances
 *
 * Required environment variables:
 *   API_BASE_URL       — DeFi API base URL
 *   API_KEY            — API key
 *   CHAIN_ID           — numeric EVM chain ID
 *   RPC_URL            — JSON-RPC endpoint for the chain
 *   WALLET_PRIVATE_KEY — hex private key of the signer wallet (32 bytes)
 *   PAYOUT_RECIPIENT   — address to receive the payout
 *
 * Optional:
 *   POLL_INTERVAL_MS   — polling interval in ms (default: 5000)
 *   POLL_TIMEOUT_MS    — maximum polling time in ms (default: 300000 / 5 min)
 */
import 'dotenv/config';
import { type Address, createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AssetSortField,
  AssetSortOrder,
  type ClaimItem,
  DefiClient,
  FiatCurrency,
  getEvmChainById,
  MultisigBlockchainClient,
  OperationTypeV2,
  QueueOperationStatus,
  type WaitOptions,
} from '../src';
import { assertReceiptSucceeded, bufferGas, normalizePrivateKey, parseChainId, requireEnvVars, runMain } from './utils';

const REQUIRED_ENV = [
  'API_BASE_URL',
  'API_KEY',
  'CHAIN_ID',
  'RPC_URL',
  'WALLET_PRIVATE_KEY',
  'PAYOUT_RECIPIENT',
] as const;

const PAYOUT_AMOUNT = '0.00005';
const INVOICE_AMOUNT = '0.0001';
const BASE_CURRENCY = FiatCurrency.Usd;
const TX_RECEIPT_TIMEOUT_MS = 360_000;

runMain(async () => {
  const env = requireEnvVars(REQUIRED_ENV);
  const chainId = parseChainId(env.CHAIN_ID);
  const rpcUrl = env.RPC_URL;
  const waitOptions: WaitOptions = {
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? '5000'),
    timeoutMs: Number(process.env.POLL_TIMEOUT_MS ?? '300000'),
  };

  // ─── Step 1: Setup ───────────────────────────────────────────────────────────
  console.log('\n═══ Step 1: Setup ═══');

  const signer = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));
  console.log('Signer address:', signer.address);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  console.log('Account:', accountDetails.account.name, `(${accountDetails.account.id})`);
  console.log('Contract:', accountDetails.account.contract);

  await client.selectChain(chainId);
  console.log('Chain ID:', chainId);

  const chain = getEvmChainById(chainId, rpcUrl);
  const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ chain, account: signer, transport: http(rpcUrl) });
  const contractAbi = await client.getContractAbi();
  const multisigClient = new MultisigBlockchainClient({ chainId, publicClient, contractAbi });

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

  const trackingId = `EVM-FULL-FLOW-${Date.now()}`;

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

  console.log(`\nSending ${INVOICE_AMOUNT} ${nativeCurrency.symbol} to invoice address ${invoice.invoiceAddress}...`);
  const depositTxHash = await walletClient.sendTransaction({
    to: invoice.invoiceAddress as Address,
    value: parseEther(INVOICE_AMOUNT),
  });
  console.log('Deposit tx broadcasted:', depositTxHash);
  const depositReceipt = await publicClient.waitForTransactionReceipt({
    hash: depositTxHash,
    timeout: TX_RECEIPT_TIMEOUT_MS,
  });
  assertReceiptSucceeded(depositReceipt, 'Deposit');
  console.log('Deposit tx included in block:', depositReceipt.blockNumber.toString());

  // ─── Step 3: Wait for deposit ─────────────────────────────────────────────────
  console.log('\n═══ Step 3: Waiting for deposit ═══');

  const [confirmedTx] = await client.waitForTransactionOperations(
    { txHash: depositTxHash, type: OperationTypeV2.InvoiceDeposit },
    waitOptions,
  );

  console.log('Deposit confirmed:');
  console.table({
    txHash: confirmedTx.txHash,
    status: confirmedTx.status,
    confirmations: confirmedTx.confirmations,
    confirmedAt: confirmedTx.confirmedAt,
  });

  // Fetch the corresponding claimable items for the claim step
  const claimsResult = await client.getClaims({ invoiceId: invoice.id, pageSize: 50 });
  const claimItems: ClaimItem[] = claimsResult.items;

  if (claimItems.length === 0) {
    throw new Error(`No claimable items found for invoice ${invoice.id} after transaction was confirmed.`);
  }

  // ─── Step 4: Claim ────────────────────────────────────────────────────────────
  console.log('\n═══ Step 4: Claim ═══');

  // Group by currency and claim each currency in one transaction
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
    const claimCalldata = multisigClient.buildClaimCalldata({ erc20: currency.address, depositIds });

    console.log(`Claiming ${currency.symbol} for ${items.length} invoice(s)...`);

    const claimTo = accountDetails.account.contract as Address;
    const claimGas = bufferGas(
      await publicClient.estimateGas({ account: signer.address, to: claimTo, data: claimCalldata, value: 0n }),
    );

    const claimTxHash = await walletClient.sendTransaction({
      to: claimTo,
      account: signer,
      data: claimCalldata,
      value: 0n,
      gas: claimGas,
    });

    console.log('Claim tx broadcasted:', claimTxHash);

    const claimReceipt = await publicClient.waitForTransactionReceipt({
      hash: claimTxHash,
      timeout: TX_RECEIPT_TIMEOUT_MS,
    });
    assertReceiptSucceeded(claimReceipt, 'Claim');
    console.log('Claim included in block:', claimReceipt.blockNumber.toString());

    console.log('Waiting for claim transaction confirmation via API...');
    const [confirmedClaim] = await client.waitForTransactionOperations(
      { txHash: claimTxHash, type: OperationTypeV2.Claim },
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

  const payout = await client.createPayout({
    currencyId: nativeCurrency.id,
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

  const typedData = await multisigClient.createExecuteTypedData({
    contractAddress: accountDetails.account.contract,
    operation: payoutOperation,
  });

  const signature = await signer.signTypedData(typedData);
  console.log('Signature:', `${signature.slice(0, 20)}...`);

  const signatureResponse = await client.submitOperationSignature({
    operationId: payoutOperation.id,
    signature,
    signerAddress: signer.address,
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

  const executeTx = multisigClient.buildExecuteTransaction({
    contractAddress: accountDetails.account.contract,
    operations: operationsToExecute,
  });

  const executeTxHash = await walletClient.sendTransaction({
    to: executeTx.to,
    account: signer,
    data: executeTx.data,
    value: executeTx.value ?? 0n,
  });

  console.log('Execute tx broadcasted:', executeTxHash);

  const executeReceipt = await publicClient.waitForTransactionReceipt({
    hash: executeTxHash,
    timeout: TX_RECEIPT_TIMEOUT_MS,
  });
  assertReceiptSucceeded(executeReceipt, 'Execute');
  console.log('Execute included in block:', executeReceipt.blockNumber.toString());

  console.log('Waiting for payout transaction confirmation via API...');
  const [confirmedPayout] = await client.waitForTransactionOperations(
    { txHash: executeTxHash, type: OperationTypeV2.Payout },
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

  console.log('\n✓ Full EVM flow completed successfully.');
});
