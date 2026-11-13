// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { LocalStorageKV, OperationQueue } from './index.js';

beforeEach(() => {
  localStorage.clear();
});

describe('LocalStorageKV', () => {
  it('persists values with prefix isolation', async () => {
    const kv = new LocalStorageKV('test-kv:');
    await kv.set('a', '1');
    await kv.set('b', '2');
    expect(await kv.get('a')).toBe('1');
    expect(await kv.keys().then((k) => k.sort())).toEqual(['a', 'b']);
    await kv.delete('a');
    expect(await kv.get('a')).toBeNull();
  });

  it('queue survives adapter recreation (persistence)', async () => {
    const queue = new OperationQueue(new LocalStorageKV('test-queue:'));
    await queue.enqueue({ id: 'ls-1', kind: 'patch_project', payload: { x: 1 } });
    const reopened = new OperationQueue(new LocalStorageKV('test-queue:'));
    expect(await reopened.pendingCount()).toBe(1);
  });
});
