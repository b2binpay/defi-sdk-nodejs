import type {
  BlockchainOperationListResponseDto,
  CrossChainTransferResponseDto,
  CurrencyResponseDto,
  InvoiceDetailsDto,
  StakingSummaryResponse,
} from '../../../generated-contracts';
import { mapCrossChainTransfer, mapInvoiceDetails, mapOperationV2List, mapStakingSummary } from './mappers';

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
