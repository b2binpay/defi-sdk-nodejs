import type { Address, Hex } from 'viem';
import type {
  AccountsControllerGetAssetBalancesV1BaseCurrencyEnum,
  AccountsControllerGetAssetBalancesV1SortByEnum,
  AccountsControllerGetAssetBalancesV1SortOrderEnum,
  AccountsControllerGetBalanceSummaryV1BaseCurrencyEnum,
  BlockchainOperationsControllerListGenericV2OperationTypesEnum,
  BlockchainOperationsControllerListGenericV2SortByEnum,
  BlockchainOperationsControllerListGenericV2SortOrderEnum,
  BlockchainOperationsControllerListGenericV2StatusesEnum,
  BlockchainTransactionsControllerListV1SortByEnum,
  BlockchainTransactionsControllerListV1SortOrderEnum,
  BlockchainTransactionsControllerListV1StatusesEnum,
  ClaimsControllerGetClaimsV1SortByEnum,
  ClaimsControllerGetClaimsV1SortOrderEnum,
  CrossChainUserStepDto,
  DelegateBodyDtoResourceTypeEnum,
  FetchAPI,
  HTTPHeaders,
  InvoicesControllerFindInvoicesByDeploymentV1SortByEnum,
  InvoicesControllerFindInvoicesByDeploymentV1SortOrderEnum,
  InvoicesControllerFindInvoicesByDeploymentV1StatusesEnum,
  Middleware,
  PayoutsControllerFindAllV1SortByEnum,
  PayoutsControllerFindAllV1SortOrderEnum,
  PayoutsControllerFindAllV1StatusesEnum,
  ReclaimBodyDtoResourceTypeEnum,
  StakeBodyDtoResourceTypeEnum,
  UniversalAddress,
  UnstakeBodyDtoResourceTypeEnum,
  UpdateInvoiceDto,
  UpdateInvoiceDtoStatusEnum,
  UpdatePayoutDto,
} from '../../generated-contracts';
import {
  AccountsApi,
  BlockchainTransactionsApi,
  CallbacksApi,
  ClaimsApi,
  Configuration,
  CrossChainTransfersApi,
  CurrenciesApi,
  InvoicesApi,
  NetworksApi,
  OperationsClaimToApi,
  OperationsCowswapApi,
  OperationsSetWhitelistApi,
  OperationsV2Api,
  PayoutsApi,
  QueueOperationsApi,
  ResponseError,
  SmartContractVersionsApi,
  TRXStakingApi,
} from '../../generated-contracts';
import { type AbiCacheEntry, AbiProvider, type SmartContractCapabilities } from '../abi-provider';
import { TRON_CHAIN_IDS } from '../blockchain/tron-chains';
import { formatCreditsWarning, parseCreditsError } from '../errors';
import { packSignatures } from '../utils/transactions/signatures';
import { TRON_ADDRESS_PREFIX, tronToEvmHex } from '../utils/tron-validation';
import type {
  AccountDeployment,
  AccountDetails,
  AssetBalanceList,
  AssetSortField,
  AssetSortOrder,
  BalanceSummary,
  BlockchainTransactionDetails,
  BlockchainTransactionList,
  BlockchainTransactionSortField,
  BlockchainTransactionStatus,
  CallbackList,
  ClaimsResponse,
  ClaimsSortField,
  CrossChainChain,
  CrossChainQuotes,
  CrossChainTransfer,
  Currency,
  DeploymentParams,
  DeploymentQueue,
  FiatCurrency,
  Invoice,
  InvoiceDetails,
  InvoiceList,
  InvoiceSortField,
  InvoiceStatus,
  Network,
  NonceInfo,
  OperationV2Details,
  OperationV2List,
  OperationV2SortField,
  OperationV2Status,
  Payout,
  PayoutDetail,
  PayoutList,
  PayoutSortField,
  PayoutStatus,
  QueueOperation,
  ResendCallbacksResult,
  Signature,
  SortOrder,
  StakingDelegationSummary,
  StakingDelegations,
  StakingNetworkParams,
  StakingResourceType,
  StakingSummary,
  SuperRepresentatives,
  VotingSummary,
} from './models';
import { OperationTypeV2, QueueOperationStatus } from './models';
import {
  mapAccountDetails,
  mapAssetBalanceList,
  mapBalanceSummary,
  mapBlockchainTransactionDetails,
  mapBlockchainTransactionList,
  mapCallbackList,
  mapClaimsResponse,
  mapCrossChainChain,
  mapCrossChainQuotes,
  mapCrossChainTransfer,
  mapCurrency,
  mapDeploymentQueue,
  mapInvoice,
  mapInvoiceDetails,
  mapInvoiceList,
  mapNetwork,
  mapOperationV2List,
  mapPayout,
  mapPayoutDetail,
  mapPayoutList,
  mapQueueOperation,
  mapSignature,
  mapStakingDelegationSummary,
  mapStakingDelegations,
  mapStakingNetworkParams,
  mapStakingSummary,
  mapSuperRepresentatives,
  mapVotingSummary,
} from './models/mappers';

