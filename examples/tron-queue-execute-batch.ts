/**
 * Tron: Queue batch execute use case:
 * - Authenticate via API key.
 * - Find consecutive ready-to-execute operations on the Tron network.
 * - Build one execute transaction covering all operations, sign and broadcast via TronWeb.
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { DefiClient, type QueueOperation, type TronAddress, TronMultisigBlockchainClient } from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

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
    throw new Error('No executable operations found in the Tron queue.');
  }

  console.log('Found Tron operations to execute:');
  console.table(
    operationsToExecute.map((op) => ({
      id: op.id,
      nonce: op.nonce,
      type: op.operationType,
      signatures: `${op.signaturesCollected}/${op.signaturesRequired}`,
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
    contractAddress: accountDetails.account.contract as TronAddress,
    callerAddress: callerAddress as TronAddress,
    operations: operationsToExecute,
  });

  const signedTx = await tronWeb.trx.sign(transaction.raw as Parameters<typeof tronWeb.trx.sign>[0]);
  const result = await tronWeb.trx.sendRawTransaction(signedTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0]);

  console.log('Tron batch execution broadcasted:', result.txid);
});
