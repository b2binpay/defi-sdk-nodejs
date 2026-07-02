import type {
  AccountDeploymentDto,
  AccountResponseDto,
  AssetBalanceDto,
  AssetBalancesResponseDto,
  BalanceSummaryResponseDto,
  BlockchainCancelUnstakingOperationResponseDto,
  BlockchainClaimOperationResponseDto,
  BlockchainClaimRewardsOperationResponseDto,
  BlockchainCrossChainTransferOperationResponseDto,
  BlockchainDappTransactionOperationResponseDto,
  BlockchainDelegateOperationResponseDto,
  BlockchainDeployOperationResponseDto,
  BlockchainDirectDepositOperationResponseDto,
  BlockchainInvoiceDepositOperationResponseDto,
  BlockchainOperationListResponseDto,
  BlockchainOperationResponseDto,
  BlockchainPayoutOperationResponseDto,
  BlockchainReclaimOperationResponseDto,
  BlockchainRejectOperationResponseDto,
  BlockchainSetMultisigConfigOperationResponseDto,
  BlockchainStakeOperationResponseDto,
  BlockchainStakingWithdrawOperationResponseDto,
  BlockchainTransactionDetailsResponseDto,
  BlockchainTransactionListResponseDto,
  BlockchainUnstakeOperationResponseDto,
  BlockchainVoteOperationResponseDto,
  CallbackResponseDto,
  CallDto,
  ClaimItemDto,
  CrossChainChainResponseDto,
  CrossChainQuotesResponseDto,
  CrossChainTransferResponseDto,
  CurrencyResponseDto,
  DelegationSummaryResponse,
  DeploymentParamsResponseDto,
  DeploymentQueueResponseDto,
  GetCallbacksResponseDto,
  InvoiceResponseDto,
  InvoicesResponseDto,
  NetworkResponseDto,
  NonceInfoResponseDto,
  OperationSignatureDto,
  PayoutDetailResponseDto,
  PayoutListResponseDto,
  PayoutResponseDto,
  QueueOperationResponseDto,
  ResendCallbacksResponseDto,
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

export enum FiatCurrency {
  Usd = 'usd',
  Eur = 'eur',
  Cny = 'cny',
}

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
  DappTransaction = 'DAPP_TRANSACTION',
}

