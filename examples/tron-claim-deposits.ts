/**
 * Tron: Claim deposits use case:
 * - Authenticate via API key and select a Tron chain.
 * - List claimable deposits on the Tron network.
 * - Build a claim transaction using TronMultisigBlockchainClient.
 * - Sign and broadcast via TronWeb.
 */
import 'dotenv/config';
import { TronWeb } from 'tronweb';
import { DefiClient, TRON_ZERO_ADDRESS, type TronAddress, TronMultisigBlockchainClient } from '../src';
import { DEFAULT_FEE_LIMIT, parseChainId, requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY', 'CHAIN_ID', 'RPC_URL', 'WALLET_PRIVATE_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const chainId = parseChainId(env.CHAIN_ID);

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
    throw new Error('No claimable deposits found on Tron.');
  }

  console.log('Claimable Tron deposits:');
  console.table(
    claims.items.map((item) => ({
      invoiceId: item.invoiceId,
      currency: item.currency.symbol,
      amount: item.amount,
    })),
  );

  const currency = claims.items[0].currency;
  const invoicesToClaim = claims.items.filter((item) => item.currency.id === currency.id);
  const depositIds = invoicesToClaim.map((item) => item.invoiceNonce);

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

  const contractAddress = accountDetails.account.contract as TronAddress;
  const erc20Address = (currency.address ?? TRON_ZERO_ADDRESS) as TronAddress;

  const callerAddress = TronWeb.address.fromPrivateKey(env.WALLET_PRIVATE_KEY);
  if (!callerAddress) {
    throw new Error('Failed to derive Tron address from private key.');
  }

  const claimTx = await tronClient.buildClaimTransaction({
    contractAddress,
    callerAddress: callerAddress as TronAddress,
    erc20: erc20Address,
    depositIds,
  });

  console.log(`Claiming deposits in ${currency.symbol} for ${invoicesToClaim.length} invoices...`);

  const signedTx = await tronWeb.trx.sign(claimTx.raw as Parameters<typeof tronWeb.trx.sign>[0]);
  const result = await tronWeb.trx.sendRawTransaction(signedTx as Parameters<typeof tronWeb.trx.sendRawTransaction>[0]);

  console.log('Claim transaction broadcasted:', result.txid);
});
