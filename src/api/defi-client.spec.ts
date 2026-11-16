import {
  ChainNotSelectedError,
  DefiApiError,
  DefiNetworkError,
  DeploymentNotFoundError,
  InsufficientCreditsError,
  UnexpectedStatusError,
  WaitTimeoutError,
} from '../errors';
import { paginate } from '../utils/paginate';
import { DefiClient } from './defi-client';

const BASE_URL = 'https://api.example';
const ACCOUNT_ID = 'acc-1';
const DEPLOYMENT_ID = 'dep-1';
const CHAIN_ID = '11155111';

type Route = (url: URL, init: RequestInit) => Response | Promise<Response>;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const ACCOUNT_ROUTES: Record<string, Route> = {
  'GET /api/v1/accounts': () => json([{ id: ACCOUNT_ID }]),
  [`GET /api/v1/accounts/${ACCOUNT_ID}`]: () =>
    json({
      account: { id: ACCOUNT_ID, name: 'Test', contract: '0x0000000000000000000000000000000000000001' },
      deployments: [{ deploymentId: DEPLOYMENT_ID, chainId: CHAIN_ID, deploymentStatus: 'DEPLOYED' }],
    }),
};

/** Builds a `fetchApi` that dispatches on `METHOD /path` and fails loudly on anything unrouted. */
function fakeFetch(routes: Record<string, Route>) {
  const all = { ...ACCOUNT_ROUTES, ...routes };
  const calls: URL[] = [];
  const fetchApi = jest.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    calls.push(url);
    const key = `${init.method ?? 'GET'} ${url.pathname}`;
    const route = all[key];
    if (!route) {
      throw new Error(`Unrouted request: ${key}`);
    }
    return route(url, init);
  });
  return { fetchApi, calls };
}

function makeClient(routes: Record<string, Route>, logger?: { warn: jest.Mock }) {
  const { fetchApi, calls } = fakeFetch(routes);
  const client = new DefiClient({ baseUrl: BASE_URL, apiKey: 'key', fetchApi, logger });
  return { client, calls };
}

const PAYOUT_PATH = `GET /api/v1/deployments/${DEPLOYMENT_ID}/payouts/p-1`;

