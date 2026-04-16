/**
 * Tron: Queue signing use case:
 * - Authenticate via API key and set up TronWeb with private key.
 * - Fetch deployment queue and find the first signable operation.
 * - Build TIP-712 typed data and submit the signature.
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { DefiClient, type TronAddress, TronMultisigBlockchainClient, transactions } from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

  const tronWeb = new TronWeb({
    fullHost: env.RPC_URL,
    privateKey: env.WALLET_PRIVATE_KEY,
  });

  const signerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!signerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }
  console.log('Using Tron signer:', signerAddress);

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });
  const accountDetails = await client.getAccount();
  await client.selectChain(chainId);

  const queue = await client.getDeploymentQueue({ pageSize: 50 });
  const operation = queue.items.find((item) => {
    const signed = item.signatures.some((sig) => sig.user.toLowerCase() === signerAddress.toLowerCase());
    return !signed;
  });

  if (!operation) {
    throw new Error('No signable operations found in the Tron queue.');
  }

  console.log('Signing Tron operation:');
  console.table({
    id: operation.id,
    nonce: operation.nonce,
    type: operation.operationType,
    signaturesCollected: operation.signaturesCollected,
    signaturesRequired: operation.signaturesRequired,
  });

  const contractAbi = await client.getContractAbi();

  const tronClient = new TronMultisigBlockchainClient({
    chainId,
    tronWeb,
    contractAbi,
    defaultFeeLimit: DEFAULT_FEE_LIMIT,
  });

  const typedData = await tronClient.createExecuteTypedData({
    contractAddress: accountDetails.account.contract as TronAddress,
    operation,
  });

  // Sign the TIP-712 typed data using TronWeb._signTypedData
  // This performs proper EIP-712/TIP-712 hash computation and signing
  const { domain, types, message } = transactions.prepareTronTypedDataForSigning(typedData);
  const signature = await tronWeb.trx._signTypedData(domain, types, message);

  const signatureResponse = await client.submitOperationSignature({
    operationId: operation.id,
    signature,
    signerAddress: signerAddress as string,
  });

  console.log('Submitted Tron signature:');
  console.table({
    operationId: signatureResponse.operationId,
    signaturesCollected: signatureResponse.signaturesCollected,
    signaturesRequired: signatureResponse.signaturesRequired,
  });
});
