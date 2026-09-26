import { describe, it, expect } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { shouldRetryRequest, retryDelayMs } from '../interceptors/retry';

type Method = 'get' | 'post';

function withStatus(method: Method, status: number, headers: Record<string, string> = {}) {
  const config = { method, headers: new AxiosHeaders() };
  return new AxiosError('mock', 'ERR_BAD_RESPONSE', config, {}, {
    status,
    statusText: '',
    headers,
    config,
    data: null,
  });
}

function withoutResponse(method: Method, code: string) {
  return new AxiosError('mock', code, { method, headers: new AxiosHeaders() }, {});
}

describe('shouldRetryRequest', () => {
  it.each([502, 503, 504])('retries a GET that got %i', (status) => {
    expect(shouldRetryRequest(withStatus('get', status))).toBe(true);
  });

  it.each([429, 500, 400, 401, 404])('does not retry a GET that got %i', (status) => {
    expect(shouldRetryRequest(withStatus('get', status))).toBe(false);
  });

  it.each([429, 500, 502, 503, 504])('never retries a POST on status %i', (status) => {
    expect(shouldRetryRequest(withStatus('post', status))).toBe(false);
  });

  it('retries a request that got no response, whatever the method', () => {
    expect(shouldRetryRequest(withoutResponse('get', 'ECONNRESET'))).toBe(true);
    expect(shouldRetryRequest(withoutResponse('post', 'ECONNRESET'))).toBe(true);
  });

  it('retries a timed-out GET but not a timed-out POST', () => {
    expect(shouldRetryRequest(withoutResponse('get', 'ECONNABORTED'))).toBe(true);
    expect(shouldRetryRequest(withoutResponse('post', 'ECONNABORTED'))).toBe(false);
  });

  it('does not retry a cancelled request', () => {
    expect(shouldRetryRequest(withoutResponse('get', 'ERR_CANCELED'))).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('waits about a second, with at most 20% jitter', () => {
    for (let i = 0; i < 50; i++) {
      const delay = retryDelayMs(1, withStatus('get', 503));
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1200);
    }
  });

  it('waits at least as long as Retry-After asks', () => {
    const delay = retryDelayMs(1, withStatus('get', 503, { 'retry-after': '5' }));
    expect(delay).toBeGreaterThanOrEqual(5000);
  });
});
