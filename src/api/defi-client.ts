import type {
  AccountsControllerGetAssetBalancesV1BaseCurrencyEnum,
  AccountsControllerGetAssetBalancesV1SortByEnum,
  AccountsControllerGetAssetBalancesV1SortOrderEnum,
  AccountsControllerGetBalanceSummaryV1BaseCurrencyEnum,
  ClaimsControllerGetClaimsV1SortByEnum,
  ClaimsControllerGetClaimsV1SortOrderEnum,
  FetchAPI,
  HTTPHeaders,
  InvoicesControllerFindInvoicesByDeploymentV1SortByEnum,
  InvoicesControllerFindInvoicesByDeploymentV1SortOrderEnum,
  InvoicesControllerFindInvoicesByDeploymentV1StatusesEnum,
  Middleware,
  PayoutsControllerFindAllV1SortByEnum,
  PayoutsControllerFindAllV1SortOrderEnum,
  PayoutsControllerFindAllV1StatusesEnum,
  TransactionsControllerGetTransactionsV1OperationTypesEnum,
  TransactionsControllerGetTransactionsV1SortByEnum,
  TransactionsControllerGetTransactionsV1SortOrderEnum,
  TransactionsControllerGetTransactionsV1StatusesEnum,
  UpdateInvoiceDto,
  UpdateInvoiceDtoStatusEnum,
  UpdatePayoutDto,
} from '../../generated-contracts';
import {
  AccountsApi,
  ClaimsApi,
  Configuration,
  CurrenciesApi,
  InvoicesApi,
  PayoutsApi,
  QueueOperationsApi,
  TransactionsApi,
} from '../../generated-contracts';
import type {
  Account,
  AccountDeployment,
  AccountDetails,
  AssetBalanceList,
  AssetSortField,
  AssetSortOrder,
  BalanceSummary,
  ClaimsResponse,
  ClaimsSortField,
  Currency,
  DeploymentQueue,
  FiatCurrency,
  Invoice,
  InvoiceDetails,
  InvoiceList,
  InvoiceSortField,
  InvoiceStatus,
  Payout,
  PayoutDetail,
  PayoutList,
  PayoutSortField,
  PayoutStatus,
  Signature,
  SortOrder,
  TransactionDetails,
  TransactionList,
  TransactionOperationType,
  TransactionSortField,
  TransactionStatus,
} from './models';
import {
  mapAccount,
  mapAccountDetails,
  mapAssetBalanceList,
  mapBalanceSummary,
  mapClaimsResponse,
  mapCurrency,
  mapDeploymentQueue,
  mapInvoice,
  mapInvoiceDetails,
  mapInvoiceList,
  mapPayout,
  mapPayoutDetail,
  mapPayoutList,
  mapSignature,
  mapTransactionDetails,
  mapTransactionList,
} from './models/mappers';

export interface DefiClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchApi?: FetchAPI;
  middleware?: Middleware[];
  defaultHeaders?: HTTPHeaders;
  credentials?: RequestCredentials;
  queryParamsStringify?: (params: Record<string, unknown>) => string;
}

type ChainIdentifier = number | string;

export interface GetAccountBalanceSummaryParams {
  baseCurrency: FiatCurrency;
  chainId: number;
}

export interface FindCurrencyBySymbolParams {
  symbol: string;
  chainId?: ChainIdentifier;
}

interface ChainScopedParams {
  chainId?: ChainIdentifier;
}

export interface CreatePayoutParams extends ChainScopedParams {
  currencyId: string;
  amount: string;
  recipient: string;
  trackingId?: string;
  callbackUrl?: string;
  nonce?: number;
}

export interface GetDeploymentQueueParams extends ChainScopedParams {
  statuses?: Array<'PENDING' | 'READY' | 'EXECUTING' | 'EXECUTED' | 'FAILED'>;
  page?: number;
  pageSize?: number;
}

export interface SubmitOperationSignatureParams extends ChainScopedParams {
  operationId: string;
  signature: string;
}

export interface ExecuteOperationParams extends ChainScopedParams {
  operationId: string;
  txHash: string;
}

export interface ExecuteBatchOperationsParams extends ChainScopedParams {
  operationIds: string[];
  txHash: string;
}

