import type { Hex } from 'viem';
import type { TronAddress } from '../tron-validation';
import {
  buildTronExecuteTypedData,
  packTronSignatures,
  TRON_EXECUTE_TIP712_TYPES,
  type TronExecuteTypedDataPayload,
} from './tron-tip712';

const CONTRACT: TronAddress = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' as TronAddress;
const RECIPIENT: TronAddress = 'TNPeeaaFB7K9cmo4uQpcU32zGK8G1NYqeL' as TronAddress;

const SIGNER_A: TronAddress = 'TJCnKsPa7y5okkXvQAidZBzqx3QyQ6sxMW' as TronAddress;
const SIGNER_B: TronAddress = 'TVjsyZ7fYF3qLF6BQgPmTEZy1xrNNyVAAA' as TronAddress;

const SIG_A = `0x${'aa'.repeat(65)}` as Hex;
const SIG_B = `0x${'bb'.repeat(65)}` as Hex;

describe('TRON_EXECUTE_TIP712_TYPES', () => {
  it('has Execute and Call types matching EIP-712 structure', () => {
    expect(TRON_EXECUTE_TIP712_TYPES.Execute).toEqual([
      { name: 'calls', type: 'Call[]' },
      { name: 'nonce', type: 'uint256' },
    ]);
    expect(TRON_EXECUTE_TIP712_TYPES.Call).toEqual([
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ]);
  });
});

describe('buildTronExecuteTypedData', () => {
  const domain: TronExecuteTypedDataPayload['domain'] = {
    name: 'MultiSigWallet',
    version: '1.0.0',
    chainId: 728126428n,
    verifyingContract: CONTRACT,
  };

  it('builds correct TIP-712 payload structure', () => {
    const result = buildTronExecuteTypedData({
      domain,
      calls: [{ to: RECIPIENT, value: 1000n, data: '0x' }],
      nonce: 1n,
    });

    expect(result.primaryType).toBe('Execute');
    expect(result.types).toBe(TRON_EXECUTE_TIP712_TYPES);
    expect(result.domain).toBe(domain);
    expect(result.message.nonce).toBe(1n);
    expect(result.message.calls).toHaveLength(1);
    expect(result.message.calls[0].to).toBe(RECIPIENT);
    expect(result.message.calls[0].value).toBe(1000n);
    expect(result.message.calls[0].data).toBe('0x');
  });

  it('handles multiple calls', () => {
    const result = buildTronExecuteTypedData({
      domain,
      calls: [
        { to: RECIPIENT, value: 100n, data: '0xabcd' },
        { to: CONTRACT, value: 0n, data: '0x1234' },
      ],
      nonce: 5n,
    });

    expect(result.message.calls).toHaveLength(2);
    expect(result.message.nonce).toBe(5n);
  });
});

describe('packTronSignatures', () => {
  describe('v1.0.0 — simple concatenation', () => {
    it('concatenates single signature', () => {
      const result = packTronSignatures([{ signer: SIGNER_A, signature: SIG_A }], '1.0.0');
      expect(result).toBe(SIG_A);
    });

    it('concatenates multiple signatures in order', () => {
      const result = packTronSignatures(
        [
          { signer: SIGNER_A, signature: SIG_A },
          { signer: SIGNER_B, signature: SIG_B },
        ],
        '1.0.0',
      );
      expect(result).toBe(`0x${'aa'.repeat(65)}${'bb'.repeat(65)}`);
    });
  });

  describe('v1.1.0 — packed binary format', () => {
    it('packs single signature with signer address', () => {
      const result = packTronSignatures([{ signer: SIGNER_A, signature: SIG_A }], '1.1.0');
      // Should be hex string with 20 (address) + 2 (len) + 65 (sig) = 87 bytes
      // 0x prefix + 87*2 hex chars = 176 chars
      expect(result.startsWith('0x')).toBe(true);
      expect((result.length - 2) / 2).toBe(87);
    });

    it('sorts by signer address ascending', () => {
      const result = packTronSignatures(
        [
          { signer: SIGNER_B, signature: SIG_B },
          { signer: SIGNER_A, signature: SIG_A },
        ],
        '1.1.0',
      );
      // 2 entries * 87 bytes
      expect((result.length - 2) / 2).toBe(87 * 2);
    });

    it('handles empty signatures array', () => {
      const result = packTronSignatures([], '1.1.0');
      expect(result).toBe('0x');
    });
  });
});
