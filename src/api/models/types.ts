import type {
  AccountDeploymentDto,
  AccountResponseDto,
  AssetBalanceDto,
  AssetBalancesResponseDto,
  BalanceSummaryResponseDto,
  CallDto,
  ClaimItemDto,
  CurrencyResponseDto,
  DeploymentQueueResponseDto,
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

export enum FiatCurrency {
  Usd = 'usd',
  Eur = 'eur',
  Cny = 'cny',
}

export type User = UserResponseDto;
export type Account = AccountResponseDto;

export interface AccountDetails {
  account: Account;
  deployments: AccountDeployment[];
}

export enum AccountDeploymentStatus {
  NotDeployed = 'not_deployed',
  Pending = 'pending',
  Deployed = 'deployed',
}

export type AccountDeployment = Omit<AccountDeploymentDto, 'deploymentStatus'> & {
  deploymentStatus: AccountDeploymentStatus;
};

export type BalanceSummary = BalanceSummaryResponseDto;

export type Currency = CurrencyResponseDto;

export enum AssetSortField {
  Balance = 'balance',
  ConvertedBalance = 'converted_balance',
}

export enum AssetSortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export type AssetBalance = Omit<AssetBalanceDto, 'currency'> & {
  currency: Currency;
};

export type AssetBalanceList = Omit<AssetBalancesResponseDto, 'items'> & {
  items: AssetBalance[];
};

export enum InvoiceStatus {
  Created = 'CREATED',
  Paid = 'PAID',
  Unresolved = 'UNRESOLVED',
}

export type Invoice = Omit<InvoiceResponseDto, 'status' | 'availableCurrencies'> & {
  status: InvoiceStatus;
  availableCurrencies: Currency[];
};

export interface InvoiceDetails {
  invoice: Invoice;
}

export type InvoiceList = Omit<InvoicesResponseDto, 'items'> & {
  items: Invoice[];
};

export enum InvoiceSortField {
  Id = 'id',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export enum SortOrder {
  Asc = 'asc',
  Desc = 'desc',
}

export type Payout = Omit<PayoutResponseDto, 'status' | 'currency'> & {
  status: PayoutStatus;
  currency: Currency;
};

export type PayoutDetail = Omit<PayoutDetailResponseDto, 'status' | 'currency'> & {
  status: PayoutStatus;
  currency: Currency;
};

export type PayoutList = Omit<PayoutListResponseDto, 'items'> & {
  items: Payout[];
};

export enum PayoutStatus {
  Created = 'CREATED',
  Signed = 'SIGNED',
  Sent = 'SENT',
  Executed = 'EXECUTED',
  Failed = 'FAILED',
  Canceled = 'CANCELED',
}

export enum PayoutSortField {
  Id = 'id',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export type Call = CallDto;

export type OperationSignature = OperationSignatureDto;

export enum QueueOperationType {
  MultisigConfigChange = 'MULTISIG_CONFIG_CHANGE',
  Reject = 'REJECT',
  Payout = 'PAYOUT',
}

export enum QueueOperationStatus {
  Pending = 'PENDING',
  Ready = 'READY',
  Executing = 'EXECUTING',
  Executed = 'EXECUTED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export type QueueOperation = Omit<QueueOperationResponseDto, 'operationType' | 'status' | 'calls' | 'signatures'> & {
  operationType: QueueOperationType;
  status: QueueOperationStatus;
  calls: Call[];
  signatures: OperationSignature[];
};

export type DeploymentQueue = Omit<DeploymentQueueResponseDto, 'items'> & {
  items: QueueOperation[];
};

export interface ExecuteBatchOperationsResult {
  success: boolean;
}

export enum TransactionDirection {
  In = 'IN',
  Out = 'OUT',
}

export enum TransactionStatus {
  Pending = 'PENDING',
  Executed = 'EXECUTED',
  Confirmed = 'CONFIRMED',
  Failed = 'FAILED',
}

export enum TransactionOperationType {
  Invoice = 'invoice',
  DirectDeposit = 'direct_deposit',
  SetConfig = 'set_config',
  Claim = 'claim',
  Payout = 'payout',
  Reject = 'reject',
}

export enum TransactionSortField {
  Id = 'id',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export type TransactionInvoice = TransactionInvoiceResponseDto;

export type Transaction = Omit<
  TransactionResponseDto,
  'direction' | 'status' | 'operationType' | 'currency' | 'invoice'
> & {
  direction: TransactionDirection;
  status: TransactionStatus;
  operationType: TransactionOperationType;
  invoice: TransactionInvoice | null;
  currency: Currency | null;
};

export type TransactionList = Omit<TransactionListResponseDto, 'items'> & {
  items: Transaction[];
};

export type TransactionDetails = Omit<TransactionDetailsDto, 'transaction' | 'currency' | 'invoice'> & {
  transaction: Transaction;
  currency: Currency | null;
  invoice: TransactionInvoice | null;
};

export type Signature = Omit<SignatureResponseDto, 'signatures'> & {
  signatures: OperationSignature[];
};

export type ClaimItem = Omit<ClaimItemDto, 'currency'> & {
  currency: Currency;
};

export interface ClaimsResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ClaimItem[];
}

export enum ClaimsSortField {
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}
