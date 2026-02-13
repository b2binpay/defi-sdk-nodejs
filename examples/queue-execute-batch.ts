/**
 * Queue batch execute use case:
 * - Authenticate via API key.
 * - Find the first two operations that are ready to execute (`canExecute`).
 * - Build one multisig execute transaction covering both operations, broadcast it, and wait for confirmation.
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DefiClient, MultisigBlockchainClient, type QueueOperation } from '../src';
import { getChainById } from '../src/blockchain/get-chain';
import { normalizePrivateKey, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);
  const rpcUrl = env.RPC_URL;

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ statuses: ['READY'], pageSize: 50 });
  const operationsToExecute: QueueOperation[] = [];

  let currentNonce = Number(queue.nextExecutableNonce);
  for (const item of queue.items) {
    if (item.nonce !== currentNonce.toString()) {
      break;
    }

    if (item.signaturesCollected < item.signaturesRequired) {
      break;
    }

    operationsToExecute.push(item);
    currentNonce++;
  }

  if (operationsToExecute.length === 0) {
    throw new Error('No executable operations found in the queue.');
  }

  console.log('Found operations to execute:');
  console.table(
    operationsToExecute.map((op) => ({
      id: op.id,
      nonce: op.nonce,
      type: op.operationType,
      signatures: `${op.signaturesCollected}/${op.signaturesRequired}`,
    })),
  );

  const chain = getChainById(chainId, rpcUrl);
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

  const multisigClient = new MultisigBlockchainClient({
    chainId,
    publicClient,
  });

  const transaction = multisigClient.buildExecuteTransaction({
    contractAddress: accountDetails.account.contract,
    operations: operationsToExecute,
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
