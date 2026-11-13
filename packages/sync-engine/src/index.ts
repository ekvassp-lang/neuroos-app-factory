export interface KVAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export class MemoryKV implements KVAdapter {
  private map = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.map.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}

export class LocalStorageKV implements KVAdapter {
  constructor(private prefix = 'nf-kv:') {}

  private full(key: string): string {
    return this.prefix + key;
  }

  async get(key: string): Promise<string | null> {
    return localStorage.getItem(this.full(key));
  }

  async set(key: string, value: string): Promise<void> {
    localStorage.setItem(this.full(key), value);
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.full(key));
  }

  async keys(): Promise<string[]> {
    const result: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.prefix)) result.push(key.slice(this.prefix.length));
    }
    return result;
  }
}

export type QueuedOperationStatus = 'pending' | 'synced' | 'conflict' | 'failed';

export interface QueuedOperation {
  id: string;
  kind: string;
  payload: unknown;
  baseRevision?: number;
  createdAt: string;
  attempts: number;
  status: QueuedOperationStatus;
  lastError?: string;
}

const QUEUE_PREFIX = 'op:';

export class OperationQueue {
  constructor(private adapter: KVAdapter) {}

  private async load(id: string): Promise<QueuedOperation | null> {
    const raw = await this.adapter.get(QUEUE_PREFIX + id);
    return raw ? (JSON.parse(raw) as QueuedOperation) : null;
  }

  private async save(op: QueuedOperation): Promise<void> {
    await this.adapter.set(QUEUE_PREFIX + op.id, JSON.stringify(op));
  }

  async enqueue(
    input: { id: string; kind: string; payload: unknown; baseRevision?: number },
    now = new Date().toISOString(),
  ): Promise<{ queued: boolean; operation: QueuedOperation }> {
    const existing = await this.load(input.id);
    if (existing) {
      return { queued: false, operation: existing };
    }
    const operation: QueuedOperation = {
      id: input.id,
      kind: input.kind,
      payload: input.payload,
      baseRevision: input.baseRevision,
      createdAt: now,
      attempts: 0,
      status: 'pending',
    };
    await this.save(operation);
    return { queued: true, operation };
  }

  async list(): Promise<QueuedOperation[]> {
    const keys = (await this.adapter.keys()).filter((k) => k.startsWith(QUEUE_PREFIX));
    const ops: QueuedOperation[] = [];
    for (const key of keys) {
      const raw = await this.adapter.get(key);
      if (raw) ops.push(JSON.parse(raw) as QueuedOperation);
    }
    return ops.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async pending(): Promise<QueuedOperation[]> {
    return (await this.list()).filter((op) => op.status === 'pending' || op.status === 'conflict');
  }

  async pendingCount(): Promise<number> {
    return (await this.pending()).length;
  }

  async markAttempted(id: string, error?: string): Promise<void> {
    const op = await this.load(id);
    if (!op) return;
    op.attempts += 1;
    op.lastError = error;
    if (error) op.status = 'failed';
    await this.save(op);
  }

  async markSynced(id: string): Promise<void> {
    const op = await this.load(id);
    if (!op) return;
    op.status = 'synced';
    op.lastError = undefined;
    await this.save(op);
  }

  async markConflict(id: string): Promise<void> {
    const op = await this.load(id);
    if (!op) return;
    op.status = 'conflict';
    await this.save(op);
  }

  async requeueFailed(): Promise<number> {
    const ops = await this.list();
    let count = 0;
    for (const op of ops) {
      if (op.status === 'failed') {
        op.status = 'pending';
        await this.save(op);
        count += 1;
      }
    }
    return count;
  }

  async clearSynced(): Promise<number> {
    const ops = await this.list();
    let count = 0;
    for (const op of ops) {
      if (op.status === 'synced') {
        await this.adapter.delete(QUEUE_PREFIX + op.id);
        count += 1;
      }
    }
    return count;
  }
}

export interface Versioned {
  updatedAt: string;
  revision?: number;
}

export type LWWWinner = 'local' | 'remote';

export function resolveLWW<T extends Versioned>(local: T, remote: T): LWWWinner {
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (remoteTime !== localTime) return remoteTime > localTime ? 'remote' : 'local';
  const localRev = local.revision ?? 0;
  const remoteRev = remote.revision ?? 0;
  if (remoteRev !== localRev) return remoteRev > localRev ? 'remote' : 'local';
  return 'remote';
}

export type SyncOutcome = 'applied' | 'duplicate' | 'conflict' | 'rejected';

export interface SyncTransportResult {
  outcome: SyncOutcome;
  server?: Versioned;
  detail?: string;
}

export type SyncTransport = (operation: QueuedOperation) => Promise<SyncTransportResult>;

export type ConflictResolver = (local: QueuedOperation, server: Versioned) => Promise<'keep_local' | 'accept_server'>;

export interface SyncClientEvents {
  onFlushed?: (synced: number, conflicts: number, failed: number) => void;
  onConflict?: (operation: QueuedOperation, server: Versioned, resolution: 'keep_local' | 'accept_server') => void;
}

export class SyncClient {
  online = true;

  constructor(
    private transport: SyncTransport,
    private queue: OperationQueue,
    private resolver: ConflictResolver = async () => 'accept_server',
    private events: SyncClientEvents = {},
  ) {}

  async flush(): Promise<{ synced: number; conflicts: number; failed: number }> {
    if (!this.online) return { synced: 0, conflicts: 0, failed: 0 };
    let synced = 0;
    let conflicts = 0;
    let failed = 0;
    for (const op of await this.queue.pending()) {
      if (!this.online) break;
      try {
        const result = await this.transport(op);
        if (result.outcome === 'applied' || result.outcome === 'duplicate') {
          await this.queue.markSynced(op.id);
          synced += 1;
        } else if (result.outcome === 'conflict' && result.server) {
          const resolution = await this.resolver(op, result.server);
          if (resolution === 'accept_server') {
            await this.queue.markSynced(op.id);
            synced += 1;
          } else {
            await this.queue.markConflict(op.id);
            conflicts += 1;
          }
          this.events.onConflict?.(op, result.server, resolution);
        } else {
          await this.queue.markAttempted(op.id, result.detail ?? 'rejected');
          failed += 1;
        }
      } catch (error) {
        await this.queue.markAttempted(op.id, error instanceof Error ? error.message : String(error));
        failed += 1;
      }
    }
    this.events.onFlushed?.(synced, conflicts, failed);
    return { synced, conflicts, failed };
  }

  goOffline(): void {
    this.online = false;
  }

  goOnline(): Promise<{ synced: number; conflicts: number; failed: number }> {
    this.online = true;
    return this.flush();
  }
}
