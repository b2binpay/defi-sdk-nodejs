/**
 * Queue execute use case:
 * - Authenticate via API key.
 * - Find the first operation that is ready to execute (`canExecute`).
 * - Build a multisig execute transaction, broadcast it on-chain, and wait for confirmation.
 */
import 'dotenv/config';
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DefiClient, MultisigBlockchainClient } from '../src';
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

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  const executable = queue.items.find((item) => item.canExecute && !item.isBlocked);

  if (!executable) {
    throw new Error('No executable operations found in the queue.');
  }

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
    operations: [executable],
  });

  const txHash = await walletClient.sendTransaction({
    to: transaction.to,
    account: wallet,
    data: transaction.data,
    value: transaction.value ?? 0n,
  });

  console.log('Execution broadcasted:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Execution confirmed in block', receipt.blockNumber);
});
