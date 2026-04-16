import { NetworkType } from './tron-validation';
import { validateAddress } from './validation';

describe('validateAddress — extended with Tron support', () => {
  describe('EVM backward compatibility', () => {
    it('validates a valid EVM address without networkType', () => {
      const result = validateAddress({ address: '0x1111111111111111111111111111111111111111' });
      expect(result.isValid).toBe(true);
      expect(result.normalizedAddress).toBeDefined();
      expect(result.errors).toEqual([]);
    });

    it('rejects an invalid EVM address without networkType', () => {
      const result = validateAddress({ address: '0xinvalid' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects empty address', () => {
      const result = validateAddress({ address: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is required.');
    });
  });

  describe('auto-detection', () => {
    it('auto-detects Tron address (T prefix, 34 chars)', () => {
      const result = validateAddress({ address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' });
      expect(result.isValid).toBe(true);
      expect(result.normalizedAddress).toBe('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');
    });

    it('auto-detects EVM address (0x prefix)', () => {
      const result = validateAddress({ address: '0x1111111111111111111111111111111111111111' });
      expect(result.isValid).toBe(true);
    });
  });

  describe('network type cross-validation', () => {
    it('rejects Tron address on EVM network', () => {
      const result = validateAddress({
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        networkType: NetworkType.EVM,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('mismatch');
    });

    it('rejects EVM address on Tron network', () => {
      const result = validateAddress({
        address: '0x1111111111111111111111111111111111111111',
        networkType: NetworkType.TVM,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('mismatch');
    });

    it('accepts Tron address on TVM network', () => {
      const result = validateAddress({
        address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
        networkType: NetworkType.TVM,
      });
      expect(result.isValid).toBe(true);
    });

    it('accepts EVM address on EVM network', () => {
      const result = validateAddress({
        address: '0x1111111111111111111111111111111111111111',
        networkType: NetworkType.EVM,
      });
      expect(result.isValid).toBe(true);
    });
  });
});