export interface DefiClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchApi?: FetchAPI;
  middleware?: Middleware[];
  defaultHeaders?: HTTPHeaders;
  credentials?: RequestCredentials;
  queryParamsStringify?: (params: Record<string, unknown>) => string;
  abiCacheDir?: string;
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
  nonce?: string;
}

export interface GetDeploymentQueueParams extends ChainScopedParams {
  statuses?: QueueOperationStatus[];
  page?: number;
  pageSize?: number;
}

export interface DeleteQueueOperationParams extends ChainScopedParams {
  operationId: string;
}

/** Statuses the API permits for deletion. */
export type DeletableQueueOperationStatus = QueueOperationStatus.Pending | QueueOperationStatus.Ready;

export interface DeleteAllQueueOperationsParams extends ChainScopedParams {
  /** Statuses to delete. Defaults to PENDING + READY (the only ones the API allows). */
  statuses?: DeletableQueueOperationStatus[];
}

export interface SubmitOperationSignatureParams extends ChainScopedParams {
  operationId: string;
  /** Raw ECDSA signature (hex). Will be packed automatically based on contract version. */
  signature: string;
  /** Signer address. Required for v1.1.0+ contracts to pack the signature. */
  signerAddress: string;
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
  expiresFrom?: string;
  expiresTo?: string;
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

export interface GetCallbacksParams {
  /** Invoice or payout id to fetch callbacks for. */
  operationId: string;
  page?: number;
  pageSize?: number;
}

export interface ResendCallbacksParams {
  /** Ids of FAILED callbacks to re-queue for delivery. */
  ids: string[];
}

export interface GetQueueOperationParams extends ChainScopedParams {
  operationId: string;
}

export interface CreateStakeOperationParams extends ChainScopedParams {
  amount: string;
  resourceType: StakingResourceType;
}

export interface CreateUnstakeOperationParams extends ChainScopedParams {
  amount: string;
  resourceType: StakingResourceType;
}

export interface CreateDelegateOperationParams extends ChainScopedParams {
  amount: string;
  resourceType: StakingResourceType;
  recipient: string;
  /** Lock the delegation for the network-defined period. */
  lock?: boolean;
}

export interface CreateReclaimOperationParams extends ChainScopedParams {
  amount: string;
  resourceType: StakingResourceType;
  recipient: string;
}

export interface CreateVoteOperationParams extends ChainScopedParams {
  /** Map of super-representative address to vote count. */
  allocation: Record<string, string>;
}

export interface GetStakingDelegationsParams extends ChainScopedParams {
  page?: number;
  pageSize?: number;
}

export interface GetCrossChainDestinationCurrenciesParams extends ChainScopedParams {
  srcCurrencyId?: string;
}

export interface GetCrossChainQuoteParams extends ChainScopedParams {
  srcCurrencyId: string;
  dstCurrencyId: string;
  dstWalletAddress: UniversalAddress;
  amount: string;
}

export interface CreateCrossChainTransferParams extends ChainScopedParams {
  quoteId: string;
  routeType: string;
  srcCurrencyId: string;
  srcAmount: string;
  dstCurrencyId: string;
  dstAmount: string;
  dstWalletAddress: UniversalAddress;
  userSteps: CrossChainUserStepDto[];
  feeUsd?: string | null;
  feePercent?: string | null;
  estimatedDurationMs?: number | null;
  expiresAt?: Date | null;
  nonce?: string;
}

export interface GetOperationsV2Params extends ChainScopedParams {
  types?: OperationTypeV2[];
  statuses?: OperationV2Status[];
  id?: string;
  txHash?: string;
  txId?: string;
  currencyIds?: string[];
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  sortBy?: OperationV2SortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface GetOperationDetailsV2Params extends ChainScopedParams {
  type: OperationTypeV2;
  operationId: string;
}

export interface GetBlockchainTransactionsParams extends ChainScopedParams {
  statuses?: BlockchainTransactionStatus[];
  txHash?: string;
  blockNumberFrom?: string;
  blockNumberTo?: string;
  sortBy?: BlockchainTransactionSortField;
  sortOrder?: SortOrder;
  page?: number;
  pageSize?: number;
}

export interface GetBlockchainTransactionParams extends ChainScopedParams {
  transactionId: string;
}

export class DefiClient {
  private readonly config: Configuration;
  private readonly accountsApi: AccountsApi;
  private readonly currenciesApi: CurrenciesApi;
  private readonly invoicesApi: InvoicesApi;
  private readonly claimsApi: ClaimsApi;
  private readonly payoutsApi: PayoutsApi;
  private readonly queueOperationsApi: QueueOperationsApi;
  private readonly smartContractVersionsApi: SmartContractVersionsApi;
  private readonly callbacksApi: CallbacksApi;
  private readonly networksApi: NetworksApi;
  private readonly trxStakingApi: TRXStakingApi;
  private readonly crossChainApi: CrossChainTransfersApi;
  private readonly operationsV2Api: OperationsV2Api;
  private readonly operationsClaimToApi: OperationsClaimToApi;
  private readonly operationsCowswapApi: OperationsCowswapApi;
  private readonly operationsSetWhitelistApi: OperationsSetWhitelistApi;
  private readonly blockchainTransactionsApi: BlockchainTransactionsApi;
  private readonly abiProvider: AbiProvider;
  private accountInfoPromise?: Promise<{
    accountId: string;
    smartContractVersionId: string;
    details: AccountDetails;
  }>;
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
    this.smartContractVersionsApi = new SmartContractVersionsApi(this.config);
    this.callbacksApi = new CallbacksApi(this.config);
    this.networksApi = new NetworksApi(this.config);
    this.trxStakingApi = new TRXStakingApi(this.config);
    this.crossChainApi = new CrossChainTransfersApi(this.config);
    this.operationsV2Api = new OperationsV2Api(this.config);
    this.operationsClaimToApi = new OperationsClaimToApi(this.config);
    this.operationsCowswapApi = new OperationsCowswapApi(this.config);
    this.operationsSetWhitelistApi = new OperationsSetWhitelistApi(this.config);
    this.blockchainTransactionsApi = new BlockchainTransactionsApi(this.config);
    this.abiProvider = new AbiProvider(this.smartContractVersionsApi, options.abiCacheDir);
  }

