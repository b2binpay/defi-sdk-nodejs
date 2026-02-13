/**
 * Get account info use case:
 * - Authenticate with API key only (no wallet required).
 * - Fetch account details and enumerate deployments tied to the API key.
 * - For every deployment, print balance summary in the chosen base currency and list non-zero asset balances.
 * - Base currency can be overridden via BALANCE_BASE_CURRENCY (usd/eur/cny).
 */
import 'dotenv/config';
import { AssetSortField, AssetSortOrder, DefiClient, FiatCurrency } from '../src';
import { requireEnvVars, runMain } from './utils';

const requiredEnv = ['API_BASE_URL', 'API_KEY'] as const;

runMain(async () => {
  const env = requireEnvVars(requiredEnv);
  const baseCurrency = FiatCurrency.Usd;

  const client = new DefiClient({ baseUrl: env.API_BASE_URL, apiKey: env.API_KEY });

  const accountDetails = await client.getAccount();
  console.log('Selected account:', accountDetails.account.name, accountDetails.account.id);

  const deployments = await client.getDeployments(accountDetails);
  if (deployments.length === 0) {
    throw new Error('No deployments found for this account.');
  }

  console.log(`Found ${deployments.length} deployment(s). Fetching balances across chains...`);

  for (const deployment of deployments) {
    const chainIdNumber = Number.parseInt(deployment.chainId, 10);
    console.log(`\nChain ${deployment.chainId}`);

    const summary = await client.getAccountBalanceSummary({
      chainId: chainIdNumber,
      baseCurrency,
    });

    console.table({
      total: summary.totalBalance,
      uncollectedBalance: summary.uncollectedBalance,
      uncollectedInvoices: summary.uncollectedInvoices,
    });

    const balances = await client.getAssetBalances({
      chainId: deployment.chainId,
      baseCurrency,
      sortBy: AssetSortField.Balance,
      sortOrder: AssetSortOrder.Desc,
      pageSize: 100,
    });

    const nonZeroBalances = balances.items.filter((item) => Number(item.balance) > 0);

    if (nonZeroBalances.length === 0) {
      console.log('No non-zero balances on this deployment.');
      continue;
    }

    console.table(
      nonZeroBalances.map((item) => ({
        symbol: item.currency.symbol,
        balance: item.balance,
        converted: `${item.convertedBalance} ${baseCurrency.toUpperCase()}`,
      })),
    );
  }
});
