import { describe, it, expect } from 'vitest';
import {
  MemoryKV,
  OperationQueue,
  SyncClient,
  resolveLWW,
  type QueuedOperation,
  type SyncTransport,
  type Versioned,
} from './index.js';

function op(partial: Partial<QueuedOperation>): QueuedOperation {
  return {
    id: 'op-1',
    kind: 'patch_project',
    payload: {},
    createdAt: '2026-01-01T00:00:00.000Z',
    attempts: 0,
    status: 'pending',
    ...partial,
  };
}

describe('OperationQueue', () => {
  it('enqueues with idempotency dedupe', async () => {
    const queue = new OperationQueue(new MemoryKV());
    const first = await queue.enqueue({ id: 'k1', kind: 'create_project', payload: { name: 'A' } });
    expect(first.queued).toBe(true);
    const second = await queue.enqueue({ id: 'k1', kind: 'create_project', payload: { name: 'B' } });
    expect(second.queued).toBe(false);
    expect(second.operation.payload).toEqual({ name: 'A' });
    expect(await queue.pendingCount()).toBe(1);
  });

  it('tracks statuses through sync lifecycle', async () => {
    const queue = new OperationQueue(new MemoryKV());
    await queue.enqueue({ id: 'k1', kind: 'patch_project', payload: {} });
    await queue.markAttempted('k1', 'network down');
    expect((await queue.pendingCount()) as number).toBe(0);
    expect((await queue.list())[0].status).toBe('failed');
    expect(await queue.requeueFailed()).toBe(1);
    expect(await queue.pendingCount()).toBe(1);
    await queue.markSynced('k1');
    expect(await queue.pendingCount()).toBe(0);
    expect(await queue.clearSynced()).toBe(1);
    expect(await queue.list()).toHaveLength(0);
  });

  it('lists pending in creation order', async () => {
    const queue = new OperationQueue(new MemoryKV());
    await queue.enqueue({ id: 'a', kind: 'x', payload: null }, '2026-01-01T00:00:00.000Z');
    await queue.enqueue({ id: 'b', kind: 'x', payload: null }, '2026-01-02T00:00:00.000Z');
    expect((await queue.pending()).map((o) => o.id)).toEqual(['a', 'b']);
  });
});

describe('resolveLWW', () => {
  it('prefers newer updatedAt', () => {
    const older: Versioned = { updatedAt: '2026-01-01T00:00:00.000Z' };
    const newer: Versioned = { updatedAt: '2026-01-02T00:00:00.000Z' };
    expect(resolveLWW(newer, older)).toBe('local');
    expect(resolveLWW(older, newer)).toBe('remote');
  });

  it('falls back to revision, then remote', () => {
    expect(resolveLWW({ updatedAt: '2026-01-01T00:00:00.000Z', revision: 2 }, { updatedAt: '2026-01-01T00:00:00.000Z', revision: 3 })).toBe('remote');
    expect(resolveLWW({ updatedAt: '2026-01-01T00:00:00.000Z', revision: 5 }, { updatedAt: '2026-01-01T00:00:00.000Z', revision: 3 })).toBe('local');
    expect(resolveLWW({ updatedAt: '2026-01-01T00:00:00.000Z', revision: 1 }, { updatedAt: '2026-01-01T00:00:00.000Z', revision: 1 })).toBe('remote');
  });
});

describe('SyncClient', () => {
  it('does not flush while offline and drains queue after reconnect without data loss', async () => {
    const queue = new OperationQueue(new MemoryKV());
    const sent: string[] = [];
    const transport: SyncTransport = async (operation) => {
      sent.push(operation.id);
      return { outcome: 'applied' };
    };
    const client = new SyncClient(transport, queue);

    client.goOffline();
    await queue.enqueue({ id: 'op-a', kind: 'patch_project', payload: { name: 'Offline edit' } });
    await queue.enqueue({ id: 'op-b', kind: 'patch_project', payload: { name: 'Offline edit 2' } });
    const offlineResult = await client.flush();
    expect(offlineResult).toEqual({ synced: 0, conflicts: 0, failed: 0 });
    expect(sent).toHaveLength(0);
    expect(await queue.pendingCount()).toBe(2);

    const onlineResult = await client.goOnline();
    expect(onlineResult.synced).toBe(2);
    expect(sent).toEqual(['op-a', 'op-b']);
    expect(await queue.pendingCount()).toBe(0);
  });

  it('deduplicates idempotency keys across retries', async () => {
    const queue = new OperationQueue(new MemoryKV());
    const seen: string[] = [];
    const transport: SyncTransport = async (operation) => {
      seen.push(operation.id);
      return { outcome: 'applied' };
    };
    const client = new SyncClient(transport, queue);
    await queue.enqueue({ id: 'idem-1', kind: 'create_project', payload: {} });
    await queue.enqueue({ id: 'idem-1', kind: 'create_project', payload: {} });
    await client.flush();
    expect(seen).toEqual(['idem-1']);
  });

  it('resolves conflicts via resolver and reports them', async () => {
    const queue = new OperationQueue(new MemoryKV());
    const server: Versioned = { updatedAt: '2026-01-02T00:00:00.000Z', revision: 7 };
    const transport: SyncTransport = async () => ({ outcome: 'conflict', server });
    const resolutions: string[] = [];
    const client = new SyncClient(
      transport,
      queue,
      async () => {
        resolutions.push('accept_server');
        return 'accept_server';
      },
      {
        onConflict: (_op, srv, resolution) => {
          resolutions.push(`${resolution}:${srv.revision}`);
        },
      },
    );
    await queue.enqueue({ id: 'c1', kind: 'patch_project', payload: { name: 'stale' }, baseRevision: 3 });
    const result = await client.flush();
    expect(result.synced).toBe(1);
    expect(result.conflicts).toBe(0);
    expect(resolutions).toEqual(['accept_server', 'accept_server:7']);
  });

  it('keeps local on conflict when resolver chooses keep_local', async () => {
    const queue = new OperationQueue(new MemoryKV());
    const transport: SyncTransport = async () => ({
      outcome: 'conflict',
      server: { updatedAt: '2026-01-01T00:00:00.000Z', revision: 1 },
    });
    const client = new SyncClient(transport, queue, async () => 'keep_local');
    await queue.enqueue({ id: 'c2', kind: 'patch_project', payload: {} });
    const result = await client.flush();
    expect(result.synced).toBe(0);
    expect(result.conflicts).toBe(1);
    expect(await queue.pendingCount()).toBe(1);
  });

  it('marks transport failures as failed and survives retry', async () => {
    const queue = new OperationQueue(new MemoryKV());
    let calls = 0;
    const transport: SyncTransport = async () => {
      calls += 1;
      if (calls === 1) throw new Error('ECONNRESET');
      return { outcome: 'applied' };
    };
    const client = new SyncClient(transport, queue);
    await queue.enqueue({ id: 'f1', kind: 'patch_project', payload: {} });
    const first = await client.flush();
    expect(first.failed).toBe(1);
    expect((await queue.list())[0].lastError).toBe('ECONNRESET');
    await queue.requeueFailed();
    const second = await client.flush();
    expect(second.synced).toBe(1);
  });
});