  async getContractAbi(versionId?: string): Promise<AbiCacheEntry> {
    const resolvedVersionId = versionId ?? (await this.resolveSmartContractVersionId());
    return this.abiProvider.getAbi(resolvedVersionId);
  }

  /**
   * Feature flags of the account's multisig contract version — use them to gate UI and flows
   * (e.g. hide invoice creation when `supportsInvoices` is false). Shares the ABI cache, so this
   * costs no extra request once the ABI has been fetched.
   *
   * Returns `undefined` when the API does not report the flags: an older deployment omits them, and
   * treating that as all-false would hide flows that in fact work. Fall back to attempting the call.
   */
  async getContractCapabilities(versionId?: string): Promise<SmartContractCapabilities | undefined> {
    const entry = await this.getContractAbi(versionId);
    return entry.capabilities;
  }

  async getAssetBalances(params: GetAssetBalancesParams): Promise<AssetBalanceList> {
    const accountId = await this.resolveAccountId();
    const chainId = params.chainId ?? (await this.resolveDeployment()).chainId;

    const response = await this.callApi(() =>
      this.accountsApi.accountsControllerGetAssetBalancesV1({
        accountId,
        baseCurrency: params.baseCurrency as AccountsControllerGetAssetBalancesV1BaseCurrencyEnum,
        chainId: chainId.toString(),
        sortBy: params.sortBy as AccountsControllerGetAssetBalancesV1SortByEnum | undefined,
        sortOrder: params.sortOrder as AccountsControllerGetAssetBalancesV1SortOrderEnum | undefined,
        currencyIds: params.currencyIds,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapAssetBalanceList(response);
  }

  async getAccount(): Promise<AccountDetails> {
    const info = await this.resolveAccountInfo();
    return info.details;
  }

  /** Fetch multisig deployment parameters (implementation address, initializer bytecode, nonce, deployer address). */
  async getDeploymentInfo(): Promise<DeploymentParams> {
    const accountId = await this.resolveAccountId();
    return this.callApi(() => this.accountsApi.accountsControllerGetDeploymentInfoV1({ accountId }));
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
    const summary = await this.callApi(() =>
      this.accountsApi.accountsControllerGetBalanceSummaryV1({
        accountId: resolvedAccountId,
        baseCurrency: params.baseCurrency as AccountsControllerGetBalanceSummaryV1BaseCurrencyEnum,
        chainId: params.chainId.toString(),
      }),
    );
    return mapBalanceSummary(summary);
  }

  async getCurrencies(): Promise<Currency[]> {
    const currencies = await this.callApi(() => this.currenciesApi.currenciesControllerFindAllV1());
    return currencies.map(mapCurrency);
  }

  /** Fetch a single currency by its id. */
  async getCurrency(currencyId: string): Promise<Currency> {
    const response = await this.callApi(() => this.currenciesApi.currenciesControllerFindOneV1({ id: currencyId }));
    return mapCurrency(response);
  }

  /** List all networks (chains) supported by the platform. */
  async getNetworks(): Promise<Network[]> {
    const response = await this.callApi(() => this.networksApi.networksControllerFindAllV1());
    return response.items.map(mapNetwork);
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

      if (currency.chainId !== targetChain) {
        return false;
      }

      // On TVM chains, exclude currencies with EVM-style addresses (0x...) — stale data
      if (TRON_CHAIN_IDS.has(Number(targetChain)) && currency.address?.startsWith('0x')) {
        return false;
      }

      return true;
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

    const response = await this.callApi(() =>
      this.invoicesApi.invoicesControllerFindInvoicesByDeploymentV1({
        deploymentId,
        id: params.id,
        createdFrom: params.createdFrom,
        createdTo: params.createdTo,
        updatedFrom: params.updatedFrom,
        updatedTo: params.updatedTo,
        expiresFrom: params.expiresFrom,
        expiresTo: params.expiresTo,
        currencyIds: params.currencyIds,
        statuses: params.statuses as InvoicesControllerFindInvoicesByDeploymentV1StatusesEnum[] | undefined,
        trackingId: params.trackingId,
        sortBy: params.sortBy as InvoicesControllerFindInvoicesByDeploymentV1SortByEnum | undefined,
        sortOrder: params.sortOrder as InvoicesControllerFindInvoicesByDeploymentV1SortOrderEnum | undefined,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapInvoiceList(response);
  }

  async getInvoice(params: GetInvoiceParams): Promise<InvoiceDetails> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.invoicesApi.invoicesControllerFindInvoiceByIdV1({
        deploymentId,
        invoiceId: params.invoiceId,
      }),
    );

    return mapInvoiceDetails(response);
  }

  async createInvoice(params: CreateInvoiceParams): Promise<Invoice> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.invoicesApi.invoicesControllerCreateInvoiceV1({
        deploymentId,
        createInvoiceDto: {
          requestedAmount: params.requestedAmount ?? null,
          trackingId: params.trackingId ?? null,
          callbackUrl: params.callbackUrl ?? null,
          paymentPageButtonUrl: params.paymentPageButtonUrl ?? null,
          paymentPageButtonText: params.paymentPageButtonText ?? null,
          currencyIds: params.currencyIds,
        },
      }),
    );

    return mapInvoice(response);
  }

  async updateInvoice(params: UpdateInvoiceParams): Promise<Invoice> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const payload = this.buildInvoiceUpdatePayload(params);

    const response = await this.callApi(() =>
      this.invoicesApi.invoicesControllerUpdateInvoiceV1({
        deploymentId,
        invoiceId: params.invoiceId,
        updateInvoiceDto: payload,
      }),
    );

    return mapInvoice(response);
  }

  async createPayout(params: CreatePayoutParams): Promise<Payout> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.payoutsApi.payoutsControllerCreateV1({
        deploymentId,
        createPayoutDto: {
          deploymentId,
          currencyId: params.currencyId,
          amount: params.amount,
          toAddress: params.recipient,
          trackingId: params.trackingId,
          callbackUrl: params.callbackUrl,
          nonce: params.nonce,
        },
      }),
    );

