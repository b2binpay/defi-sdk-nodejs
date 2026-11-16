import { FetchError, ResponseError } from '../generated-contracts';
import {
  DefiApiError,
  DefiNetworkError,
  DefiSdkError,
  InsufficientCreditsError,
  toDefiApiError,
  toDefiError,
} from './errors';

const URL = 'https://api.example/deployments/1/payouts';

function makeResponseError(status: number, body: string): ResponseError {
  return new ResponseError(new Response(body, { status }), 'Response returned an error code');
}

function withUrl(err: ResponseError): ResponseError {
  Object.defineProperty(err.response, 'url', { value: URL });
  return err;
}

describe('InsufficientCreditsError', () => {
  it('belongs to the SDK hierarchy with status 402', () => {
    const err = new InsufficientCreditsError(100, 45);
    expect(err).toBeInstanceOf(DefiApiError);
    expect(err).toBeInstanceOf(DefiSdkError);
    expect(err.status).toBe(402);
    expect(err.required).toBe(100);
    expect(err.available).toBe(45);
    expect(err.message).toBe('Insufficient credits for operation');
  });
});

describe('toDefiApiError', () => {
  it('maps 402 with balance fields to InsufficientCreditsError', async () => {
    const err = await toDefiApiError(makeResponseError(402, JSON.stringify({ required: 50, available: 10 })));
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err).toMatchObject({ required: 50, available: 10 });
  });

  it('maps 402 with an unreadable body to InsufficientCreditsError without balances', async () => {
    const err = await toDefiApiError(makeResponseError(402, 'not json'));
    expect(err).toBeInstanceOf(InsufficientCreditsError);
    expect(err).toMatchObject({ required: undefined, available: undefined, body: 'not json' });
  });

  it('takes the message, status, body and url from a NestJS error', async () => {
    const body = { statusCode: 404, message: 'Payout not found', error: 'Not Found' };
    const err = await toDefiApiError(withUrl(makeResponseError(404, JSON.stringify(body))));
    expect(err).not.toBeInstanceOf(InsufficientCreditsError);
    expect(err).toMatchObject({ status: 404, message: 'Payout not found', body, url: URL });
  });

  it('joins validation messages delivered as an array', async () => {
    const body = { statusCode: 400, message: ['amount must be positive', 'recipient is invalid'] };
    const err = await toDefiApiError(makeResponseError(400, JSON.stringify(body)));
    expect(err.message).toBe('amount must be positive; recipient is invalid');
  });

  it('falls back to a status message when the body is empty', async () => {
    const err = await toDefiApiError(makeResponseError(502, ''));
    expect(err).toMatchObject({ status: 502, message: 'Request failed with status 502', body: undefined });
  });
});

describe('toDefiError', () => {
  it('wraps a FetchError as DefiNetworkError keeping the cause', async () => {
    const cause = new TypeError('fetch failed');
    const err = await toDefiError(new FetchError(cause));
    expect(err).toBeInstanceOf(DefiNetworkError);
    expect(err).toMatchObject({ message: 'fetch failed', cause });
  });

  it('passes unknown errors through unchanged', async () => {
    const original = new RangeError('boom');
    await expect(toDefiError(original)).resolves.toBe(original);
  });
});
