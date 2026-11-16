import type {
  BatchCandidatesResponseDtoCandidatesInnerOperationsInner,
  BlockchainOperationListResponseDto,
  ClaimBatchesResponseDto,
  CrossChainTransferResponseDto,
  CurrencyResponseDto,
  InvoiceDetailsDto,
  QueueOperationResponseDto,
  SignatureResponseDto,
  StakingSummaryResponse,
} from '../../../generated-contracts';
import {
  mapBatchCandidateOperation,
  mapClaimBatches,
  mapCrossChainTransfer,
  mapInvoiceDetails,
  mapOperationV2List,
  mapQueueOperation,
  mapSignature,
  mapStakingSummary,
} from './mappers';

const currency = (id: string, symbol: string): CurrencyResponseDto =>
  ({ id, symbol }) as unknown as CurrencyResponseDto;

describe('cross-chain / staking / operations-v2 mappers', () => {
  describe('mapCrossChainTransfer', () => {
    it('maps nested src/dst currencies and preserves transfer fields', () => {
      const dto = {
        id: 'transfer-1',
        status: 'CREATED',
        queueOperationId: 'op-1',
        nonce: '7',
        srcAmount: '100',
        dstAmount: '99',
        srcCurrency: currency('cur-src', 'USDT'),
        dstCurrency: currency('cur-dst', 'USDC'),
      } as unknown as CrossChainTransferResponseDto;

      const result = mapCrossChainTransfer(dto);

      expect(result.queueOperationId).toBe('op-1');
      expect(result.nonce).toBe('7');
      expect(result.srcCurrency.symbol).toBe('USDT');
      expect(result.dstCurrency.symbol).toBe('USDC');
      // Nested currencies are cloned, not the same reference.
      expect(result.srcCurrency).not.toBe(dto.srcCurrency);
    });
  });

  describe('mapOperationV2List', () => {
    it('maps pagination fields and clones items', () => {
      const item = { id: 'op-1', operationType: 'PAYOUT', status: 'CONFIRMED' };
      const dto = {
        total: 1,
        page: 1,
        pageSize: 10,
        items: [item],
      } as unknown as BlockchainOperationListResponseDto;

      const result = mapOperationV2List(dto);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('op-1');
      expect(result.items[0]).not.toBe(item);
    });
  });

  describe('mapInvoiceDetails', () => {
    it('carries blockedAmounts through to the mapped invoice', () => {
      const dto = {
        invoice: {
          id: 'inv-1',
          status: 'UNRESOLVED',
          availableCurrencies: [currency('cur-1', 'USDT')],
          blockedAmounts: [{ currencyId: 'cur-1', amount: '25' }],
        },
      } as unknown as InvoiceDetailsDto;

      const result = mapInvoiceDetails(dto);

      expect(result.invoice.blockedAmounts).toEqual([{ currencyId: 'cur-1', amount: '25' }]);
      expect(result.invoice.availableCurrencies[0].symbol).toBe('USDT');
    });
  });

  describe('mapStakingSummary', () => {
    it('returns a distinct clone of the summary', () => {
      const dto = { totalStaked: '1000' } as unknown as StakingSummaryResponse;

      const result = mapStakingSummary(dto);

      expect(result).toEqual(dto);
      expect(result).not.toBe(dto);
    });
  });
});

describe('queue mappers', () => {
  const BLOB = `0x${'aa'.repeat(65)}`;
  const SIGNERS = [
    { address: '0x1111111111111111111111111111111111111111', isSigned: true, signedAt: '2026-10-01T00:00:00.000Z' },
    { address: '0x3333333333333333333333333333333333333333', isSigned: false, signedAt: null },
  ];

  const queueDto = {
    id: 'op-1',
    operationType: 'CLAIM',
    status: 'PENDING',
    nonce: '1',
    calls: [{ to: '0x2222222222222222222222222222222222222222', value: '0', data: '0x' }],
    signatureBlob: BLOB,
    signers: SIGNERS,
  } as unknown as QueueOperationResponseDto;

  it('carries signers and the signature blob of a queue operation', () => {
    const result = mapQueueOperation(queueDto);

    expect(result.signers).toEqual(SIGNERS);
    expect(result.signers[0]).not.toBe(SIGNERS[0]);
    expect(result.signatureBlob).toBe(BLOB);
  });

  it('carries signers of a batch candidate operation', () => {
    const result = mapBatchCandidateOperation(
      queueDto as unknown as BatchCandidatesResponseDtoCandidatesInnerOperationsInner,
    );

    expect(result.signers).toEqual(SIGNERS);
  });

  it('carries signers and the signature blob of a submit-signature response', () => {
    const result = mapSignature({
      id: 'op-1',
      signers: SIGNERS,
      signatureBlob: null,
    } as unknown as SignatureResponseDto);

    expect(result.signers).toEqual(SIGNERS);
    expect(result.signatureBlob).toBeNull();
  });
});

describe('mapClaimBatches', () => {
  it('maps every nested currency of a batch', () => {
    const dto = {
      items: [
        {
          currency: currency('cur-usdt', 'USDT'),
          totalAmount: '150',
          invoiceCount: 2,
          riskyNativeInvoiceCount: 1,
          canBatch: true,
          sweptNativeTotals: [{ currency: currency('cur-eth', 'ETH'), amount: '0.1' }],
          companionCurrencies: [currency('cur-usdc', 'USDC')],
          invoices: [
            {
              invoiceId: 'inv-1',
              amount: '100',
              isBatchable: true,
              hasRiskyNativeDeposit: false,
              companions: [{ currency: currency('cur-eth', 'ETH'), amount: '0.1', isSwept: true }],
            },
          ],
        },
      ],
    } as unknown as ClaimBatchesResponseDto;

    const [batch] = mapClaimBatches(dto).items;

    expect(batch.currency.symbol).toBe('USDT');
    expect(batch.currency).not.toBe(dto.items[0].currency);
    expect(batch.sweptNativeTotals[0].currency.symbol).toBe('ETH');
    expect(batch.companionCurrencies[0].symbol).toBe('USDC');
    expect(batch.invoices[0].companions[0].isSwept).toBe(true);
    expect(batch.invoices[0].companions[0].currency).not.toBe(dto.items[0].invoices[0].companions[0].currency);
  });
});
