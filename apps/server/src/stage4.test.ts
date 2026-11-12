import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';

const tmpDirs: string[] = [];

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-stage4-'));
  tmpDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('STAGE 4: persistence', () => {
  it('restores full state from snapshot after restart', async () => {
    const dir = await makeDataDir();
    const persistPath = path.join(dir, 'state', 'factory-state.json');

    const first = await createApp({ persistPath });
    await first.app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Persisted', slug: 'persisted' },
    });
    await first.app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/persisted',
      payload: { status: 'ANALYSIS' },
    });
    await first.flushPersistence();
    await first.app.close();

    const raw = JSON.parse(await readFile(persistPath, 'utf8')) as { projects: Array<{ slug: string }> };
    expect(raw.projects).toHaveLength(1);

    const second = await createApp({ persistPath });
    const res = await second.app.inject({ method: 'GET', url: '/api/v1/projects/persisted' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { status: string; revision?: number } };
    expect(body.project.status).toBe('ANALYSIS');
    expect(body.project.revision).toBe(2);
    await second.app.close();
  });

  it('starts with default state when snapshot is missing', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'missing', 'state.json') });
    const res = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(res.json().items).toHaveLength(0);
  });
});

describe('STAGE 4: revisions', () => {
  it('bumps revision on create and every patch', async () => {
    const { app } = await createApp();
    await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'R', slug: 'r' } });
    const p1 = (await (await app.inject({ method: 'GET', url: '/api/v1/projects/r' })).json()) as { project: { revision?: number } };
    expect(p1.project.revision).toBe(1);
    await app.inject({ method: 'PATCH', url: '/api/v1/projects/r', payload: { name: 'R2' } });
    await app.inject({ method: 'PATCH', url: '/api/v1/projects/r', payload: { currentStage: 1 } });
    const p2 = (await (await app.inject({ method: 'GET', url: '/api/v1/projects/r' })).json()) as { project: { revision?: number } };
    expect(p2.project.revision).toBe(3);
  });
});

describe('STAGE 4: POST /api/v1/sync', () => {
  it('applies, deduplicates and rejects operations', async () => {
    const { app } = await createApp();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: {
        operations: [
          { id: 'op-1', kind: 'create_project', payload: { name: 'Synced', slug: 'synced' } },
          { id: 'op-1', kind: 'create_project', payload: { name: 'Synced', slug: 'synced' } },
          { id: 'op-2', kind: 'patch_project', payload: { slug: 'synced', name: 'Synced v2' } },
          { id: 'op-3', kind: 'unknown_kind', payload: {} },
          { id: 'op-4', kind: 'patch_project', payload: { slug: 'ghost', name: 'x' } },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      results: Array<{ id: string; outcome: string; detail?: string; project?: { revision?: number } }>;
    };
    expect(body.results[0]).toMatchObject({ id: 'op-1', outcome: 'applied' });
    expect(body.results[0].project?.revision).toBe(1);
    expect(body.results[1]).toMatchObject({ id: 'op-1', outcome: 'duplicate' });
    expect(body.results[2]).toMatchObject({ id: 'op-2', outcome: 'applied' });
    expect(body.results[2].project?.revision).toBe(2);
    expect(body.results[3]).toMatchObject({ id: 'op-3', outcome: 'rejected' });
    expect(body.results[4]).toMatchObject({ id: 'op-4', outcome: 'rejected', detail: 'project not found' });

    const list = await app.inject({ method: 'GET', url: '/api/v1/projects/synced' });
    expect((list.json() as { project: { name: string } }).project.name).toBe('Synced v2');
  });

  it('returns conflict for stale baseRevision and applies fresh one', async () => {
    const { app } = await createApp();
    await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'C', slug: 'c' } });
    await app.inject({ method: 'PATCH', url: '/api/v1/projects/c', payload: { name: 'Server edit' } });

    const stale = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: {
        operations: [{ id: 'stale-1', kind: 'patch_project', payload: { slug: 'c', name: 'Client edit', baseRevision: 1 } }],
      },
    });
    const staleBody = stale.json() as { results: Array<{ outcome: string; server?: { revision?: number; name: string } }> };
    expect(staleBody.results[0].outcome).toBe('conflict');
    expect(staleBody.results[0].server?.name).toBe('Server edit');
    expect(staleBody.results[0].server?.revision).toBe(2);

    const fresh = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: {
        operations: [{ id: 'fresh-1', kind: 'patch_project', payload: { slug: 'c', name: 'Client edit', baseRevision: 2 } }],
      },
    });
    expect(fresh.json().results[0].outcome).toBe('applied');
  });

  it('validates payload and requires operations array', async () => {
    const { app } = await createApp();
    const missing = await app.inject({ method: 'POST', url: '/api/v1/sync', payload: {} });
    expect(missing.statusCode).toBe(400);

    const badCreate = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: { operations: [{ id: 'x', kind: 'create_project', payload: { name: 'No slug' } }] },
    });
    expect(badCreate.json().results[0]).toMatchObject({ outcome: 'rejected', detail: 'name and slug are required' });

    const released = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: { operations: [{ id: 'y', kind: 'create_project', payload: { name: 'Y', slug: 'y' } }] },
    });
    expect(released.json().results[0].outcome).toBe('applied');
    const patch = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: { operations: [{ id: 'z', kind: 'patch_project', payload: { slug: 'y', status: 'RELEASED', baseRevision: 1 } }] },
    });
    expect(patch.json().results[0]).toMatchObject({ outcome: 'rejected', detail: 'RELEASED requires G6 approved' });
  });
});
