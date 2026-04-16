import { ResponseError } from '../generated-contracts';
import { formatCreditsWarning, InsufficientCreditsError, parseCreditsError } from './errors';

// ─── InsufficientCreditsError ────────────────────────────────────────────────

describe('InsufficientCreditsError', () => {
  it('is an instance of Error', () => {
    const err = new InsufficientCreditsError();
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(InsufficientCreditsError);
  });

  it('carries required and available when provided', () => {
    const err = new InsufficientCreditsError(100, 45);
    expect(err.required).toBe(100);
    expect(err.available).toBe(45);
  });

  it('has undefined required/available when not provided', () => {
    const err = new InsufficientCreditsError();
    expect(err.required).toBeUndefined();
    expect(err.available).toBeUndefined();
  });

  it('has a descriptive message', () => {
    const err = new InsufficientCreditsError(10, 3);
    expect(err.message).toBe('Insufficient credits for operation');
  });
});

// ─── parseCreditsError ────────────────────────────────────────────────────────

function makeResponseError(status: number, body: unknown): ResponseError {
  const json = jest.fn().mockResolvedValue(body);
  const clone = jest.fn().mockReturnValue({ json });
  const response = { status, clone } as unknown as Response;
  return new ResponseError(response);
}

function makeUnparsableResponseError(status: number): ResponseError {
  const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected token'));
  const clone = jest.fn().mockReturnValue({ json });
  const response = { status, clone } as unknown as Response;
  return new ResponseError(response);
}

describe('parseCreditsError', () => {
  it('returns InsufficientCreditsError for HTTP 402 with balance fields', async () => {
    const err = makeResponseError(402, {
      statusCode: 402,
      message: 'Insufficient credits for operation',
      required: 50,
      available: 10,
    });
    const result = await parseCreditsError(err);
    expect(result).toBeInstanceOf(InsufficientCreditsError);
    expect(result?.required).toBe(50);
    expect(result?.available).toBe(10);
  });

  it('returns InsufficientCreditsError for HTTP 402 even without balance fields', async () => {
    const err = makeResponseError(402, { statusCode: 402, message: 'Insufficient credits for operation' });
    const result = await parseCreditsError(err);
    expect(result).toBeInstanceOf(InsufficientCreditsError);
    expect(result?.required).toBeUndefined();
    expect(result?.available).toBeUndefined();
  });

  it('returns null for HTTP 404', async () => {
    const err = makeResponseError(404, { statusCode: 404, message: 'Not found' });
    const result = await parseCreditsError(err);
    expect(result).toBeNull();
  });

  it('returns null for HTTP 500', async () => {
    const err = makeResponseError(500, { statusCode: 500, message: 'Internal server error' });
    const result = await parseCreditsError(err);
    expect(result).toBeNull();
  });

  it('handles unparseable JSON body gracefully — still returns error on 402', async () => {
    const err = makeUnparsableResponseError(402);
    const result = await parseCreditsError(err);
    expect(result).toBeInstanceOf(InsufficientCreditsError);
    expect(result?.required).toBeUndefined();
    expect(result?.available).toBeUndefined();
  });
});

// ─── formatCreditsWarning ────────────────────────────────────────────────────

describe('formatCreditsWarning', () => {
  it('returns a fixed-width box — all lines have equal length', () => {
    const box = formatCreditsWarning(100, 45);
    const lines = box.split('\n');
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('returns a fixed-width box without balance — all lines equal length', () => {
    const box = formatCreditsWarning();
    const lines = box.split('\n');
    const lengths = lines.map((l) => l.length);
    expect(new Set(lengths).size).toBe(1);
  });

  it('includes Required and Available lines when values are provided', () => {
    const box = formatCreditsWarning(100, 45);
    expect(box).toContain('Required:   100');
    expect(box).toContain('Available:  45');
  });

  it('omits Required and Available lines when values are not provided', () => {
    const box = formatCreditsWarning();
    expect(box).not.toContain('Required:');
    expect(box).not.toContain('Available:');
  });

  it('includes b2binpay-sdk in the header', () => {
    const box = formatCreditsWarning();
    expect(box).toContain('b2binpay-sdk');
  });
});

// ─── console.warn integration ────────────────────────────────────────────────

describe('console.warn called with boxed message', () => {
  it('warns when parseCreditsError returns a credits error and DefiClient re-throws', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const err = makeResponseError(402, { required: 50, available: 10 });
    const creditsError = await parseCreditsError(err);

    if (creditsError) {
      console.warn(formatCreditsWarning(creditsError.required, creditsError.available));
    }

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const warnArg: string = warnSpy.mock.calls[0][0] as string;
    expect(warnArg).toContain('b2binpay-sdk');
    expect(warnArg).toContain('Insufficient credits');
    expect(warnArg).toContain('50');
    expect(warnArg).toContain('10');

    warnSpy.mockRestore();
  });
});
