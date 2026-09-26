import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { attachRetryInterceptor } from '../interceptors/retry';
import { API_TIMEOUT_MS } from '../timeouts';
import { safeGet, safeGetRaw, safeGetConditional, safePost } from '../safe-request';

// The real client module pulls in `./config`, which reads expo-constants.
// Swap it for an instance built here, with the same retry interceptor
// (vi.mock is hoisted above the imports).
const holder = vi.hoisted(() => ({ client: null as AxiosInstance | null }));
vi.mock('../client', () => ({
  getApiClient: () => holder.client,
}));

type Reply = 'timeout' | 'ok';

/**
 * Builds a client whose adapter records the timeout each attempt was sent with,
 * then answers from `replies` in order — a timeout rejects exactly the way
 * axios's own adapters do when the timer fires.
 */
function recordingClient(replies: Reply[]) {
  const timeouts: (number | undefined)[] = [];
  const client = axios.create({
    timeout: API_TIMEOUT_MS.write,
    adapter: async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
      timeouts.push(config.timeout);
      const reply = replies[timeouts.length - 1] ?? 'timeout';
      if (reply === 'timeout') {
        throw new AxiosError('timeout', 'ECONNABORTED', config);
      }
      return {
        data: { meta: {}, data: { value: 1 } },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    },
  });
  attachRetryInterceptor(client);
  holder.client = client;
  return timeouts;
}

/** Runs a request to completion, fast-forwarding the retry delay. */
async function settle<T>(request: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return request;
}

const parse = (envelope: { data: unknown }) => envelope.data;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  holder.client = null;
});

describe('GET timeouts', () => {
  it('gives a safeGet the read timeout, on the retry too', async () => {
    const timeouts = recordingClient(['timeout', 'timeout']);
    const result = await settle(safeGet('/x', parse));
    expect(result.ok).toBe(false);
    expect(timeouts).toEqual([6_000, 6_000]);
  });

  it('gives a realtime poll the realtime timeout, on the retry too', async () => {
    const timeouts = recordingClient(['timeout', 'timeout']);
    await settle(safeGet('/bus/realtime/data/x', parse, { timeout: API_TIMEOUT_MS.realtime }));
    expect(timeouts).toEqual([4_000, 4_000]);
  });

  it('keeps a timeout the caller set explicitly', async () => {
    const timeouts = recordingClient(['timeout', 'timeout']);
    await settle(safeGet('/app/config', parse, { timeout: 5_000 }));
    expect(timeouts).toEqual([5_000, 5_000]);
  });

  it('gives safeGetRaw and safeGetConditional the read timeout', async () => {
    const raw = recordingClient(['timeout', 'timeout']);
    await settle(safeGetRaw('/x'));
    expect(raw).toEqual([6_000, 6_000]);

    const conditional = recordingClient(['timeout', 'timeout']);
    await settle(safeGetConditional('/x', parse, { ifNoneMatch: '"abc"' }));
    expect(conditional).toEqual([6_000, 6_000]);
  });

  it('returns ok when the retry succeeds', async () => {
    const timeouts = recordingClient(['timeout', 'ok']);
    const result = await settle(safeGet('/x', parse));
    expect(result).toEqual({ ok: true, data: { value: 1 } });
    expect(timeouts).toEqual([6_000, 6_000]);
  });
});

describe('POST timeouts', () => {
  it('leaves a POST on the instance default, with no retry', async () => {
    const timeouts = recordingClient(['timeout', 'timeout']);
    const result = await settle(safePost('/x', parse, { data: {} }));
    expect(result.ok).toBe(false);
    expect(timeouts).toEqual([10_000]);
  });
});
