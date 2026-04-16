/**
 * Tron: Queue execute use case:
 * - Authenticate via API key.
 * - Find the first Tron operation that is ready to execute.
 * - Build execute transaction, sign and broadcast via TronWeb.
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { DefiClient, type TronAddress, TronMultisigBlockchainClient } from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

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
    contractAddress: accountDetails.account.contract as TronAddress,
    callerAddress: callerAddress as TronAddress,
    operations: [executable],
  });

  const signedTx = await tronWeb.trx.sign(transaction.raw as Parameters<typeof tronWeb.trx.sign>[0]);
  const result = await tronWeb.trx.sendRawTransaction(signedTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0]);

  console.log('Tron execution broadcasted:', result.txid);
});
