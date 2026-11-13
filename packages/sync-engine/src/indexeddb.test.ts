import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBKV, OperationQueue } from './index.js';

describe('IndexedDBKV', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    delete (globalThis as { indexedDB?: unknown }).indexedDB;
  });

  it('stores, reads, deletes and lists keys', async () => {
    const kv = new IndexedDBKV('test-db-1', 'kv');
    expect(await kv.get('missing')).toBeNull();
    await kv.set('a', '{"id":"1"}');
    await kv.set('b', '{"id":"2"}');
    expect(await kv.get('a')).toBe('{"id":"1"}');
    expect((await kv.keys()).sort()).toEqual(['a', 'b']);
    await kv.delete('a');
    expect(await kv.get('a')).toBeNull();
    expect(await kv.keys()).toEqual(['b']);
  });

  it('survives adapter re-open (persistence across instances)', async () => {
    const first = new IndexedDBKV('test-db-2', 'kv');
    await first.set('op-1', '{"status":"pending"}');
    const second = new IndexedDBKV('test-db-2', 'kv');
    expect(await second.get('op-1')).toBe('{"status":"pending"}');
  });

  it('works as OperationQueue storage: enqueue, pendingCount, markSynced', async () => {
    const queue = new OperationQueue(new IndexedDBKV('test-db-3', 'kv'));
    const op1 = (await queue.enqueue({ id: 'op-1', kind: 'project.create', payload: { name: 'x' } })).operation;
    const op2 = (await queue.enqueue({ id: 'op-2', kind: 'project.create', payload: { name: 'y' } })).operation;
    expect(await queue.pendingCount()).toBe(2);
    await queue.markSynced(op2.id);
    expect(await queue.pendingCount()).toBe(1);
    const listed = await queue.list();
    const loaded = listed.find((op) => op.id === op1.id);
    expect(loaded?.status).toBe('pending');
    expect(loaded?.kind).toBe('project.create');
  });
});
