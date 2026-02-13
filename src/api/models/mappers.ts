import type {
  AccountDeploymentDto,
  AccountDetailsDto,
  AccountResponseDto,
  AssetBalanceDto,
  AssetBalancesResponseDto,
  BalanceSummaryResponseDto,
  CallDto,
  ClaimItemDto,
  ClaimsResponseDto,
  CurrencyResponseDto,
  DeploymentQueueResponseDto,
  InvoiceDetailsDto,
  InvoiceResponseDto,
  InvoicesResponseDto,
  OperationSignatureDto,
  PayoutDetailResponseDto,
  PayoutListResponseDto,
  PayoutResponseDto,
  QueueOperationResponseDto,
  SignatureResponseDto,
  TransactionDetailsDto,
  TransactionInvoiceResponseDto,
  TransactionListResponseDto,
  TransactionResponseDto,
  UserResponseDto,
} from '../../../generated-contracts';
import type {
  Account,
  AccountDeployment,
  AccountDeploymentStatus,
  AccountDetails,
  AssetBalance,
  AssetBalanceList,
  BalanceSummary,
  Call,
  ClaimItem,
  ClaimsResponse,
  Currency,
  DeploymentQueue,
  ExecuteBatchOperationsResult,
  Invoice,
  InvoiceDetails,
  InvoiceList,
  InvoiceStatus,
  OperationSignature,
  Payout,
  PayoutDetail,
  PayoutList,
  PayoutStatus,
  QueueOperation,
  QueueOperationStatus,
  QueueOperationType,
  Signature,
  Transaction,
  TransactionDetails,
  TransactionDirection,
  TransactionInvoice,
  TransactionList,
  TransactionOperationType,
  TransactionStatus,
  User,
} from './types';

const clone = <T>(value: T): T => ({ ...value });

export const mapUser = (dto: UserResponseDto): User => clone(dto);

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

const mapTransactionInvoice = (dto: TransactionInvoiceResponseDto): TransactionInvoice => clone(dto);

export const mapTransaction = (dto: TransactionResponseDto): Transaction => ({
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
