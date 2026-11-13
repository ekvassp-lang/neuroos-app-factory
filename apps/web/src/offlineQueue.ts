import { LocalStorageKV, OperationQueue, SyncClient, type SyncTransportResult } from '@neuroos/sync-engine';
import { getApiToken } from './api.js';

export class QueuedOfflineError extends Error {
  constructor(
    public opId: string,
    public kind: string,
  ) {
    super('офлайн: операция поставлена в очередь и будет отправлена при подключении');
  }
}

type CountListener = (count: number) => void;

const listeners = new Set<CountListener>();

const queue = new OperationQueue(new LocalStorageKV('nf-queue:'));

const transport = async (operation: {
  id: string;
  kind: string;
  payload: unknown;
  baseRevision?: number;
}): Promise<SyncTransportResult> => {
  const res = await fetch('/api/v1/sync', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(getApiToken() ? { authorization: `Bearer ${getApiToken()}` } : {}),
    },
    body: JSON.stringify({
      operations: [
        { id: operation.id, kind: operation.kind, payload: operation.payload, baseRevision: operation.baseRevision },
      ],
    }),
  });
  if (!res.ok) return { outcome: 'rejected', detail: `HTTP ${res.status}` };
  const data = (await res.json()) as {
    results: Array<{ outcome: string; server?: { updatedAt: string; revision?: number }; detail?: string }>;
  };
  const result = data.results[0];
  if (!result) return { outcome: 'rejected', detail: 'empty sync response' };
  return result as SyncTransportResult;
};

const client = new SyncClient(transport, queue, async () => 'accept_server');

function notify(): void {
  void queue.pendingCount().then((count) => {
    for (const listener of listeners) listener(count);
  });
}

export async function enqueueOffline(kind: string, payload: unknown, baseRevision?: number): Promise<string> {
  const id = `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await queue.enqueue({ id, kind, payload, baseRevision });
  notify();
  return id;
}

export async function pendingOfflineCount(): Promise<number> {
  return queue.pendingCount();
}

export async function flushOffline(): Promise<{ synced: number; conflicts: number; failed: number }> {
  const result = await client.flush();
  notify();
  return result;
}

export function subscribeOffline(listener: CountListener): () => void {
  listeners.add(listener);
  notify();
  return () => listeners.delete(listener);
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

export async function requeueFailedOffline(): Promise<number> {
  const count = await queue.requeueFailed();
  notify();
  return count;
}
