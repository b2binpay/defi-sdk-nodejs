import { createHmac } from 'node:crypto';
import { CallbackPayloadError, CallbackSignatureError } from '../errors';
import { CallbackGroup, isSettingsCallbackEvent } from './callback-event';
import { parseCallback, verifyCallbackSignature } from './callback-signature';

const SECRET = 'whsec_test';

const LEGACY_BODY = JSON.stringify({
  id: 'cb-1',
  type: 'INVOICE_PAID',
  operation_id: 'inv-1',
  operation_type: 'invoice',
  timestamp: '2026-10-15T10:00:00.000Z',
  data: { invoice: { id: 'inv-1' } },
});

const SETTINGS_BODY = JSON.stringify({
  id: 'cb-2',
  group: 'QUEUE',
  entity: 'PAYOUT',
  event: 'READY',
  chainId: '11155111',
  timestamp: '2026-10-15T10:00:00.000Z',
  data: { operation: { id: 'op-1' } },
});

const sign = (body: string, secret = SECRET): string => createHmac('sha256', secret).update(body).digest('hex');

describe('verifyCallbackSignature', () => {
  it('accepts the HMAC of the raw body as a string or as bytes', () => {
    const signature = sign(LEGACY_BODY);
    expect(verifyCallbackSignature({ rawBody: LEGACY_BODY, signature, secret: SECRET })).toBe(true);
    expect(verifyCallbackSignature({ rawBody: Buffer.from(LEGACY_BODY), signature, secret: SECRET })).toBe(true);
  });

  it('accepts an upper-case hex signature and a single-element header array', () => {
    const signature = sign(LEGACY_BODY);
    expect(verifyCallbackSignature({ rawBody: LEGACY_BODY, signature: signature.toUpperCase(), secret: SECRET })).toBe(
      true,
    );
    expect(verifyCallbackSignature({ rawBody: LEGACY_BODY, signature: [signature], secret: SECRET })).toBe(true);
  });

  it('rejects a body that was re-serialized after signing', () => {
    const signature = sign(LEGACY_BODY);
    const reserialized = JSON.stringify(JSON.parse(LEGACY_BODY), null, 2);
    expect(verifyCallbackSignature({ rawBody: reserialized, signature, secret: SECRET })).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    const signature = sign(LEGACY_BODY, 'other');
    expect(verifyCallbackSignature({ rawBody: LEGACY_BODY, signature, secret: SECRET })).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not hex', 'z'.repeat(64)],
    ['truncated', 'ab'.repeat(16)],
    ['repeated header', ['a'.repeat(64), 'b'.repeat(64)]],
  ])('rejects a %s header without throwing', (_label, signature) => {
    expect(verifyCallbackSignature({ rawBody: LEGACY_BODY, signature, secret: SECRET })).toBe(false);
  });
});

describe('parseCallback', () => {
  it('returns a legacy event', () => {
    const event = parseCallback({ rawBody: LEGACY_BODY, signature: sign(LEGACY_BODY), secret: SECRET });
    expect(isSettingsCallbackEvent(event)).toBe(false);
    expect(event).toMatchObject({ id: 'cb-1', type: 'INVOICE_PAID' });
  });

  it('returns a settings event narrowed by isSettingsCallbackEvent', () => {
    const event = parseCallback({ rawBody: SETTINGS_BODY, signature: sign(SETTINGS_BODY), secret: SECRET });
    if (!isSettingsCallbackEvent(event)) {
      throw new Error('expected a settings event');
    }
    expect(event.group).toBe(CallbackGroup.Queue);
    expect(event.chainId).toBe('11155111');
  });

  it('throws CallbackSignatureError before parsing when the signature is wrong', () => {
    expect(() => parseCallback({ rawBody: '{not json', signature: 'a'.repeat(64), secret: SECRET })).toThrow(
      CallbackSignatureError,
    );
  });

  it('rejects a settings event without chainId instead of narrowing it', () => {
    const { chainId: _omitted, ...withoutChainId } = JSON.parse(SETTINGS_BODY);
    const body = JSON.stringify(withoutChainId);
    expect(() => parseCallback({ rawBody: body, signature: sign(body), secret: SECRET })).toThrow(CallbackPayloadError);
  });

  it('throws CallbackPayloadError, not CallbackSignatureError, for a signed body it does not recognise', () => {
    const body = JSON.stringify({ hello: 'world' });
    const error = (() => {
      try {
        parseCallback({ rawBody: body, signature: sign(body), secret: SECRET });
      } catch (err) {
        return err;
      }
    })();

    expect(error).toBeInstanceOf(CallbackPayloadError);
    expect(error).not.toBeInstanceOf(CallbackSignatureError);
    expect(error).toMatchObject({ body: { hello: 'world' } });
  });

  it('throws CallbackPayloadError carrying the raw text for a signed body that is not JSON', () => {
    const body = 'not json';
    expect(() => parseCallback({ rawBody: body, signature: sign(body), secret: SECRET })).toThrow(
      expect.objectContaining({ constructor: CallbackPayloadError, body: 'not json' }),
    );
  });
});
