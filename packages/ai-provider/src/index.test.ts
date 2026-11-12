import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MistralProvider, ProviderRegistry, createRegistry, smokeTest } from './index.js';

const OK_RESPONSE = {
  choices: [{ message: { content: 'OK' } }],
  usage: { prompt_tokens: 5, completion_tokens: 1 },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MistralProvider', () => {
  it('returns ok result on successful completion', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify(OK_RESPONSE), { status: 200 }));
    const provider = new MistralProvider();
    const result = await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [{ role: 'user', content: 'ping' }], idempotencyKey: 'k1' },
      'test-key',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe('OK');
      expect(result.usage?.promptTokens).toBe(5);
    }
    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call[0]).toBe('https://api.mistral.ai/v1/chat/completions');
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('maps 429 to rate_limited', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('too many', { status: 429 }));
    const provider = new MistralProvider();
    const result = await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [], idempotencyKey: 'k2' },
      'test-key',
    );
    expect(result).toMatchObject({ ok: false, kind: 'rate_limited' });
  });

  it('maps network failure to error', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    const provider = new MistralProvider();
    const result = await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [], idempotencyKey: 'k3' },
      'test-key',
    );
    expect(result).toMatchObject({ ok: false, kind: 'error' });
  });

  it('maps abort to timeout', async () => {
    const controller = new AbortController();
    vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    });
    const provider = new MistralProvider();
    const result = await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [], timeoutMs: 30, idempotencyKey: 'k4' },
      'test-key',
    );
    expect(result).toMatchObject({ ok: false, kind: 'timeout' });
    controller.abort();
  });

  it('maps empty completion to error', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '' } }] }), { status: 200 }),
    );
    const provider = new MistralProvider();
    const result = await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [], idempotencyKey: 'k5' },
      'test-key',
    );
    expect(result).toMatchObject({ ok: false, kind: 'error' });
  });
});

describe('smokeTest', () => {
  it('passes when provider returns OK', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify(OK_RESPONSE), { status: 200 }));
    const smoke = await smokeTest(new MistralProvider(), 'test-key');
    expect(smoke.passed).toBe(true);
  });

  it('fails when provider errors', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('boom', { status: 500 }));
    const smoke = await smokeTest(new MistralProvider(), 'test-key');
    expect(smoke.passed).toBe(false);
    expect(smoke.detail).toContain('500');
  });
});

describe('ProviderRegistry', () => {
  it('registers providers disabled by default', () => {
    const registry = createRegistry();
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('mistral')?.enabled).toBe(false);
  });

  it('refuses enabling without smoke test and enables after passing smoke', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response('boom', { status: 503 }));
    const registry = createRegistry();
    const failed = await registry.enable('mistral', 'bad-key', 'env:MISTRAL_API_KEY');
    expect(failed.passed).toBe(false);
    expect(registry.get('mistral')?.enabled).toBe(false);

    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify(OK_RESPONSE), { status: 200 }));
    const passed = await registry.enable('mistral', 'good-key', 'env:MISTRAL_API_KEY');
    expect(passed.passed).toBe(true);
    const entry = registry.get('mistral');
    expect(entry?.enabled).toBe(true);
    expect(entry?.keyRef).toBe('env:MISTRAL_API_KEY');
    expect(entry?.smokeTestedAt).toBeTruthy();
  });

  it('disable revokes enabled state', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify(OK_RESPONSE), { status: 200 }));
    const registry = createRegistry();
    await registry.enable('mistral', 'good-key', 'env:MISTRAL_API_KEY');
    registry.disable('mistral');
    expect(registry.getEnabled()).toBeUndefined();
  });

  it('getEnabled returns undefined when nothing is enabled', () => {
    const registry = createRegistry();
    expect(registry.getEnabled()).toBeUndefined();
  });
});

describe('key hygiene', () => {
  it('sends key only in Authorization header and never in body', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(new Response(JSON.stringify(OK_RESPONSE), { status: 200 }));
    const provider = new MistralProvider();
    await provider.complete(
      { model: 'mistral-small-latest', taskKind: 'ai_task', messages: [{ role: 'user', content: 'hi' }], idempotencyKey: 'k9' },
      'super-secret-key',
    );
    const init = vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toContain('super-secret-key');
    expect(String(init.body)).not.toContain('super-secret-key');
  });
});

void originalFetch;
