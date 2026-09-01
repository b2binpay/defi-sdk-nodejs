/**
 * Queue batch execute use case:
 * - Authenticate via API key.
 * - Check `batchableCount` on the queue to see whether batching is worth attempting.
 * - Ask the backend for batch-executable candidates and pick one operation per nonce.
 * - Build one multisig execute transaction covering all picks, broadcast it, and wait for confirmation.
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DefiClient, MultisigBlockchainClient } from '../src';
import { getEvmChainById } from '../src/blockchain/get-chain';
import { normalizePrivateKey, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

const MIN_BATCHABLE_NONCES = 2;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);
  const rpcUrl = env.RPC_URL;

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  console.log(`Batchable nonces from ${queue.nextExecutableNonce}: ${queue.batchableCount}`);

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
    throw new Error('No batch-executable candidates returned for this deployment.');
  }

  console.log('Picked operations to execute:');
  console.table(
    picks.map((operation) => ({
      id: operation.id,
      nonce: operation.nonce,
      type: operation.operationType,
      signatures: `${operation.signaturesCollected}/${operation.signaturesRequired}`,
    })),
  );

  const chain = getEvmChainById(chainId, rpcUrl);
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  const wallet = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));
  const walletClient = createWalletClient({
    chain,
    account: wallet,
    transport: http(rpcUrl),
  });

  const contractAbi = await client.getContractAbi();

  const multisigClient = new MultisigBlockchainClient({
    chainId,
    publicClient,
    contractAbi,
  });

  const transaction = multisigClient.buildExecuteTransaction({
    contractAddress: accountDetails.account.contract,
    operations: picks,
  });

  const txHash = await walletClient.sendTransaction({
    to: transaction.to,
    account: wallet,
    data: transaction.data,
    value: transaction.value ?? 0n,
  });

  console.log('Batch execution broadcasted:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Batch execution confirmed in block', receipt.blockNumber);
});
