import { createHmac, timingSafeEqual } from 'node:crypto';
import { CallbackPayloadError, CallbackSignatureError } from '../errors';
import { type CallbackEvent, isCallbackEvent } from './callback-event';

/** Header carrying the hex HMAC-SHA256 of the raw body; Node lower-cases incoming header names. */
export const CALLBACK_SIGNATURE_HEADER = 'x-callback-signature';

/** Set instead of a signature only for a legacy account that never generated a callback secret. */
export const CALLBACK_NO_SIGNATURE_HEADER = 'x-callback-no-signature';

const HEX_SIGNATURE = /^[0-9a-f]{64}$/i;

export interface VerifyCallbackSignatureParams {
  /** The request body exactly as received — the bytes are signed, so a re-serialized object will not match. */
  rawBody: string | Uint8Array;
  /** The `X-CALLBACK-SIGNATURE` header value; frameworks may hand it over as an array or not at all. */
  signature: string | readonly string[] | null | undefined;
  /** The callback secret of the matching callback setting (or the account secret for legacy callbacks). */
  secret: string;
}

function singleHeader(value: VerifyCallbackSignatureParams['signature']): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value?.length === 1 ? value[0] : undefined;
}

/** Constant-time check that `signature` is the HMAC-SHA256 of `rawBody` under `secret`. */
export function verifyCallbackSignature(params: VerifyCallbackSignatureParams): boolean {
  const received = singleHeader(params.signature)?.trim();
  if (!received || !HEX_SIGNATURE.test(received)) {
    return false;
  }

  const expected = createHmac('sha256', params.secret).update(params.rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(received, 'hex'));
}

/**
 * Verifies the signature, then parses the body. Throws `CallbackSignatureError` on a missing or wrong
 * signature — answer such a request with 401 and do not act on it. Throws `CallbackPayloadError` for a
 * correctly signed body it cannot read — acknowledge that one, so the API does not keep redelivering it.
 */
export function parseCallback(params: VerifyCallbackSignatureParams): CallbackEvent {
  if (!verifyCallbackSignature(params)) {
    throw new CallbackSignatureError();
  }

  const text = typeof params.rawBody === 'string' ? params.rawBody : Buffer.from(params.rawBody).toString('utf8');
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new CallbackPayloadError('Callback body is signed but is not valid JSON.', text);
  }
  if (!isCallbackEvent(body)) {
    throw new CallbackPayloadError('Callback body is signed but is not a recognised callback event.', body);
  }
  return body;
}
