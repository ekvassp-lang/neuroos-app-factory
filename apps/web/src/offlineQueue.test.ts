// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './api.js';
import {
  flushOffline,
  pendingOfflineCount,
  QueuedOfflineError,
  requeueFailedOffline,
} from './offlineQueue.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('offline queue (web client)', () => {
  it('queues create_project on network failure and flushes after reconnect without data loss', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );

    await expect(api.createProject('Offline Project', 'offline')).rejects.toBeInstanceOf(QueuedOfflineError);
    expect(await pendingOfflineCount()).toBe(1);

    vi.stubGlobal(
      'fetch',
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(_input);
        if (url === '/api/v1/sync' && init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { operations: Array<{ id: string }> };
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                results: body.operations.map((op) => ({ id: op.id, outcome: 'applied' })),
              }),
          } as Response);
        }
        return Promise.reject(new TypeError('unexpected call'));
      }),
    );

    const result = await flushOffline();
    expect(result.synced).toBe(1);
    expect(await pendingOfflineCount()).toBe(0);
  });

  it('does not queue on API errors (only network failures)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 409,
          json: () => Promise.resolve({ error: 'slug already exists' }),
          text: () => Promise.resolve(JSON.stringify({ error: 'slug already exists' })),
        } as Response),
      ),
    );
    await expect(api.createProject('Dup', 'dup')).rejects.toBeInstanceOf(ApiError);
    expect(await pendingOfflineCount()).toBe(0);
  });

  it('failed sync ops can be requeued', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    await expect(api.patchProject('x', { name: 'y' })).rejects.toBeInstanceOf(QueuedOfflineError);
    expect(await pendingOfflineCount()).toBe(1);

    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'boom' }),
          text: () => Promise.resolve(JSON.stringify({ error: 'boom' })),
        } as Response),
      ),
    );
    const result = await flushOffline();
    expect(result.failed).toBe(1);
    expect(await pendingOfflineCount()).toBe(0);
    expect(await requeueFailedOffline()).toBe(1);
    expect(await pendingOfflineCount()).toBe(1);
  });
});
