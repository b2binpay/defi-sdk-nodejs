/**
 * Queue signing use case:
 * - Authenticate via API key and authorize a local signer (private key).
 * - Fetch deployment queue and locate the first operation the user can sign.
 * - Build EIP-712 typed data for that operation and submit the signature.
 */
import 'dotenv/config';
import { type Address, createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DefiClient, MultisigBlockchainClient } from '../src';
import { getChainById } from '../src/blockchain/get-chain';
import { normalizePrivateKey, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const signer = privateKeyToAccount(normalizePrivateKey(env.WALLET_PRIVATE_KEY));
  console.log('Using signer:', signer.address);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  const operation = queue.items.find((item) => {
    const signed = item.signatures.some((sig) => sig.user.toLowerCase() === signer.address.toLowerCase());

    return !signed;
  });

  if (!operation) {
    throw new Error('No signable operations found in the queue.');
  }

  console.log('Signing operation:');
  console.table({
    id: operation.id,
    nonce: operation.nonce,
    type: operation.operationType,
    signaturesCollected: operation.signaturesCollected,
    signaturesRequired: operation.signaturesRequired,
  });

  const publicClient = createPublicClient({
    chain: getChainById(chainId, env.RPC_URL),
    transport: http(env.RPC_URL),
  });

  const multisigClient = new MultisigBlockchainClient({
    publicClient,
    chainId,
  });

  const typedData = await multisigClient.createExecuteTypedData({
    contractAddress: accountDetails.account.contract as Address,
    operation,
  });

  const signature = await signer.signTypedData(typedData);

  const signatureResponse = await client.submitOperationSignature({
    operationId: operation.id,
    signature,
  });

  console.log('Submitted signature:');
  console.table({
    operationId: signatureResponse.operationId,
    signaturesCollected: signatureResponse.signaturesCollected,
    signaturesRequired: signatureResponse.signaturesRequired,
  });
});