describe('DefiClient errors', () => {
  it('throws DefiApiError carrying status and the API message', async () => {
    const { client } = makeClient({
      [PAYOUT_PATH]: () => json({ statusCode: 404, message: 'Payout not found' }, 404),
    });

    const error = await client.getPayout({ chainId: CHAIN_ID, payoutId: 'p-1' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DefiApiError);
    expect(error).toMatchObject({ status: 404, message: 'Payout not found' });
  });

  it('throws InsufficientCreditsError on 402 and reports it through the logger only', async () => {
    const logger = { warn: jest.fn() };
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { client } = makeClient({ [PAYOUT_PATH]: () => json({ required: 5, available: 1 }, 402) }, logger);

    const error = await client.getPayout({ chainId: CHAIN_ID, payoutId: 'p-1' }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(InsufficientCreditsError);
    expect(logger.warn).toHaveBeenCalledWith('Insufficient credits: required 5, available 1.');
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('throws DefiNetworkError when the request never gets a response', async () => {
    const { client } = makeClient({
      [PAYOUT_PATH]: () => {
        throw new TypeError('fetch failed');
      },
    });

    await expect(client.getPayout({ chainId: CHAIN_ID, payoutId: 'p-1' })).rejects.toBeInstanceOf(DefiNetworkError);
  });

  it('throws ChainNotSelectedError when no chain is given or selected', async () => {
    const { client } = makeClient({});

    await expect(client.getPayout({ payoutId: 'p-1' })).rejects.toBeInstanceOf(ChainNotSelectedError);
  });

  it('throws DeploymentNotFoundError for a chain the account is not deployed on', async () => {
    const { client } = makeClient({});

    await expect(client.selectChain(1)).rejects.toMatchObject({
      constructor: DeploymentNotFoundError,
      chainId: '1',
    });
  });
});

const QUEUE_OP_PATH = `GET /api/v1/deployments/${DEPLOYMENT_ID}/queue/op-1`;
const OPERATIONS_V2_PATH = `GET /api/v2/deployments/${DEPLOYMENT_ID}/operations`;
const FAST = { intervalMs: 1, timeoutMs: 1_000 };

const queueOperation = (status: string) => ({
  id: 'op-1',
  executeOperationId: `0x${'0'.repeat(64)}`,
  nonce: '7',
  operationType: 'PAYOUT',
  status,
  calls: [],
  payload: null,
  signaturesCollected: status === 'PENDING' ? 0 : 1,
  signaturesRequired: 1,
  signers: [],
});

const operationV2 = (status: string) => ({ id: 'v2-1', txHash: '0xabc', status, confirmations: 3 });

/** Answers each call with the next entry, repeating the last one. */
const sequence = (...responses: (() => Response)[]): Route => {
  let call = 0;
  return () => responses[Math.min(call++, responses.length - 1)]();
};

describe('DefiClient.waitForQueueOperation', () => {
  it('resolves once the operation becomes READY', async () => {
    const { client, calls } = makeClient({
      [QUEUE_OP_PATH]: sequence(
        () => json(queueOperation('PENDING')),
        () => json(queueOperation('READY')),
      ),
    });

    const operation = await client.waitForQueueOperation({ chainId: CHAIN_ID, operationId: 'op-1' }, FAST);

    expect(operation.status).toBe('READY');
    expect(calls.filter((url) => url.pathname.endsWith('/queue/op-1'))).toHaveLength(2);
  });

  it('rejects with UnexpectedStatusError when the operation is cancelled instead', async () => {
    const { client } = makeClient({ [QUEUE_OP_PATH]: () => json(queueOperation('CANCELLED')) });

    await expect(client.waitForQueueOperation({ chainId: CHAIN_ID, operationId: 'op-1' }, FAST)).rejects.toMatchObject({
      constructor: UnexpectedStatusError,
      status: 'CANCELLED',
    });
  });

  it('rejects with WaitTimeoutError when the status never arrives', async () => {
    const { client } = makeClient({ [QUEUE_OP_PATH]: () => json(queueOperation('PENDING')) });

    await expect(
      client.waitForQueueOperation({ chainId: CHAIN_ID, operationId: 'op-1' }, { intervalMs: 1, timeoutMs: 10 }),
    ).rejects.toBeInstanceOf(WaitTimeoutError);
  });

  it('rejects with the abort reason when the signal fires', async () => {
    const controller = new AbortController();
    const reason = new Error('shutting down');
    const { client } = makeClient({
      [QUEUE_OP_PATH]: () => {
        controller.abort(reason);
        return json(queueOperation('PENDING'));
      },
    });

    await expect(
      client.waitForQueueOperation(
        { chainId: CHAIN_ID, operationId: 'op-1' },
        { intervalMs: 50, signal: controller.signal },
      ),
    ).rejects.toBe(reason);
  });
});

const v2Page = (...items: unknown[]) => json({ items, total: items.length, page: 1, pageSize: 100 });

describe('DefiClient.waitForOperationV2', () => {
  it('polls one operation by id until it confirms', async () => {
    const { client, calls } = makeClient({
      [OPERATIONS_V2_PATH]: sequence(
        () => v2Page(operationV2('PENDING')),
        () => v2Page(operationV2('CONFIRMED')),
      ),
    });

    const operation = await client.waitForOperationV2({ chainId: CHAIN_ID, id: 'v2-1' }, FAST);

    expect(operation.status).toBe('CONFIRMED');
    expect(calls[calls.length - 1].searchParams.get('id')).toBe('v2-1');
  });

  it('rejects with UnexpectedStatusError on a terminal failure', async () => {
    const { client } = makeClient({ [OPERATIONS_V2_PATH]: () => v2Page(operationV2('FAILED')) });

    await expect(client.waitForOperationV2({ chainId: CHAIN_ID, id: 'v2-1' }, FAST)).rejects.toMatchObject({
      constructor: UnexpectedStatusError,
      status: 'FAILED',
    });
  });
});

describe('DefiClient.waitForTransactionOperations', () => {
  const op = (id: string, status: string) => ({ ...operationV2(status), id });

  it('waits for the indexer, then for every operation of a batch transaction', async () => {
    const { client, calls } = makeClient({
      [OPERATIONS_V2_PATH]: sequence(
        () => v2Page(),
        () => v2Page(op('a', 'CONFIRMED'), op('b', 'PENDING')),
        () => v2Page(op('a', 'CONFIRMED'), op('b', 'CONFIRMED')),
      ),
    });

    const operations = await client.waitForTransactionOperations({ chainId: CHAIN_ID, txHash: '0xabc' }, FAST);

    expect(operations.map((item) => item.id)).toEqual(['a', 'b']);
    expect(calls.filter((url) => url.pathname.endsWith('/operations'))).toHaveLength(3);
    expect(calls[calls.length - 1].searchParams.get('txHash')).toBe('0xabc');
  });

  it('rejects on a failed sibling even when an earlier operation is still pending', async () => {
    const { client, calls } = makeClient({
      [OPERATIONS_V2_PATH]: () => v2Page(op('a', 'PENDING'), op('b', 'FAILED')),
    });

    await expect(
      client.waitForTransactionOperations({ chainId: CHAIN_ID, txHash: '0xabc' }, FAST),
    ).rejects.toMatchObject({ constructor: UnexpectedStatusError, label: 'operation b' });
    expect(calls.filter((url) => url.pathname.endsWith('/operations'))).toHaveLength(1);
  });

  it('rejects naming the sibling that settled in an unwanted terminal status', async () => {
    const { client } = makeClient({
      [OPERATIONS_V2_PATH]: () => v2Page(op('a', 'CONFIRMED'), op('b', 'FAILED')),
    });

    await expect(
      client.waitForTransactionOperations({ chainId: CHAIN_ID, txHash: '0xabc' }, FAST),
    ).rejects.toMatchObject({ constructor: UnexpectedStatusError, label: 'operation b', status: 'FAILED' });
  });
});

describe('paginate over DefiClient lists', () => {
  it('pages through payouts with the caller filters on every request', async () => {
    const PAGE_SIZE = 2;
    const payouts = ['p-1', 'p-2', 'p-3'].map((id) => ({ id, status: 'CREATED', currency: { id: 'c' } }));
    const { client, calls } = makeClient({
      [`GET /api/v1/deployments/${DEPLOYMENT_ID}/payouts`]: (url) => {
        const page = Number(url.searchParams.get('page'));
        const items = payouts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
        return json({ items, total: payouts.length, page, pageSize: PAGE_SIZE });
      },
    });

    const ids: string[] = [];
    for await (const payout of paginate((p) => client.getPayouts(p), { chainId: CHAIN_ID, pageSize: PAGE_SIZE })) {
      ids.push(payout.id);
    }

    expect(ids).toEqual(['p-1', 'p-2', 'p-3']);
    const payoutCalls = calls.filter((url) => url.pathname.endsWith('/payouts'));
    expect(payoutCalls.map((url) => url.searchParams.get('page'))).toEqual(['1', '2']);
  });
});

describe('DefiClient date filters', () => {
  it('serializes a Date filter as an ISO string and passes a string through unchanged', async () => {
    const { client, calls } = makeClient({
      [`GET /api/v1/deployments/${DEPLOYMENT_ID}/invoices`]: () => json({ items: [], total: 0, page: 1, pageSize: 20 }),
    });

    await client.getInvoices({
      chainId: CHAIN_ID,
      createdFrom: new Date('2026-10-01T00:00:00.000Z'),
      createdTo: '2026-10-15T00:00:00.000Z',
    });

    const query = calls[calls.length - 1].searchParams;
    expect(query.get('createdFrom')).toBe('2026-10-01T00:00:00.000Z');
    expect(query.get('createdTo')).toBe('2026-10-15T00:00:00.000Z');
  });
});

describe('DefiClient idempotency key', () => {
  const CANCEL_UNSTAKING_PATH = `POST /api/v1/deployments/${DEPLOYMENT_ID}/operations/cancel-unstaking`;

  function captureIdempotencyKey() {
    const sent: (string | null)[] = [];
    const { client } = makeClient({
      [CANCEL_UNSTAKING_PATH]: (_url, init) => {
        sent.push(new Headers(init.headers).get('Idempotency-Key'));
        return json({ message: 'stop here' }, 409);
      },
    });
    return { client, sent };
  }

  it('sends the key as the Idempotency-Key header', async () => {
    const { client, sent } = captureIdempotencyKey();

    await expect(
      client.createCancelUnstakingOperation({ chainId: CHAIN_ID, idempotencyKey: 'key-1' }),
    ).rejects.toBeInstanceOf(DefiApiError);

    expect(sent).toEqual(['key-1']);
  });

  it('omits the header when no key is given', async () => {
    const { client, sent } = captureIdempotencyKey();

    await expect(client.createCancelUnstakingOperation({ chainId: CHAIN_ID })).rejects.toBeInstanceOf(DefiApiError);

    expect(sent).toEqual([null]);
  });
});
