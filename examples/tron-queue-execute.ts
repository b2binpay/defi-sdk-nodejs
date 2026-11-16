/**
 * Tron: Queue execute use case:
 * - Authenticate via API key.
 * - Find the first Tron operation that is ready to execute.
 * - Build execute transaction, sign and broadcast via TronWeb.
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

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  const executable = queue.items.find((item) => item.canExecute && !item.isBlocked);

  if (!executable) {
    throw new Error('No executable operations found in the Tron queue.');
  }

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
    operations: [executable],
  });

  const signedTx = await tronWeb.trx.sign(transaction.raw);
  const txId = assertTronBroadcast(await tronWeb.trx.sendRawTransaction(signedTx), 'Tron execution');
  console.log('Tron execution broadcasted:', txId);

  await waitForTronReceipt(tronWeb, txId, 'Tron execution');
  const confirmed = await client.waitForTransactionOperations({ txHash: txId });
  console.log('Confirmed by the API:');
  console.table(confirmed.map((op) => ({ id: op.id, type: op.operationType, status: op.status })));
});
