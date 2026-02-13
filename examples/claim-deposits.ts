/**
 * Claim deposits use case:
 * - Authenticate via API key and authorize a local signer (private key) for claim recording.
 * - List claimable deposits, optionally filtered by invoice/currency, and display amounts.
 * - Broadcast a claim transaction on-chain (provide the tx hash) and wait for confirmation.
 * - Fetch recent claim transactions to confirm the recorded execution.
 */
import 'dotenv/config';
import { type Address, createPublicClient, createWalletClient, http, zeroAddress } from 'viem';
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

  const claims = await client.getClaims({
    chainId,
    currencyIds: process.env.CLAIM_CURRENCY_ID ? [process.env.CLAIM_CURRENCY_ID] : undefined,
    invoiceId: process.env.CLAIM_INVOICE_ID,
    pageSize: Number(process.env.CLAIM_PAGE_SIZE ?? '50'),
  });

  if (claims.items.length === 0) {
    throw new Error('No claimable deposits found for the selected filters.');
  }

  console.log('Claimable deposits:');
  console.table(
    claims.items.map((item) => ({
      invoiceId: item.invoiceId,
      currency: item.currency.symbol,
      amount: item.amount,
    })),
  );

  // take first currency from the list
  const currency = claims.items[0].currency;
  const invoicesToClaim = claims.items.filter((item) => item.currency.id === currency.id);
  const depositAccountIds = invoicesToClaim.map((item) => item.invoiceNonce);

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

  const erc20Address = currency.address ?? zeroAddress;
  const claimTxData = multisigClient.buildClaimCalldata({
    erc20: erc20Address as Address,
    depositAccountIds,
  });

  console.log(`Will claim deposits in currency ${currency.symbol} for invoices:`);
  console.table(
    invoicesToClaim.map((invoice) => ({
      invoiceId: invoice.invoiceId,
      amount: invoice.amount,
    })),
  );

  const txHash = await walletClient.sendTransaction({
    to: accountDetails.account.contract as Address,
    account: wallet,
    data: claimTxData,
    value: 0n,
  });

  console.log('Claim transaction broadcasted:', txHash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('Claim transaction confirmed in block', receipt.blockNumber);
});