export enum QueueOperationStatus {
  Pending = 'PENDING',
  Ready = 'READY',
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

/** @deprecated Use `operationType` to determine transaction direction instead. */
export enum TransactionDirection {
  In = 'IN',
  Out = 'OUT',
}

/** @deprecated v1 transactions are superseded by operations (`OperationV2Status`) and blockchain transactions (`BlockchainTransactionStatus`). */
export enum TransactionStatus {
  Pending = 'PENDING',
  Executed = 'EXECUTED',
  Confirmed = 'CONFIRMED',
  Failed = 'FAILED',
}

/** @deprecated v1 transactions are superseded by operations history v2 — use `OperationTypeV2`. */
export enum TransactionOperationType {
  Invoice = 'invoice',
  DirectDeposit = 'direct_deposit',
  SetConfig = 'set_config',
  Claim = 'claim',
  Payout = 'payout',
  Reject = 'reject',
}

/** @deprecated v1 transactions are superseded by operations history v2 — use `OperationV2SortField`. */
export enum TransactionSortField {
  Id = 'id',
  ChainId = 'chainId',
  OperationType = 'operationType',
  CurrencyId = 'currencyId',
  Amount = 'amount',
  BlockchainFee = 'blockchainFee',
  Status = 'status',
  BlockNumber = 'blockNumber',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

/** @deprecated v1 transactions are superseded by operations history v2 / blockchain transactions. */
export type TransactionInvoice = TransactionListResponseDtoItemsInnerInvoice;

/** @deprecated Use the operations history v2 (`OperationV2`, `getOperationsV2`) or blockchain transactions (`BlockchainTransaction`, `getBlockchainTransactions`) instead. */
export type Transaction = Omit<
  TransactionListResponseDtoItemsInner,
  'direction' | 'status' | 'operationType' | 'currency' | 'invoice'
> & {
  /** @deprecated Use `operationType` to determine transaction direction instead. */
  direction: TransactionDirection;
  status: TransactionStatus;
  operationType: TransactionOperationType;
  invoice: TransactionInvoice | null;
  currency: Currency | null;
};

/** @deprecated Use `OperationV2List` (`getOperationsV2`) or `BlockchainTransactionList` (`getBlockchainTransactions`) instead. */
export type TransactionList = Omit<TransactionListResponseDto, 'items'> & {
  items: Transaction[];
};

/** @deprecated Use `getOperationDetailsV2` or `getBlockchainTransaction` instead. */
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

export enum CallbackType {
  InvoiceCreated = 'INVOICE_CREATED',
  InvoiceDepositReceived = 'INVOICE_DEPOSIT_RECEIVED',
  InvoiceDepositConfirmed = 'INVOICE_DEPOSIT_CONFIRMED',
  InvoicePaid = 'INVOICE_PAID',
  InvoiceUnresolved = 'INVOICE_UNRESOLVED',
  InvoiceClaimed = 'INVOICE_CLAIMED',
  PayoutCreated = 'PAYOUT_CREATED',
  PayoutSent = 'PAYOUT_SENT',
  PayoutExecuted = 'PAYOUT_EXECUTED',
  PayoutConfirmed = 'PAYOUT_CONFIRMED',
  PayoutFailed = 'PAYOUT_FAILED',
  PayoutCancelled = 'PAYOUT_CANCELLED',
}

export enum CallbackStatus {
  Created = 'CREATED',
  Retry = 'RETRY',
  Sent = 'SENT',
  Failed = 'FAILED',
}

export enum CallbackOperationType {
  Invoice = 'invoice',
  Payout = 'payout',
}

export type Callback = Omit<CallbackResponseDto, 'type' | 'status' | 'operationType'> & {
  type: CallbackType;
  status: CallbackStatus;
  operationType: CallbackOperationType;
};

export type CallbackList = Omit<GetCallbacksResponseDto, 'items'> & {
  items: Callback[];
};

export type ResendCallbacksResult = ResendCallbacksResponseDto;

export type Network = NetworkResponseDto;

export type NonceInfo = NonceInfoResponseDto;

export type DeploymentParams = DeploymentParamsResponseDto;

export enum StakingResourceType {
  Bandwidth = 'BANDWIDTH',
  Energy = 'ENERGY',
}

export enum OperationTypeV2 {
  Payout = 'PAYOUT',
  InvoiceDeposit = 'INVOICE_DEPOSIT',
  Claim = 'CLAIM',
  Deploy = 'DEPLOY',
  DirectDeposit = 'DIRECT_DEPOSIT',
  Reject = 'REJECT',
  SetConfig = 'SET_CONFIG',
  DappTransaction = 'DAPP_TRANSACTION',
  CrossChainTransfer = 'CROSS_CHAIN_TRANSFER',
  Stake = 'STAKE',
  Unstake = 'UNSTAKE',
  CancelUnstaking = 'CANCEL_UNSTAKING',
  StakingWithdraw = 'STAKING_WITHDRAW',
  Vote = 'VOTE',
  ClaimRewards = 'CLAIM_REWARDS',
  Delegate = 'DELEGATE',
  Reclaim = 'RECLAIM',
}

export type OperationV2 = BlockchainOperationResponseDto;

export type OperationV2List = Omit<BlockchainOperationListResponseDto, 'items'> & {
  items: OperationV2[];
};

export type OperationV2Details =
  | BlockchainPayoutOperationResponseDto
  | BlockchainInvoiceDepositOperationResponseDto
  | BlockchainClaimOperationResponseDto
  | BlockchainDeployOperationResponseDto
  | BlockchainDirectDepositOperationResponseDto
  | BlockchainRejectOperationResponseDto
  | BlockchainSetMultisigConfigOperationResponseDto
  | BlockchainDappTransactionOperationResponseDto
  | BlockchainCrossChainTransferOperationResponseDto
  | BlockchainStakeOperationResponseDto
  | BlockchainUnstakeOperationResponseDto
  | BlockchainCancelUnstakingOperationResponseDto
  | BlockchainStakingWithdrawOperationResponseDto
  | BlockchainVoteOperationResponseDto
  | BlockchainClaimRewardsOperationResponseDto
  | BlockchainDelegateOperationResponseDto
  | BlockchainReclaimOperationResponseDto;

export enum OperationV2Status {
  Created = 'CREATED',
  Pending = 'PENDING',
  Confirmed = 'CONFIRMED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export enum OperationV2SortField {
  Id = 'id',
  ChainId = 'chainId',
  OperationType = 'operationType',
  CurrencyId = 'currencyId',
  Amount = 'amount',
  BlockchainFee = 'blockchainFee',
  Status = 'status',
  BlockNumber = 'blockNumber',
  CreatedAt = 'createdAt',
  UpdatedAt = 'updatedAt',
}

export enum BlockchainTransactionStatus {
  Executing = 'executing',
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
}

export enum BlockchainTransactionSortField {
  Id = 'id',
  CreatedAt = 'createdAt',
  BlockNumber = 'blockNumber',
}

export type BlockchainTransaction = BlockchainTransactionListResponseDto['items'][number];

export type BlockchainTransactionList = BlockchainTransactionListResponseDto;

export type BlockchainTransactionDetails = BlockchainTransactionDetailsResponseDto;

export type CrossChainChain = CrossChainChainResponseDto;

export type CrossChainQuotes = CrossChainQuotesResponseDto;

export type CrossChainTransfer = Omit<CrossChainTransferResponseDto, 'srcCurrency' | 'dstCurrency'> & {
  srcCurrency: Currency;
  dstCurrency: Currency;
};

export type StakingSummary = StakingSummaryResponse;

export type StakingDelegations = StakingDelegationsResponse;

export type StakingDelegationSummary = DelegationSummaryResponse;

export type StakingNetworkParams = StakingNetworkParamsResponse;

export type SuperRepresentatives = SuperRepresentativesResponse;

export type VotingSummary = VotingSummaryResponse;
