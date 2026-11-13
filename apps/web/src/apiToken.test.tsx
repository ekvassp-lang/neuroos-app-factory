// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, setApiToken, getApiToken } from './api.js';

describe('STAGE 8+: web API token', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends Authorization header when token is set and omits when cleared', async () => {
    const calls: Array<Record<string, string>> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        calls.push((init?.headers ?? {}) as Record<string, string>);
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    setApiToken('  secret-viewer-token  ');
    expect(getApiToken()).toBe('secret-viewer-token');
    await api.projects();
    expect(calls[0].authorization).toBe('Bearer secret-viewer-token');

    setApiToken('');
    expect(getApiToken()).toBe('');
    await api.projects();
    expect(calls[1].authorization).toBeUndefined();
  });
});
