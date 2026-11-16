import { WaitTimeoutError } from '../errors';

export const DEFAULT_WAIT_TIMEOUT_MS = 300_000;
export const DEFAULT_WAIT_INTERVAL_MS = 5_000;

export interface WaitOptions {
  /** Give up after this long; rejects with `WaitTimeoutError`. Default 5 minutes. */
  timeoutMs?: number;
  /** Pause between checks. Default 5 seconds. */
  intervalMs?: number;
  /** Abort the wait; rejects with `signal.reason`. */
  signal?: AbortSignal;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Calls `check` until it returns a value other than `undefined`. Errors thrown by `check` end the wait,
 * so a check rejects a terminal state by throwing instead of returning.
 */
export async function pollUntil<T>(
  label: string,
  check: () => Promise<T | undefined>,
  options: WaitOptions = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const intervalMs = options.intervalMs ?? DEFAULT_WAIT_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    options.signal?.throwIfAborted();
    const value = await check();
    if (value !== undefined) {
      return value;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new WaitTimeoutError(label, timeoutMs);
    }
    await sleep(Math.min(intervalMs, remaining), options.signal);
  }
}
