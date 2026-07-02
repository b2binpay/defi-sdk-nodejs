import type {
  AccountDeploymentDto,
  AccountDetailsDto,
  AccountResponseDto,
  AssetBalanceDto,
  AssetBalancesResponseDto,
  BalanceSummaryResponseDto,
  BlockchainOperationListResponseDto,
  BlockchainTransactionDetailsResponseDto,
  BlockchainTransactionListResponseDto,
  CallbackResponseDto,
  CallDto,
  ClaimItemDto,
  ClaimsResponseDto,
  CrossChainChainResponseDto,
  CrossChainQuotesResponseDto,
  CrossChainTransferResponseDto,
  CurrencyResponseDto,
  DelegationSummaryResponse,
  DeploymentQueueResponseDto,
  GetCallbacksResponseDto,
  InvoiceDetailsDto,
  InvoiceResponseDto,
  InvoicesResponseDto,
  NetworkResponseDto,
  OperationSignatureDto,
  PayoutDetailResponseDto,
  PayoutListResponseDto,
  PayoutResponseDto,
  QueueOperationResponseDto,
  SignatureResponseDto,
  StakingDelegationsResponse,
  StakingNetworkParamsResponse,
  StakingSummaryResponse,
  SuperRepresentativesResponse,
  TransactionDetailsDto,
  TransactionListResponseDto,
  TransactionListResponseDtoItemsInner,
  TransactionListResponseDtoItemsInnerInvoice,
  VotingSummaryResponse,
} from '../../../generated-contracts';
import type {
  Account,
  AccountDeployment,
  AccountDeploymentStatus,
  AccountDetails,
  AssetBalance,
  AssetBalanceList,
  BalanceSummary,
  BlockchainTransactionDetails,
  BlockchainTransactionList,
  Call,
  Callback,
  CallbackList,
  CallbackOperationType,
  CallbackStatus,
  CallbackType,
  ClaimItem,
  ClaimsResponse,
  CrossChainChain,
  CrossChainQuotes,
  CrossChainTransfer,
  Currency,
  DeploymentQueue,
  ExecuteBatchOperationsResult,
  Invoice,
  InvoiceDetails,
  InvoiceList,
  InvoiceStatus,
  Network,
  OperationSignature,
  OperationV2,
  OperationV2List,
  Payout,
  PayoutDetail,
  PayoutList,
  PayoutStatus,
  QueueOperation,
  QueueOperationStatus,
  QueueOperationType,
  Signature,
  StakingDelegationSummary,
  StakingDelegations,
  StakingNetworkParams,
  StakingSummary,
  SuperRepresentatives,
  Transaction,
  TransactionDetails,
  TransactionDirection,
  TransactionInvoice,
  TransactionList,
  TransactionOperationType,
  TransactionStatus,
  VotingSummary,
} from './types';

const clone = <T>(value: T): T => ({ ...value });

export const mapAccount = (dto: AccountResponseDto): Account => clone(dto);

export const mapAccountDeployment = (dto: AccountDeploymentDto): AccountDeployment => ({
  ...dto,
  deploymentStatus: dto.deploymentStatus as AccountDeploymentStatus,
});

export const mapAccountDetails = (dto: AccountDetailsDto): AccountDetails => ({
  account: mapAccount(dto.account),
  deployments: dto.deployments.map(mapAccountDeployment),
});

export const mapBalanceSummary = (dto: BalanceSummaryResponseDto): BalanceSummary => clone(dto);

export const mapCurrency = (dto: CurrencyResponseDto): Currency => clone(dto);

export const mapNetwork = (dto: NetworkResponseDto): Network => clone(dto);

export const mapAssetBalance = (dto: AssetBalanceDto): AssetBalance => ({
  ...dto,
  currency: mapCurrency(dto.currency),
});

export const mapAssetBalanceList = (dto: AssetBalancesResponseDto): AssetBalanceList => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapAssetBalance),
});

export const mapInvoice = (dto: InvoiceResponseDto): Invoice => ({
  ...dto,
  status: dto.status as InvoiceStatus,
  availableCurrencies: dto.availableCurrencies.map(mapCurrency),
});

export const mapInvoiceDetails = (dto: InvoiceDetailsDto): InvoiceDetails => ({
  invoice: mapInvoice(dto.invoice),
});

export const mapInvoiceList = (dto: InvoicesResponseDto): InvoiceList => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapInvoice),
});

export const mapPayout = (dto: PayoutResponseDto): Payout => ({
  ...dto,
  status: dto.status as PayoutStatus,
  currency: mapCurrency(dto.currency),
});

export const mapPayoutDetail = (dto: PayoutDetailResponseDto): PayoutDetail => ({
  ...dto,
  status: dto.status as PayoutStatus,
  currency: mapCurrency(dto.currency),
});

