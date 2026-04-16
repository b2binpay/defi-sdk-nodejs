import { validateTronAddress } from './tron-validation';

// Known valid Tron mainnet address (USDT contract)
const VALID_ADDRESS = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
// Another valid address
const VALID_ADDRESS_2 = 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL';

describe('validateTronAddress', () => {
  describe('valid addresses', () => {
    it('validates a correct Tron mainnet address', () => {
      const result = validateTronAddress({ address: VALID_ADDRESS });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedAddress).toBe(VALID_ADDRESS);
    });

    it('validates another correct Tron address', () => {
      const result = validateTronAddress({ address: VALID_ADDRESS_2 });
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedAddress).toBe(VALID_ADDRESS_2);
    });

    it('returns branded TronAddress type', () => {
      const result = validateTronAddress({ address: VALID_ADDRESS });
      expect(typeof result.normalizedAddress).toBe('string');
      expect(result.normalizedAddress).toBeDefined();
    });
  });

  describe('invalid addresses', () => {
    it('rejects address with wrong prefix (not T)', () => {
      const result = validateTronAddress({ address: 'AR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects address with incorrect length (too short)', () => {
      const result = validateTronAddress({ address: 'TR7NHqjeKQx' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects address with incorrect length (too long)', () => {
      const result = validateTronAddress({ address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tXXX' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects address with bad checksum', () => {
      // Modify last character to break checksum
      const badChecksum = `${VALID_ADDRESS.slice(0, -1)}z`;
      const result = validateTronAddress({ address: badChecksum });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects empty string', () => {
      const result = validateTronAddress({ address: '' });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is required.');
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects an EVM address', () => {
      const result = validateTronAddress({ address: '0x1111111111111111111111111111111111111111' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });

    it('rejects hex-format Tron address (41-prefixed)', () => {
      const result = validateTronAddress({ address: '418840E6C55B9ADA326D211D818C34A994AECED808' });
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.normalizedAddress).toBeUndefined();
    });
  });

  describe('error messages', () => {
    it('provides descriptive error for invalid format', () => {
      const result = validateTronAddress({ address: 'invalid' });
      expect(result.errors[0]).toContain('Tron');
      expect(result.errors[0]).toContain('Base58Check');
    });
  });
});
