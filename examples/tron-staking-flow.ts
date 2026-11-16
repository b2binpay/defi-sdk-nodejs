/**
 * TRON staking flow example:
 * - Authenticate via API key and select a TRON deployment (Mainnet or Nile).
 * - Read the account staking summary and network params.
 * - Clear any pending/ready queue operations so the stake is the next executable nonce.
 * - Create a stake operation, sign it (TIP-712), and execute it on-chain via the multisig.
 * - Re-read the staking summary to confirm the freeze landed.
 *
 * Required environment variables:
 *   API_BASE_URL       — DeFi API base URL
 *   API_KEY            — API key
 *   CHAIN_ID           — TRON chain ID (728126428 mainnet, 3448148188 Nile)
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
  OperationTypeV2,
  QueueOperationStatus,
  StakingResourceType,
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

const REQUIRED_ENV = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

// amount is in TRX (human units); the API converts to SUN. Staking 1 TRX for energy here.
const STAKE_AMOUNT = '1';
const STAKE_RESOURCE = StakingResourceType.Energy;

runMain(async () => {
  const env = requireEnvVars(REQUIRED_ENV);
  const chainId = parseChainId(env.CHAIN_ID);
  const waitOptions: WaitOptions = {
    intervalMs: Number(process.env.POLL_INTERVAL_MS ?? '5000'),
    timeoutMs: Number(process.env.POLL_TIMEOUT_MS ?? '300000'),
  };

  const tronWeb = new TronWeb({ fullHost: env.RPC_URL, privateKey: env.WALLET_PRIVATE_KEY });
  const signerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!signerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }
  console.log('Signer address:', signerAddress);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  const deployment = await client.selectChain(chainId);
  const contractAddress = accountDetails.account.contract;
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
  // The queue was emptied before the stake was created, so no earlier nonce can block it.
  const readyOperation = await client.waitForQueueOperation({ operationId: operation.id }, waitOptions);
  const operationsToExecute = [readyOperation];

  const executeTx = await tronClient.buildExecuteTransaction({
    contractAddress,
    callerAddress: signerAddress,
    operations: operationsToExecute,
  });

  const signedExecuteTx = await tronWeb.trx.sign(executeTx.raw);
  const executeResult = await tronWeb.trx.sendRawTransaction(signedExecuteTx);

  const executeTxId = assertTronBroadcast(executeResult, 'Stake execute tx');
  console.log('Stake execute tx broadcasted:', executeTxId);

  await waitForTronReceipt(tronWeb, executeTxId, 'Stake execute tx');
  console.log('Stake execute tx confirmed on-chain.');

  console.log('Waiting for stake transaction confirmation via API...');
  const [confirmedStake] = await client.waitForTransactionOperations(
    { txHash: executeTxId, type: OperationTypeV2.Stake },
    waitOptions,
  );
  console.log(`Stake confirmed: ${confirmedStake.confirmations} confirmations`);

  // ─── Summary ───────────────────────────────────────────────────────────────────
  const summaryAfter = await client.getStakingSummary();
  console.log('Staking summary (after):');
  console.log(JSON.stringify(summaryAfter, null, 2));

  console.log('\n✓ Stake flow completed successfully.');
});