export const mapPayoutList = (dto: PayoutListResponseDto): PayoutList => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapPayout),
});

export const mapOperationSignature = (dto: OperationSignatureDto): OperationSignature => clone(dto);

export const mapCall = (dto: CallDto): Call => clone(dto);

export const mapQueueOperation = (dto: QueueOperationResponseDto): QueueOperation => ({
  ...dto,
  operationType: dto.operationType as QueueOperationType,
  status: dto.status as QueueOperationStatus,
  calls: dto.calls.map(mapCall),
  signatures: dto.signatures.map(mapOperationSignature),
});

export const mapDeploymentQueue = (dto: DeploymentQueueResponseDto): DeploymentQueue => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  nextExecutableNonce: dto.nextExecutableNonce,
  items: dto.items.map(mapQueueOperation),
});

export const mapExecuteBatchOperationsResult = (): ExecuteBatchOperationsResult => ({
  success: true,
});

const mapTransactionInvoice = (dto: TransactionListResponseDtoItemsInnerInvoice): TransactionInvoice => clone(dto);

export const mapTransaction = (dto: TransactionListResponseDtoItemsInner): Transaction => ({
  ...dto,
  direction: dto.direction as TransactionDirection,
  status: dto.status as TransactionStatus,
  operationType: dto.operationType as TransactionOperationType,
  invoice: dto.invoice ? mapTransactionInvoice(dto.invoice) : null,
  currency: dto.currency ? mapCurrency(dto.currency) : null,
});

export const mapTransactionList = (dto: TransactionListResponseDto): TransactionList => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapTransaction),
});

export const mapTransactionDetails = (dto: TransactionDetailsDto): TransactionDetails => ({
  transaction: mapTransaction(dto.transaction),
  canClaim: dto.canClaim,
  isClaimed: dto.isClaimed,
  invoice: dto.invoice ? mapTransactionInvoice(dto.invoice) : null,
  currency: dto.currency ? mapCurrency(dto.currency) : null,
});

export const mapSignature = (dto: SignatureResponseDto): Signature => ({
  ...dto,
  signatures: dto.signatures.map(mapOperationSignature),
});

export const mapClaimItem = (dto: ClaimItemDto): ClaimItem => ({
  ...dto,
  currency: mapCurrency(dto.currency),
});

export const mapClaimsResponse = (dto: ClaimsResponseDto): ClaimsResponse => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapClaimItem),
});

export const mapOperationV2 = (dto: BlockchainOperationListResponseDto['items'][number]): OperationV2 => clone(dto);

export const mapOperationV2List = (dto: BlockchainOperationListResponseDto): OperationV2List => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapOperationV2),
});

export const mapBlockchainTransactionList = (dto: BlockchainTransactionListResponseDto): BlockchainTransactionList =>
  clone(dto);

export const mapBlockchainTransactionDetails = (
  dto: BlockchainTransactionDetailsResponseDto,
): BlockchainTransactionDetails => clone(dto);

export const mapCrossChainChain = (dto: CrossChainChainResponseDto): CrossChainChain => clone(dto);

export const mapCrossChainQuotes = (dto: CrossChainQuotesResponseDto): CrossChainQuotes => clone(dto);

export const mapCrossChainTransfer = (dto: CrossChainTransferResponseDto): CrossChainTransfer => ({
  ...dto,
  srcCurrency: mapCurrency(dto.srcCurrency),
  dstCurrency: mapCurrency(dto.dstCurrency),
});

export const mapStakingSummary = (dto: StakingSummaryResponse): StakingSummary => clone(dto);

export const mapStakingDelegations = (dto: StakingDelegationsResponse): StakingDelegations => clone(dto);

export const mapStakingDelegationSummary = (dto: DelegationSummaryResponse): StakingDelegationSummary => clone(dto);

export const mapStakingNetworkParams = (dto: StakingNetworkParamsResponse): StakingNetworkParams => clone(dto);

export const mapSuperRepresentatives = (dto: SuperRepresentativesResponse): SuperRepresentatives => clone(dto);

export const mapVotingSummary = (dto: VotingSummaryResponse): VotingSummary => clone(dto);

export const mapCallback = (dto: CallbackResponseDto): Callback => ({
  ...dto,
  type: dto.type as CallbackType,
  status: dto.status as CallbackStatus,
  operationType: dto.operationType as CallbackOperationType,
});

export const mapCallbackList = (dto: GetCallbacksResponseDto): CallbackList => ({
  total: dto.total,
  page: dto.page,
  pageSize: dto.pageSize,
  items: dto.items.map(mapCallback),
});
