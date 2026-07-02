/**
 * TRON staking flow example:
 * - Authenticate via API key and select a TRON deployment (Shasta/Mainnet).
 * - Read the account staking summary and network params.
 * - Clear any pending/ready queue operations so the stake is the next executable nonce.
 * - Create a stake operation, sign it (TIP-712), and execute it on-chain via the multisig.
 * - Re-read the staking summary to confirm the freeze landed.
 *
 * Required environment variables:
 *   API_BASE_URL       — DeFi API base URL
 *   API_KEY            — API key
 *   CHAIN_ID           — TRON chain ID (e.g. 728126428 mainnet, 2494104990 Shasta)
 *   RPC_URL            — TronWeb full host URL
 *   WALLET_PRIVATE_KEY — hex private key of the signer wallet
 *
 * Optional:
 *   POLL_INTERVAL_MS — polling interval in ms (default: 5000)
 *   POLL_TIMEOUT_MS  — maximum polling time in ms (default: 300000 / 5 min)
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import {
  DefiClient,
  type QueueOperation,
  QueueOperationStatus,
  StakingResourceType,
  type TronAddress,
  TronMultisigBlockchainClient,
  transactions,
} from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

const REQUIRED_ENV = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

// amount is in TRX (human units); the API converts to SUN. Staking 1 TRX for energy here.
const STAKE_AMOUNT = '1';
const STAKE_RESOURCE = StakingResourceType.Energy;
const TX_RECEIPT_TIMEOUT_MS = 120_000;
const TX_RECEIPT_POLL_MS = 3_000;

const TERMINAL_QUEUE_FAILURE_STATUSES = new Set<QueueOperationStatus>([
  QueueOperationStatus.Failed,
  QueueOperationStatus.Cancelled,
]);

runMain(async () => {
  const env = requireEnvVars(REQUIRED_ENV);
  const chainId = parseChainId(env.CHAIN_ID);
  const pollInterval = Number(process.env.POLL_INTERVAL_MS ?? '5000');
  const pollTimeout = Number(process.env.POLL_TIMEOUT_MS ?? '300000');

  const tronWeb = new TronWeb({ fullHost: env.RPC_URL, privateKey: env.WALLET_PRIVATE_KEY });
  const signerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!signerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }
  console.log('Signer address:', signerAddress);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  const deployment = await client.selectChain(chainId);
  const contractAddress = accountDetails.account.contract as TronAddress;
  console.log('Using deployment:', deployment.deploymentId, '| contract:', contractAddress);

  const summary = await client.getStakingSummary();
  console.log('Staking summary (before):');
  console.log(JSON.stringify(summary, null, 2));

  const networkParams = await client.getStakingNetworkParams();
  console.log('Network params:');
  console.log(JSON.stringify(networkParams, null, 2));

  // ─── Clear queue ───────────────────────────────────────────────────────────────
  const queueBefore = await client.getDeploymentQueue({
    statuses: [QueueOperationStatus.Pending, QueueOperationStatus.Ready],
    pageSize: 100,
  });
  if (queueBefore.items.length > 0) {
    console.log(`Found ${queueBefore.items.length} pending/ready queue operation(s); deleting before staking...`);
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

  // ─── Create stake operation ──────────────────────────────────────────────────
  const operation = await client.createStakeOperation({ amount: STAKE_AMOUNT, resourceType: STAKE_RESOURCE });
  console.log('Created stake queue operation:');
  console.table({
    id: operation.id,
    operationType: operation.operationType,
    status: operation.status,
    nonce: operation.nonce,
    amount: `${STAKE_AMOUNT} TRX`,
    resourceType: STAKE_RESOURCE,
  });

  // ─── Sign ──────────────────────────────────────────────────────────────────────
  const contractAbi = await client.getContractAbi();
  const tronClient = new TronMultisigBlockchainClient({
    chainId,
    tronWeb,
    contractAbi,
    defaultFeeLimit: DEFAULT_FEE_LIMIT,
  });

  const typedData = await tronClient.createExecuteTypedData({ contractAddress, operation });
  const { domain, types, message } = transactions.prepareTronTypedDataForSigning(typedData);
  const signature = await tronWeb.trx._signTypedData(domain, types, message);

  const signatureResponse = await client.submitOperationSignature({
    operationId: operation.id,
    signature,
    signerAddress,
  });
  console.log('Signature submitted:');
  console.table({
    operationId: signatureResponse.operationId,
    signaturesCollected: signatureResponse.signaturesCollected,
    signaturesRequired: signatureResponse.signaturesRequired,
  });

  // ─── Execute ─────────────────────────────────────────────────────────────────
  const operationsToExecute = await poll<QueueOperation[]>(
    'executable stake operation',
    async () => {
      const queue = await client.getDeploymentQueue({ pageSize: 100 });

      const ourOp = queue.items.find((item) => item.id === operation.id);
      if (ourOp != null && TERMINAL_QUEUE_FAILURE_STATUSES.has(ourOp.status)) {
        throw new Error(`Stake queue operation reached terminal status ${ourOp.status} — aborting flow.`);
      }

      const readyItems = queue.items.filter((item) => item.status === QueueOperationStatus.Ready);
      const stakeReady = readyItems.some((item) => item.id === operation.id);
      if (!stakeReady) {
        return null;
      }

      const batch: QueueOperation[] = [];
      let currentNonce = Number(queue.nextExecutableNonce);
      for (const item of readyItems) {
        if (item.nonce !== currentNonce.toString()) {
          break;
        }
        if (item.signaturesCollected < item.signaturesRequired) {
          break;
        }
        batch.push(item);
        currentNonce++;
      }

      const includesOurOp = batch.some((item) => item.id === operation.id);
      return includesOurOp ? batch : null;
    },
    pollInterval,
    pollTimeout,
  );

  const executeTx = await tronClient.buildExecuteTransaction({
    contractAddress,
    callerAddress: signerAddress as TronAddress,
    operations: operationsToExecute,
  });

  const signedExecuteTx = await tronWeb.trx.sign(executeTx.raw as Parameters<typeof tronWeb.trx.sign>[0]);
  const executeResult = await tronWeb.trx.sendRawTransaction(
    signedExecuteTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0],
  );

  const executeTxId: string = executeResult.txid;
  console.log('Stake execute tx broadcasted:', executeTxId);

  await waitForTronReceipt(tronWeb, executeTxId);
  console.log('Stake execute tx confirmed on-chain.');

  // ─── Summary ───────────────────────────────────────────────────────────────────
  const summaryAfter = await client.getStakingSummary();
  console.log('Staking summary (after):');
  console.log(JSON.stringify(summaryAfter, null, 2));

  console.log('\n✓ Stake flow completed successfully.');
});

async function waitForTronReceipt(tronWeb: TronWeb, txId: string): Promise<void> {
  const deadline = Date.now() + TX_RECEIPT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const info = await tronWeb.trx.getTransactionInfo(txId);
      if (info && 'blockNumber' in info && info.blockNumber) {
        if (info.receipt?.result && info.receipt.result !== 'SUCCESS') {
          throw new Error(`Stake execute tx ${txId} reverted on-chain: ${info.receipt.result}`);
        }
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('reverted on-chain')) {
        throw error;
      }
      // Transaction not yet indexed, retry
    }

    await new Promise((resolve) => setTimeout(resolve, TX_RECEIPT_POLL_MS));
  }

  throw new Error(`Transaction receipt for ${txId} not found after ${TX_RECEIPT_TIMEOUT_MS / 1000}s`);
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