export interface GetInvoicesParams extends ChainScopedParams {
  id?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  currencyIds?: string[];
  statuses?: InvoiceStatus[];
  trackingId?: string;
  sortBy?: InvoiceSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface GetInvoiceParams extends ChainScopedParams {
  invoiceId: string;
}

export interface CreateInvoiceParams extends ChainScopedParams {
  requestedAmount?: string | null;
  trackingId?: string | null;
  callbackUrl?: string | null;
  paymentPageButtonUrl?: string | null;
  paymentPageButtonText?: string | null;
  currencyIds?: string[];
}

export interface UpdateInvoiceParams extends ChainScopedParams {
  invoiceId: string;
  requestedAmount?: string | null;
  trackingId?: string | null;
  callbackUrl?: string | null;
  paymentPageButtonUrl?: string | null;
  paymentPageButtonText?: string | null;
  currencyIds?: string[];
  status?: InvoiceStatus;
}

export interface CancelInvoiceParams extends ChainScopedParams {
  invoiceId: string;
}

export interface GetPayoutsParams extends ChainScopedParams {
  id?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  currencyIds?: string[];
  statuses?: PayoutStatus[];
  trackingId?: string;
  createdBy?: string;
  toAddress?: string;
  sortBy?: PayoutSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface GetPayoutParams extends ChainScopedParams {
  payoutId: string;
}

export interface UpdatePayoutParams extends ChainScopedParams {
  payoutId: string;
  trackingId?: string | null;
  callbackUrl?: string | null;
}

export interface GetTransactionsParams extends ChainScopedParams {
  id?: string;
  operationId?: string;
  operationTypes?: TransactionOperationType[];
  statuses?: TransactionStatus[];
  txHash?: string;
  currencyIds?: string[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  isClaimed?: boolean;
  sortBy?: TransactionSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface GetTransactionParams extends ChainScopedParams {
  transactionId: string;
}

export interface GetClaimsParams extends ChainScopedParams {
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  currencyIds?: string[];
  invoiceId?: string;
  sortBy?: ClaimsSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface ExecuteClaimParams extends ChainScopedParams {
  invoiceId: string;
  currencyId: string;
  txHash: string;
}

export interface ExecuteBatchClaimParams extends ChainScopedParams {
  invoiceIds: string[];
  currencyId: string;
  txHash: string;
}

export interface GetAssetBalancesParams extends ChainScopedParams {
  baseCurrency: FiatCurrency;
  sortBy?: AssetSortField;
  sortOrder?: AssetSortOrder;
  currencyIds?: string[];
  page?: number;
  pageSize?: number;
}

export class DefiClient {
  private readonly config: Configuration;
  private readonly accountsApi: AccountsApi;
  private readonly currenciesApi: CurrenciesApi;
  private readonly invoicesApi: InvoicesApi;
  private readonly claimsApi: ClaimsApi;
  private readonly payoutsApi: PayoutsApi;
  private readonly queueOperationsApi: QueueOperationsApi;
  private readonly transactionsApi: TransactionsApi;
  private defaultAccountId?: string;
  private selectedDeployment?: AccountDeployment;
  private selectedChainId?: string;

  constructor(options: DefiClientOptions) {
    const basePath = options.baseUrl.replace(/\/+$/, '');
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new Error('apiKey is required when instantiating DefiClient.');
    }

    const headers: HTTPHeaders = {
      ...(options.defaultHeaders ?? {}),
      'x-api-key': apiKey,
    };

    this.config = new Configuration({
      basePath,
      fetchApi: options.fetchApi,
      middleware: options.middleware,
      headers,
      credentials: options.credentials,
      queryParamsStringify: options.queryParamsStringify,
    });

    this.accountsApi = new AccountsApi(this.config);
    this.currenciesApi = new CurrenciesApi(this.config);
    this.invoicesApi = new InvoicesApi(this.config);
    this.claimsApi = new ClaimsApi(this.config);
    this.payoutsApi = new PayoutsApi(this.config);
    this.queueOperationsApi = new QueueOperationsApi(this.config);
    this.transactionsApi = new TransactionsApi(this.config);
  }

  async getAssetBalances(params: GetAssetBalancesParams): Promise<AssetBalanceList> {
    const accountId = await this.resolveAccountId();
    const chainId = params.chainId ?? (await this.resolveDeployment()).chainId;

    const response = await this.accountsApi.accountsControllerGetAssetBalancesV1({
      accountId,
      baseCurrency: params.baseCurrency as AccountsControllerGetAssetBalancesV1BaseCurrencyEnum,
      chainId: chainId.toString(),
      sortBy: params.sortBy as AccountsControllerGetAssetBalancesV1SortByEnum | undefined,
      sortOrder: params.sortOrder as AccountsControllerGetAssetBalancesV1SortOrderEnum | undefined,
      currencyIds: params.currencyIds,
      page: params.page,
      pageSize: params.pageSize,
    });

    return mapAssetBalanceList(response);
  }

  async getAccounts(): Promise<Account[]> {
    const accounts = await this.accountsApi.accountsControllerFindUserAccountsV1();
    const firstAccount = accounts[0];

    if (!firstAccount) {
      throw new Error('No accounts are linked to this API key.');
    }

    this.defaultAccountId = firstAccount.id;
    return accounts.map(mapAccount);
  }

  async getAccount(): Promise<AccountDetails> {
    const resolvedAccountId = await this.resolveAccountId();
    const accountDetails = await this.accountsApi.accountsControllerFindAccountByIdV1({
      accountId: resolvedAccountId,
    });
    return mapAccountDetails(accountDetails);
  }

  async getDeployments(accountDetails?: AccountDetails): Promise<AccountDeployment[]> {
    const resolvedAccountDetails = accountDetails ?? (await this.getAccount());
    return resolvedAccountDetails.deployments;
  }

  async selectChain(chainId: ChainIdentifier): Promise<AccountDeployment> {
    const normalizedChainId = this.normalizeChainId(chainId);

    if (this.selectedDeployment && this.selectedChainId === normalizedChainId) {
      return this.selectedDeployment;
    }

    const accountDetails = await this.getAccount();
    const deployment = await this.getDeploymentByChain(normalizedChainId, accountDetails);
    this.selectedChainId = normalizedChainId;
    this.selectedDeployment = deployment;
    return deployment;
  }

  getSelectedDeployment(): AccountDeployment | undefined {
    return this.selectedDeployment;
  }

  async getDeploymentByChain(chainId: ChainIdentifier, accountDetails?: AccountDetails): Promise<AccountDeployment> {
    const resolvedAccountDetails = accountDetails ?? (await this.getAccount());
    const normalizedChainId = this.normalizeChainId(chainId);
    const deployment = resolvedAccountDetails.deployments.find((item) => item.chainId === normalizedChainId);

    if (!deployment) {
      throw new Error(`Deployment for chain ${normalizedChainId} not found on this account.`);
    }

    return deployment;
  }

  async getAccountBalanceSummary(params: GetAccountBalanceSummaryParams): Promise<BalanceSummary> {
    const resolvedAccountId = await this.resolveAccountId();
    const summary = await this.accountsApi.accountsControllerGetBalanceSummaryV1({
      accountId: resolvedAccountId,
      baseCurrency: params.baseCurrency as AccountsControllerGetBalanceSummaryV1BaseCurrencyEnum,
      chainId: params.chainId.toString(),
    });
    return mapBalanceSummary(summary);
  }

  async getCurrencies(): Promise<Currency[]> {
    const currencies = await this.currenciesApi.currenciesControllerFindAllV1();
    return currencies.map(mapCurrency);
  }

  async findCurrencyBySymbol(params: FindCurrencyBySymbolParams): Promise<Currency> {
    const normalizedSymbol = params.symbol.trim().toUpperCase();
    const targetChain = params.chainId ? this.normalizeChainId(params.chainId) : this.selectedChainId;

    if (!normalizedSymbol) {
      throw new Error('Symbol is required when calling findCurrencyBySymbol.');
    }

    const currencies = await this.getCurrencies();
    const matches = currencies.filter((currency) => {
      const sameSymbol = currency.symbol?.toUpperCase() === normalizedSymbol;
      if (!sameSymbol) {
        return false;
      }

      if (!targetChain) {
        return true;
      }

      return currency.chainId === targetChain;
    });

    if (matches.length === 0) {
      throw new Error(
        `Currency with symbol "${normalizedSymbol}"${targetChain ? ` on chain ${targetChain}` : ''} not found.`,
      );
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple currencies with symbol "${normalizedSymbol}"${
          targetChain ? ` on chain ${targetChain}` : ''
        } found. Please specify currencyId instead.`,
      );
    }

    return matches[0];
  }

  async getNativeCurrency(chainId: number | string): Promise<Currency> {
    const normalizedChainId = this.normalizeChainId(chainId);
    const currencies = await this.getCurrencies();
    const nativeCurrency = currencies.find(
      (currency) => currency.chainId === normalizedChainId && currency.address == null,
    );

    if (!nativeCurrency) {
      throw new Error(`Native currency for chain ${normalizedChainId} not found.`);
    }

    return nativeCurrency;
  }

  async getInvoices(params: GetInvoicesParams): Promise<InvoiceList> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.invoicesApi.invoicesControllerFindInvoicesByDeploymentV1({
      deploymentId,
      id: params.id,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      updatedFrom: params.updatedFrom,
      updatedTo: params.updatedTo,
      currencyIds: params.currencyIds,
      statuses: params.statuses as InvoicesControllerFindInvoicesByDeploymentV1StatusesEnum[] | undefined,
      trackingId: params.trackingId,
      sortBy: params.sortBy as InvoicesControllerFindInvoicesByDeploymentV1SortByEnum | undefined,
      sortOrder: params.sortOrder as InvoicesControllerFindInvoicesByDeploymentV1SortOrderEnum | undefined,
      page: params.page,
      pageSize: params.pageSize,
    });

    return mapInvoiceList(response);
  }

  async getInvoice(params: GetInvoiceParams): Promise<InvoiceDetails> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.invoicesApi.invoicesControllerFindInvoiceByIdV1({
      deploymentId,
      invoiceId: params.invoiceId,
    });

    return mapInvoiceDetails(response);
  }

  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.invoicesApi.invoicesControllerCreateInvoiceV1({
      deploymentId,
      createInvoiceDto: {
        requestedAmount: params.requestedAmount ?? null,
        trackingId: params.trackingId ?? null,
        callbackUrl: params.callbackUrl ?? null,
        paymentPageButtonUrl: params.paymentPageButtonUrl ?? null,
        paymentPageButtonText: params.paymentPageButtonText ?? null,
        currencyIds: params.currencyIds,
      },
    });

    return mapInvoice(response);
  }

  async updateInvoice(params: UpdateInvoiceParams): Promise<Invoice> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const payload = this.buildInvoiceUpdatePayload(params);

    const response = await this.invoicesApi.invoicesControllerUpdateInvoiceV1({
      deploymentId,
      invoiceId: params.invoiceId,
      updateInvoiceDto: payload,
    });

    return mapInvoice(response);
  }

  async createPayout(params: CreatePayoutParams): Promise<Payout> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.payoutsApi.payoutsControllerCreateV1({
      deploymentId,
      createPayoutDto: {
        deploymentId,
        currencyId: params.currencyId,
        amount: params.amount,
        toAddress: params.recipient,
        trackingId: params.trackingId,
        callbackUrl: params.callbackUrl,
        nonce: params.nonce?.toString(),
      },
    });

    return mapPayout(response);
  }

  async getPayouts(params: GetPayoutsParams): Promise<PayoutList> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.payoutsApi.payoutsControllerFindAllV1({
      deploymentId,
      id: params.id,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      updatedFrom: params.updatedFrom,
      updatedTo: params.updatedTo,
      currencyIds: params.currencyIds,
      statuses: params.statuses as PayoutsControllerFindAllV1StatusesEnum[] | undefined,
      trackingId: params.trackingId,
      createdBy: params.createdBy,
      toAddress: params.toAddress,
      sortBy: params.sortBy as PayoutsControllerFindAllV1SortByEnum | undefined,
      sortOrder: params.sortOrder as PayoutsControllerFindAllV1SortOrderEnum | undefined,
      page: params.page,
      pageSize: params.pageSize,
    });

    return mapPayoutList(response);
  }

  async getPayout(params: GetPayoutParams): Promise<PayoutDetail> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.payoutsApi.payoutsControllerFindOneV1({
      deploymentId,
      payoutId: params.payoutId,
    });

    return mapPayoutDetail(response);
  }

  async updatePayout(params: UpdatePayoutParams): Promise<Payout> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const payload = this.buildPayoutUpdatePayload(params);

    const response = await this.payoutsApi.payoutsControllerUpdateV1({
      deploymentId,
      payoutId: params.payoutId,
      updatePayoutDto: payload,
    });

    return mapPayout(response);
  }

  async getDeploymentQueue(params: GetDeploymentQueueParams): Promise<DeploymentQueue> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.queueOperationsApi.queueOperationsControllerGetDeploymentQueueV1({
      deploymentId,
      page: params.page,
      pageSize: params.pageSize,
      statuses: params.statuses,
    });

    return mapDeploymentQueue(response);
  }

  async getTransactions(params: GetTransactionsParams): Promise<TransactionList> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.transactionsApi.transactionsControllerGetTransactionsV1({
      deploymentId,
      id: params.id,
      operationId: params.operationId,
      operationTypes: params.operationTypes as TransactionsControllerGetTransactionsV1OperationTypesEnum[] | undefined,
      statuses: params.statuses as TransactionsControllerGetTransactionsV1StatusesEnum[] | undefined,
      txHash: params.txHash,
      currencyIds: params.currencyIds,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      updatedFrom: params.updatedFrom,
      updatedTo: params.updatedTo,
      isClaimed: params.isClaimed,
      sortBy: params.sortBy as TransactionsControllerGetTransactionsV1SortByEnum | undefined,
      sortOrder: params.sortOrder as TransactionsControllerGetTransactionsV1SortOrderEnum | undefined,
      page: params.page,
      pageSize: params.pageSize,
    });

    return mapTransactionList(response);
  }

  async getTransaction(params: GetTransactionParams): Promise<TransactionDetails> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.transactionsApi.transactionsControllerGetTransactionDetailsV1({
      deploymentId,
      transactionId: params.transactionId,
    });

    return mapTransactionDetails(response);
  }

  async submitOperationSignature(params: SubmitOperationSignatureParams): Promise<Signature> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.queueOperationsApi.queueOperationsControllerSubmitSignatureV1({
      deploymentId,
      operationId: params.operationId,
      submitSignatureDto: {
        signature: params.signature,
      },
    });

    return mapSignature(response);
  }

  async getClaims(params: GetClaimsParams): Promise<ClaimsResponse> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.claimsApi.claimsControllerGetClaimsV1({
      deploymentId,
      createdFrom: params.createdFrom,
      createdTo: params.createdTo,
      updatedFrom: params.updatedFrom,
      updatedTo: params.updatedTo,
      currencyIds: params.currencyIds,
      invoiceId: params.invoiceId,
      sortBy: params.sortBy as ClaimsControllerGetClaimsV1SortByEnum | undefined,
      sortOrder: params.sortOrder as ClaimsControllerGetClaimsV1SortOrderEnum | undefined,
      page: params.page,
      pageSize: params.pageSize,
    });

    return mapClaimsResponse(response);
  }

  async getClaimableCurrencies(chainId?: ChainIdentifier): Promise<Currency[]> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.claimsApi.claimsControllerGetClaimableCurrenciesV1({
      deploymentId,
    });

    return response.map(mapCurrency);
  }

  private buildInvoiceUpdatePayload(params: UpdateInvoiceParams): UpdateInvoiceDto {
    const {
      requestedAmount,
      trackingId,
      callbackUrl,
      paymentPageButtonUrl,
      paymentPageButtonText,
      currencyIds,
      status,
    } = params;

    const payload: Partial<UpdateInvoiceDto> = {};

    if (requestedAmount !== undefined) {
      payload.requestedAmount = requestedAmount;
    }

    if (trackingId !== undefined) {
      payload.trackingId = trackingId;
    }

    if (callbackUrl !== undefined) {
      payload.callbackUrl = callbackUrl;
    }

    if (paymentPageButtonUrl !== undefined) {
      payload.paymentPageButtonUrl = paymentPageButtonUrl;
    }

    if (paymentPageButtonText !== undefined) {
      payload.paymentPageButtonText = paymentPageButtonText;
    }

    if (currencyIds !== undefined) {
      payload.currencyIds = currencyIds;
    }

    if (status !== undefined) {
      payload.status = status as UpdateInvoiceDtoStatusEnum;
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('At least one invoice field must be provided when updating an invoice.');
    }

    return payload as UpdateInvoiceDto;
  }

  private buildPayoutUpdatePayload(params: UpdatePayoutParams): UpdatePayoutDto {
    const { trackingId, callbackUrl } = params;
    const payload: Partial<UpdatePayoutDto> = {};

    if (trackingId !== undefined) {
      payload.trackingId = trackingId;
    }

    if (callbackUrl !== undefined) {
      payload.callbackUrl = callbackUrl;
    }

    if (Object.keys(payload).length === 0) {
      throw new Error('At least one payout field must be provided when updating a payout.');
    }

    return payload as UpdatePayoutDto;
  }

  private async resolveAccountId(): Promise<string> {
    if (this.defaultAccountId) {
      return this.defaultAccountId;
    }

    const accounts = await this.getAccounts();
    const firstAccount = accounts[0];

    if (!firstAccount) {
      throw new Error('No accounts are linked to this API key.');
    }

    this.defaultAccountId = firstAccount.id;
    return firstAccount.id;
  }

  private async resolveDeployment(chainId?: ChainIdentifier): Promise<AccountDeployment> {
    if (chainId !== undefined) {
      return this.selectChain(chainId);
    }

    if (this.selectedDeployment) {
      return this.selectedDeployment;
    }

    throw new Error('Chain is not selected. Call selectChain() or provide chainId in the method call.');
  }

  private async resolveDeploymentId(chainId?: ChainIdentifier): Promise<string> {
    const deployment = await this.resolveDeployment(chainId);
    return deployment.deploymentId;
  }

  private normalizeChainId(chainId: ChainIdentifier): string {
    return typeof chainId === 'number' ? chainId.toString() : chainId;
  }
}