    return mapPayout(response);
  }

  async getPayouts(params: GetPayoutsParams): Promise<PayoutList> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.payoutsApi.payoutsControllerFindAllV1({
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
      }),
    );

    return mapPayoutList(response);
  }

  async getPayout(params: GetPayoutParams): Promise<PayoutDetail> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.payoutsApi.payoutsControllerFindOneV1({
        deploymentId,
        payoutId: params.payoutId,
      }),
    );

    return mapPayoutDetail(response);
  }

  async updatePayout(params: UpdatePayoutParams): Promise<Payout> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const payload = this.buildPayoutUpdatePayload(params);

    const response = await this.callApi(() =>
      this.payoutsApi.payoutsControllerUpdateV1({
        deploymentId,
        payoutId: params.payoutId,
        updatePayoutDto: payload,
      }),
    );

    return mapPayout(response);
  }

  async getDeploymentQueue(params: GetDeploymentQueueParams): Promise<DeploymentQueue> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.queueOperationsApi.queueOperationsControllerGetDeploymentQueueV1({
        deploymentId,
        page: params.page,
        pageSize: params.pageSize,
        statuses: params.statuses,
      }),
    );

    return mapDeploymentQueue(response);
  }

  /** Fetch a single queue operation by id. */
  async getQueueOperation(params: GetQueueOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.queueOperationsApi.queueOperationsControllerGetOperationByIdV1({
        deploymentId,
        operationId: params.operationId,
      }),
    );

    return mapQueueOperation(response);
  }

  /**
   * Create a TRON stake operation. Returns the queue operation to sign and execute
   * with the standard multisig flow (`getQueueOperation` → sign → `submitOperationSignature` → execute).
   */
  async createStakeOperation(params: CreateStakeOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateStakeV1({
        deploymentId,
        stakeBodyDto: {
          amount: params.amount,
          resourceType: params.resourceType as StakeBodyDtoResourceTypeEnum,
        },
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON unstake operation. Returns a signable queue operation. */
  async createUnstakeOperation(params: CreateUnstakeOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateUnstakeV1({
        deploymentId,
        unstakeBodyDto: {
          amount: params.amount,
          resourceType: params.resourceType as UnstakeBodyDtoResourceTypeEnum,
        },
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON delegate-resource operation. Returns a signable queue operation. */
  async createDelegateOperation(params: CreateDelegateOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateDelegateV1({
        deploymentId,
        delegateBodyDto: {
          amount: params.amount,
          resourceType: params.resourceType as DelegateBodyDtoResourceTypeEnum,
          recipient: params.recipient,
          lock: params.lock,
        },
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON reclaim (undelegate) operation. Returns a signable queue operation. */
  async createReclaimOperation(params: CreateReclaimOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateReclaimV1({
        deploymentId,
        reclaimBodyDto: {
          amount: params.amount,
          resourceType: params.resourceType as ReclaimBodyDtoResourceTypeEnum,
          recipient: params.recipient,
        },
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON vote operation allocating votes to super representatives. Returns a signable queue operation. */
  async createVoteOperation(params: CreateVoteOperationParams): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateVoteV1({
        deploymentId,
        voteBodyDto: {
          allocation: params.allocation,
        },
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON cancel-unstaking operation. Returns a signable queue operation. */
  async createCancelUnstakingOperation(params: ChainScopedParams = {}): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateCancelUnstakingV1({
        deploymentId,
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON staking-withdraw operation. Returns a signable queue operation. */
  async createStakingWithdrawOperation(params: ChainScopedParams = {}): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateStakingWithdrawV1({
        deploymentId,
      }),
    );

    return mapQueueOperation(response);
  }

  /** Create a TRON claim-rewards operation. Returns a signable queue operation. */
  async createClaimRewardsOperation(params: ChainScopedParams = {}): Promise<QueueOperation> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingOperationsControllerCreateClaimRewardsV1({
        deploymentId,
      }),
    );

    return mapQueueOperation(response);
  }

  /** Read the account's TRON staking summary. */
  async getStakingSummary(chainId?: ChainIdentifier): Promise<StakingSummary> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetSummaryV1({ deploymentId }),
    );

    return mapStakingSummary(response);
  }

  /** Read the account's resource delegations (paginated). */
  async getStakingDelegations(params: GetStakingDelegationsParams = {}): Promise<StakingDelegations> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetDelegationsV1({
        deploymentId,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapStakingDelegations(response);
  }

  /** Read the aggregated delegation summary. */
  async getStakingDelegationSummary(chainId?: ChainIdentifier): Promise<StakingDelegationSummary> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetDelegationSummaryV1({ deploymentId }),
    );

    return mapStakingDelegationSummary(response);
  }

  /** Read TRON staking network params (e.g. unstaking period, resource prices). */
  async getStakingNetworkParams(chainId?: ChainIdentifier): Promise<StakingNetworkParams> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetNetworkParamsV1({ deploymentId }),
    );

    return mapStakingNetworkParams(response);
  }

  /** Read the list of super representatives available for voting. */
  async getSuperRepresentatives(chainId?: ChainIdentifier): Promise<SuperRepresentatives> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetSuperRepresentativesV1({ deploymentId }),
    );

    return mapSuperRepresentatives(response);
  }

  /** Read the account's current voting summary. */
  async getVotingSummary(chainId?: ChainIdentifier): Promise<VotingSummary> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.trxStakingApi.deploymentStakingViewsControllerGetVotingSummaryV1({ deploymentId }),
    );

    return mapVotingSummary(response);
  }

  /** List chains supported for cross-chain transfers. */
  async getCrossChainChains(): Promise<CrossChainChain[]> {
    const response = await this.callApi(() => this.crossChainApi.crossChainControllerListChainsV1());
    return response.map(mapCrossChainChain);
  }

  /** List currencies usable as the source of a cross-chain transfer. */
  async getCrossChainSourceCurrencies(chainId?: ChainIdentifier): Promise<Currency[]> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.crossChainApi.deploymentCrossChainControllerListSourceCurrenciesV1({ deploymentId }),
    );

    return response.map(mapCurrency);
  }

  /** List currencies usable as the destination of a cross-chain transfer. */
  async getCrossChainDestinationCurrencies(params: GetCrossChainDestinationCurrenciesParams = {}): Promise<Currency[]> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.crossChainApi.crossChainControllerListDestinationCurrenciesV1({
        deploymentId,
        srcCurrencyId: params.srcCurrencyId,
      }),
    );

    return response.map(mapCurrency);
  }

  /** Fetch cross-chain transfer route quotes for the given source/destination and amount. */
  async getCrossChainQuote(params: GetCrossChainQuoteParams): Promise<CrossChainQuotes> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.crossChainApi.deploymentCrossChainControllerGetQuoteV1({
        deploymentId,
        quoteRequestDto: {
          srcCurrencyId: params.srcCurrencyId,
          dstCurrencyId: params.dstCurrencyId,
          dstWalletAddress: params.dstWalletAddress,
          amount: params.amount,
        },
      }),
    );

    return mapCrossChainQuotes(response);
  }

  /**
   * Create a cross-chain transfer from a chosen quote. The returned entity carries
   * `queueOperationId` + `nonce`; sign and execute it with the standard multisig flow.
   */
  async createCrossChainTransfer(params: CreateCrossChainTransferParams): Promise<CrossChainTransfer> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.crossChainApi.deploymentCrossChainControllerCreateTransferV1({
        deploymentId,
        createCrossChainTransferDto: {
          quoteId: params.quoteId,
          routeType: params.routeType,
          srcCurrencyId: params.srcCurrencyId,
          srcAmount: params.srcAmount,
          dstCurrencyId: params.dstCurrencyId,
          dstAmount: params.dstAmount,
          dstWalletAddress: params.dstWalletAddress,
          userSteps: params.userSteps,
          feeUsd: params.feeUsd,
          feePercent: params.feePercent,
          estimatedDurationMs: params.estimatedDurationMs,
          expiresAt: params.expiresAt,
          nonce: params.nonce,
        },
      }),
    );

    return mapCrossChainTransfer(response);
  }

  /** List operations from the v2 operations history, optionally filtered by operation type. */
  async getOperationsV2(params: GetOperationsV2Params = {}): Promise<OperationV2List> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.operationsV2Api.blockchainOperationsControllerListGenericV2({
        deploymentId,
        operationTypes: params.types as BlockchainOperationsControllerListGenericV2OperationTypesEnum[] | undefined,
        statuses: params.statuses as BlockchainOperationsControllerListGenericV2StatusesEnum[] | undefined,
        id: params.id,
        txHash: params.txHash,
        txId: params.txId,
        currencyIds: params.currencyIds,
        createdFrom: params.createdFrom,
        createdTo: params.createdTo,
        updatedFrom: params.updatedFrom,
        updatedTo: params.updatedTo,
        sortBy: params.sortBy as BlockchainOperationsControllerListGenericV2SortByEnum | undefined,
        sortOrder: params.sortOrder as BlockchainOperationsControllerListGenericV2SortOrderEnum | undefined,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapOperationV2List(response);
  }

  /** Fetch the typed details of a single v2 operation, dispatched by operation type. */
  async getOperationDetailsV2(params: GetOperationDetailsV2Params): Promise<OperationV2Details> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const api = this.operationsV2Api;

    const dispatch: Record<OperationTypeV2, (opId: string) => Promise<OperationV2Details>> = {
      [OperationTypeV2.Payout]: (opId) => api.blockchainPayoutOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.InvoiceDeposit]: (opId) =>
        api.blockchainInvoiceDepositOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Claim]: (opId) => api.blockchainClaimOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.ClaimTo]: (opId) =>
        this.operationsClaimToApi.blockchainClaimToOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Cowswap]: (opId) =>
        this.operationsCowswapApi.blockchainCowswapOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.SetWhitelist]: (opId) =>
        this.operationsSetWhitelistApi.blockchainSetWhitelistOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Deploy]: (opId) => api.blockchainDeployOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.DirectDeposit]: (opId) =>
        api.blockchainDirectDepositOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Reject]: (opId) => api.blockchainRejectOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.SetConfig]: (opId) =>
        api.blockchainSetMultisigConfigOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.DappTransaction]: (opId) =>
        api.blockchainDappTransactionOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.CrossChainTransfer]: (opId) =>
        api.blockchainCrossChainTransferOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Stake]: (opId) => api.blockchainStakeOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Unstake]: (opId) =>
        api.blockchainUnstakeOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.CancelUnstaking]: (opId) =>
        api.blockchainCancelUnstakingOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.StakingWithdraw]: (opId) =>
        api.blockchainStakingWithdrawOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Vote]: (opId) => api.blockchainVoteOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.ClaimRewards]: (opId) =>
        api.blockchainClaimRewardsOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Delegate]: (opId) =>
        api.blockchainDelegateOperationsControllerGetDetailsV2({ deploymentId, opId }),
      [OperationTypeV2.Reclaim]: (opId) =>
        api.blockchainReclaimOperationsControllerGetDetailsV2({ deploymentId, opId }),
    };

    const fetchDetails = dispatch[params.type];
    if (!fetchDetails) {
      throw new Error(`Unsupported operation type for details: ${params.type}`);
    }

    return this.callApi(() => fetchDetails(params.operationId));
  }

  /** List blockchain transactions for the deployment. */
  async getBlockchainTransactions(params: GetBlockchainTransactionsParams = {}): Promise<BlockchainTransactionList> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.blockchainTransactionsApi.blockchainTransactionsControllerListV1({
        deploymentId,
        statuses: params.statuses as BlockchainTransactionsControllerListV1StatusesEnum[] | undefined,
        txHash: params.txHash,
        blockNumberFrom: params.blockNumberFrom,
        blockNumberTo: params.blockNumberTo,
        sortBy: params.sortBy as BlockchainTransactionsControllerListV1SortByEnum | undefined,
        sortOrder: params.sortOrder as BlockchainTransactionsControllerListV1SortOrderEnum | undefined,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapBlockchainTransactionList(response);
  }

  /** Fetch a single blockchain transaction by id. */
  async getBlockchainTransaction(params: GetBlockchainTransactionParams): Promise<BlockchainTransactionDetails> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.blockchainTransactionsApi.blockchainTransactionsControllerGetOneV1({
        deploymentId,
        blockchainTransactionId: params.transactionId,
      }),
    );

    return mapBlockchainTransactionDetails(response);
  }

  /** Fetch the current and last-executed nonce for the deployment. */
  async getNonceInfo(chainId?: ChainIdentifier): Promise<NonceInfo> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    return this.callApi(() =>
      this.accountsApi.accountDeploymentsControllerGetNonceInfoV1({
        deploymentId,
      }),
    );
  }

  async deleteQueueOperation(params: DeleteQueueOperationParams): Promise<void> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    await this.callApi(() =>
      this.queueOperationsApi.queueOperationsControllerDeleteOperationV1({
        deploymentId,
        operationId: params.operationId,
      }),
    );
  }

  /**
   * Delete every deletable queue operation owned by this API key.
   * Server only accepts deletion for PENDING/READY; other statuses are skipped.
   * Returns deleted operation ids.
   */
  async deleteAllQueueOperations(params: DeleteAllQueueOperationsParams = {}): Promise<string[]> {
    const statuses: DeletableQueueOperationStatus[] = params.statuses ?? [
      QueueOperationStatus.Pending,
      QueueOperationStatus.Ready,
    ];
    const pageSize = 100;
    const deletedIds: string[] = [];

    /**
     * Always fetch page 1: after deleting items, the remaining matches collapse
     * back to page 1, so advancing the cursor would skip the survivors.
     */
    while (true) {
      const queue = await this.getDeploymentQueue({ chainId: params.chainId, statuses, page: 1, pageSize });
      if (queue.items.length === 0) {
        break;
      }
      for (const op of queue.items) {
        await this.deleteQueueOperation({ chainId: params.chainId, operationId: op.id });
        deletedIds.push(op.id);
      }
    }

    return deletedIds;
  }

  async submitOperationSignature(params: SubmitOperationSignatureParams): Promise<Signature> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);
    const contractAbi = await this.getContractAbi();

    // Normalize Tron base58 addresses to 0x hex for signature packing
    const signerAddress = params.signerAddress.startsWith(TRON_ADDRESS_PREFIX)
      ? (tronToEvmHex(params.signerAddress) as Address)
      : (params.signerAddress as Address);

    const packedSignature = packSignatures(
      [{ user: signerAddress, sign: params.signature as Hex }],
      contractAbi.version,
    );

    const response = await this.callApi(() =>
      this.queueOperationsApi.queueOperationsControllerSubmitSignatureV1({
        deploymentId,
        operationId: params.operationId,
        submitSignatureDto: {
          signature: packedSignature,
        },
      }),
    );

    return mapSignature(response);
  }

  async getClaims(params: GetClaimsParams): Promise<ClaimsResponse> {
    const deploymentId = await this.resolveDeploymentId(params.chainId);

    const response = await this.callApi(() =>
      this.claimsApi.claimsControllerGetClaimsV1({
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
      }),
    );

    return mapClaimsResponse(response);
  }

  async getClaimableCurrencies(chainId?: ChainIdentifier): Promise<Currency[]> {
    const deploymentId = await this.resolveDeploymentId(chainId);

    const response = await this.callApi(() =>
      this.claimsApi.claimsControllerGetClaimableCurrenciesV1({
        deploymentId,
      }),
    );

    return response.map(mapCurrency);
  }

  /** Fetch the paginated callback delivery log for an invoice or payout. */
  async getCallbacks(params: GetCallbacksParams): Promise<CallbackList> {
    const response = await this.callApi(() =>
      this.callbacksApi.callbacksControllerGetCallbacksV1({
        operationId: params.operationId,
        page: params.page,
        pageSize: params.pageSize,
      }),
    );

    return mapCallbackList(response);
  }

  /** Re-queue FAILED callbacks for delivery. Only callbacks owned by this API key are eligible. */
  async resendCallbacks(params: ResendCallbacksParams): Promise<ResendCallbacksResult> {
    return this.callApi(() =>
      this.callbacksApi.callbacksControllerResendCallbacksV1({
        resendCallbacksBodyDto: { ids: params.ids },
      }),
    );
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

  private resolveAccountInfo(): Promise<{
    accountId: string;
    smartContractVersionId: string;
    details: AccountDetails;
  }> {
    if (!this.accountInfoPromise) {
      this.accountInfoPromise = this.fetchAccountInfo();
    }
    return this.accountInfoPromise;
  }

  private async fetchAccountInfo(): Promise<{
    accountId: string;
    smartContractVersionId: string;
    details: AccountDetails;
  }> {
    const accounts = await this.callApi(() => this.accountsApi.accountsControllerFindUserAccountsV1());
    const firstAccount = accounts[0];

    if (!firstAccount) {
      throw new Error('No accounts are linked to this API key.');
    }

    const raw = await this.callApi(() =>
      this.accountsApi.accountsControllerFindAccountByIdV1({
        accountId: firstAccount.id,
      }),
    );
    const details = mapAccountDetails(raw);

    return {
      accountId: firstAccount.id,
      smartContractVersionId: raw.account.smartContractVersionId,
      details,
    };
  }

  private async resolveAccountId(): Promise<string> {
    const info = await this.resolveAccountInfo();
    return info.accountId;
  }

  private async resolveSmartContractVersionId(): Promise<string> {
    const info = await this.resolveAccountInfo();
    return info.smartContractVersionId;
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

  private async callApi<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof ResponseError) {
        const creditsError = await parseCreditsError(err);
        if (creditsError) {
          console.warn(formatCreditsWarning(creditsError.required, creditsError.available));
          throw creditsError;
        }
      }
      throw err;
    }
  }
}
