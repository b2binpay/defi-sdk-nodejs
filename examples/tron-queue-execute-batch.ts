/**
 * Tron: Queue batch execute use case:
 * - Authenticate via API key.
 * - Check `batchableCount` on the queue to see whether batching is worth attempting.
 * - Ask the backend for batch-executable candidates and pick one operation per nonce.
 * - Build one execute transaction covering all picks, sign and broadcast via TronWeb.
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { DefiClient, TronMultisigBlockchainClient } from '../src';
import {
  assertTronBroadcast,
  DEFAULT_FEE_LIMIT,
  parseChainId,
  requireEnvVars,
  runMain,
  waitForTronReceipt,
} from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

const MIN_BATCHABLE_NONCES = 2;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  console.log(`Batchable Tron nonces from ${queue.nextExecutableNonce}: ${queue.batchableCount}`);

  if (queue.batchableCount < MIN_BATCHABLE_NONCES) {
    throw new Error('Nothing to batch — fewer than two consecutive nonces are ready.');
  }

  const { candidates } = await client.getBatchCandidates({});

  // Nonces must execute consecutively, so a conflicting or unsatisfiable nonce
  // ends the batch rather than being skipped over.
  const picks = [];
  for (const group of candidates) {
    if (group.conflict) {
      console.log(`Nonce ${group.nonce} has competing operations — stopping the batch here.`);
      break;
    }

    const eligible = group.operations.find((operation) => operation.batchEligible);
    if (!eligible) {
      break;
    }

    picks.push(eligible);
  }

  if (picks.length === 0) {
    throw new Error('No batch-executable candidates returned for this Tron deployment.');
  }

  console.log('Picked Tron operations to execute:');
  console.table(
    picks.map((operation) => ({
      id: operation.id,
      nonce: operation.nonce,
      type: operation.operationType,
      signatures: `${operation.signaturesCollected}/${operation.signaturesRequired}`,
    })),
  );

  const tronWeb = new TronWeb({
    fullHost: env.RPC_URL,
    privateKey: env.WALLET_PRIVATE_KEY,
  });

  const contractAbi = await client.getContractAbi();

  const tronClient = new TronMultisigBlockchainClient({
    chainId,
    tronWeb,
    contractAbi,
    defaultFeeLimit: DEFAULT_FEE_LIMIT,
  });

  const callerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!callerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }

  const transaction = await tronClient.buildExecuteTransaction({
    contractAddress: accountDetails.account.contract,
    callerAddress: callerAddress,
    operations: picks,
  });

  const signedTx = await tronWeb.trx.sign(transaction.raw);
  const txId = assertTronBroadcast(await tronWeb.trx.sendRawTransaction(signedTx), 'Tron batch execution');
  console.log('Tron batch execution broadcasted:', txId);

  await waitForTronReceipt(tronWeb, txId, 'Tron batch execution');
  const confirmed = await client.waitForTransactionOperations({ txHash: txId });
  console.log('Confirmed by the API:');
  console.table(confirmed.map((op) => ({ id: op.id, type: op.operationType, status: op.status })));
});
