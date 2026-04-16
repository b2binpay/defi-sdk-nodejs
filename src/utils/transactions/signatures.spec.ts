import type { Address, Hex } from 'viem';
import { hexToBytes } from 'viem';
import { packSignatures, type SignatureEntry } from './signatures';

// Test fixtures: deterministic addresses and 65-byte ECDSA signatures
const SIGNER_A: Address = '0x1111111111111111111111111111111111111111';
const SIGNER_B: Address = '0x2222222222222222222222222222222222222222';
const SIGNER_C: Address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const SIG_A: Hex = `0x${'aa'.repeat(65)}` as Hex;
const SIG_B: Hex = `0x${'bb'.repeat(65)}` as Hex;
const SIG_C: Hex = `0x${'cc'.repeat(65)}` as Hex;

function entry(user: Address, sign: Hex): SignatureEntry {
  return { user, sign };
}

describe('packSignatures', () => {
  describe('v1.0.0 — simple concatenation', () => {
    it('concatenates single signature', () => {
      const result = packSignatures([entry(SIGNER_A, SIG_A)], '1.0.0');
      expect(result).toBe(SIG_A);
    });

    it('concatenates multiple signatures in order', () => {
      const result = packSignatures([entry(SIGNER_A, SIG_A), entry(SIGNER_B, SIG_B)], '1.0.0');
      expect(result).toBe(`0x${'aa'.repeat(65)}${'bb'.repeat(65)}`);
    });

    it('does not sort by address', () => {
      const result = packSignatures([entry(SIGNER_B, SIG_B), entry(SIGNER_A, SIG_A)], '1.0.0');
      // B first, then A — preserves input order
      expect(result).toBe(`0x${'bb'.repeat(65)}${'aa'.repeat(65)}`);
    });
  });

  describe('v1.1.0 — packed binary format', () => {
    it('packs single signature correctly', () => {
      const result = packSignatures([entry(SIGNER_A, SIG_A)], '1.1.0');
      const bytes = hexToBytes(result);

      // 20 (address) + 2 (uint16 len) + 65 (sig) = 87
      expect(bytes.length).toBe(87);

      // address
      expect(bytes.slice(0, 20)).toEqual(hexToBytes(SIGNER_A));

      // uint16 BE length = 65 = 0x0041
      expect(bytes[20]).toBe(0x00);
      expect(bytes[21]).toBe(0x41);

      // signature
      expect(bytes.slice(22, 87)).toEqual(hexToBytes(SIG_A));
    });

    it('sorts by signer address ascending', () => {
      // Pass in reverse order: C, B, A
      const result = packSignatures([entry(SIGNER_C, SIG_C), entry(SIGNER_A, SIG_A), entry(SIGNER_B, SIG_B)], '1.1.0');
      const bytes = hexToBytes(result);

      // 3 entries * 87 bytes each
      expect(bytes.length).toBe(87 * 3);

      // First entry should be SIGNER_A (lowest address)
      expect(bytes.slice(0, 20)).toEqual(hexToBytes(SIGNER_A));
      // Second should be SIGNER_B
      expect(bytes.slice(87, 87 + 20)).toEqual(hexToBytes(SIGNER_B));
      // Third should be SIGNER_C
      expect(bytes.slice(87 * 2, 87 * 2 + 20)).toEqual(hexToBytes(SIGNER_C));
    });

    it('encodes uint16 big-endian length correctly for longer signatures', () => {
      // 256-byte signature to test BE encoding
      const longSig: Hex = `0x${'ff'.repeat(256)}` as Hex;
      const result = packSignatures([entry(SIGNER_A, longSig)], '1.1.0');
      const bytes = hexToBytes(result);

      // 20 + 2 + 256 = 278
      expect(bytes.length).toBe(278);

      // 256 = 0x0100 in big-endian
      expect(bytes[20]).toBe(0x01);
      expect(bytes[21]).toBe(0x00);
    });

    it('throws on duplicate signer addresses', () => {
      expect(() => packSignatures([entry(SIGNER_A, SIG_A), entry(SIGNER_A, SIG_B)], '1.1.0')).toThrow(
        'Duplicate signer addresses detected',
      );
    });

    it('throws on duplicate addresses with different casing', () => {
      const signerUpper = SIGNER_A.toUpperCase().replace('0X', '0x') as Address;
      expect(() => packSignatures([entry(SIGNER_A, SIG_A), entry(signerUpper, SIG_B)], '1.1.0')).toThrow(
        'Duplicate signer addresses detected',
      );
    });
  });

  describe('version selection', () => {
    it('uses v1.0.0 packing for version "1.0.0"', () => {
      const result = packSignatures([entry(SIGNER_B, SIG_B), entry(SIGNER_A, SIG_A)], '1.0.0');
      // v1.0.0 does simple concat without sorting — B then A
      expect(result).toBe(`0x${'bb'.repeat(65)}${'aa'.repeat(65)}`);
    });

    it('uses v1.1.0 packing for version "1.1.0"', () => {
      const result = packSignatures([entry(SIGNER_A, SIG_A)], '1.1.0');
      const bytes = hexToBytes(result);
      // v1.1.0 includes address + length prefix = 87 bytes, not 65
      expect(bytes.length).toBe(87);
    });

    it('falls back to v1.1.0 for unknown versions with console warning', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = packSignatures([entry(SIGNER_A, SIG_A)], '2.0.0');
      const bytes = hexToBytes(result);

      // Should use v1.1.0 format
      expect(bytes.length).toBe(87);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown contract version "2.0.0"'));

      warnSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles empty signatures array for v1.0.0', () => {
      const result = packSignatures([], '1.0.0');
      expect(result).toBe('0x');
    });

    it('handles empty signatures array for v1.1.0', () => {
      const result = packSignatures([], '1.1.0');
      expect(result).toBe('0x');
    });
  });
});
