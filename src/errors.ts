import { FetchError, ResponseError } from '../generated-contracts';

const HTTP_PAYMENT_REQUIRED = 402;
const INSUFFICIENT_CREDITS_MESSAGE = 'Insufficient credits for operation';

/** Base class of every error the SDK throws itself; `instanceof DefiSdkError` catches all of them. */
export class DefiSdkError extends Error {
  override name = 'DefiSdkError';
}

export interface DefiApiErrorInit {
  status: number;
  message: string;
  /** Parsed JSON body, the raw text when it is not JSON, or `undefined` when the body is empty. */
  body: unknown;
  url: string;
}

/** The API answered with a non-2xx status. */
export class DefiApiError extends DefiSdkError {
  override name = 'DefiApiError';
  readonly status: number;
  readonly body: unknown;
  readonly url: string;

  constructor(init: DefiApiErrorInit) {
    super(init.message);
    this.status = init.status;
    this.body = init.body;
    this.url = init.url;
  }
}

/** HTTP 402: the account's credit balance cannot cover the paid operation. */
export class InsufficientCreditsError extends DefiApiError {
  override name = 'InsufficientCreditsError';

  constructor(
    public readonly required?: number,
    public readonly available?: number,
    init: Partial<Omit<DefiApiErrorInit, 'status' | 'message'>> = {},
  ) {
    super({
      status: HTTP_PAYMENT_REQUIRED,
      message: INSUFFICIENT_CREDITS_MESSAGE,
      body: init.body,
      url: init.url ?? '',
    });
  }
}

/** The request never got a response: DNS, TLS, connection reset, aborted fetch. */
export class DefiNetworkError extends DefiSdkError {
  override name = 'DefiNetworkError';

  constructor(message: string, options: { cause: unknown }) {
    super(message, options);
  }
}

/** A chain-scoped method was called without `chainId` and before `selectChain()`. */
export class ChainNotSelectedError extends DefiSdkError {
  override name = 'ChainNotSelectedError';

  constructor() {
    super('Chain is not selected. Call selectChain() or provide chainId in the method call.');
  }
}

/** The account has no multisig deployment on the requested chain. */
export class DeploymentNotFoundError extends DefiSdkError {
  override name = 'DeploymentNotFoundError';

  constructor(public readonly chainId: string) {
    super(`Deployment for chain ${chainId} not found on this account.`);
  }
}

/** A `waitFor*` helper saw the entity settle in a status it was not waiting for. */
export class UnexpectedStatusError extends DefiSdkError {
  override name = 'UnexpectedStatusError';

  constructor(
    public readonly label: string,
    public readonly status: string,
  ) {
    super(`${label} reached terminal status ${status}.`);
  }
}

/** A callback request whose signature is missing or does not match its body. */
export class CallbackSignatureError extends DefiSdkError {
  override name = 'CallbackSignatureError';

  constructor(message = 'Callback signature is missing or invalid.') {
    super(message);
  }
}

/**
 * A callback whose signature checked out but whose body is not valid JSON or not a callback event this
 * SDK version knows. It did come from the API, so acknowledge it (2xx) and log `body` — answering with an
 * error status only makes the API redeliver the same payload.
 */
export class CallbackPayloadError extends DefiSdkError {
  override name = 'CallbackPayloadError';

  constructor(
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
  }
}

/** A `waitFor*` helper ran out of time before its condition held. */
export class WaitTimeoutError extends DefiSdkError {
  override name = 'WaitTimeoutError';

  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
  ) {
    super(`Timed out after ${timeoutMs} ms waiting for ${label}.`);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.clone().text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** NestJS bodies carry `message` as a string, or as a string array for validation failures. */
function messageFromBody(body: unknown, status: number): string {
  if (typeof body === 'string' && body) {
    return body;
  }
  if (body !== null && typeof body === 'object' && 'message' in body) {
    const { message } = body;
    if (typeof message === 'string') {
      return message;
    }
    if (Array.isArray(message)) {
      return message.map(String).join('; ');
    }
  }
  return `Request failed with status ${status}`;
}

function numberField(body: unknown, field: string): number | undefined {
  if (body === null || typeof body !== 'object' || !(field in body)) {
    return undefined;
  }
  const value: unknown = Reflect.get(body, field);
  return typeof value === 'number' ? value : undefined;
}

/** Converts a generated-client `ResponseError` into the SDK's typed error for its status. */
export async function toDefiApiError(err: ResponseError): Promise<DefiApiError> {
  const { status, url } = err.response;
  let body: unknown;
  try {
    body = await readBody(err.response);
  } catch {
    body = undefined;
  }

  if (status === HTTP_PAYMENT_REQUIRED) {
    return new InsufficientCreditsError(numberField(body, 'required'), numberField(body, 'available'), { body, url });
  }

  return new DefiApiError({ status, message: messageFromBody(body, status), body, url });
}

/** Maps any error thrown by the generated client onto the SDK hierarchy; unknown errors pass through. */
export async function toDefiError(err: unknown): Promise<unknown> {
  if (err instanceof ResponseError) {
    return toDefiApiError(err);
  }
  if (err instanceof FetchError) {
    return new DefiNetworkError(err.cause.message || 'Network request failed', { cause: err.cause });
  }
  return err;
}
