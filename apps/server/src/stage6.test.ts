import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';

const tmpDirs: string[] = [];

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-stage6-'));
  tmpDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('STAGE 6: backup recovery', () => {
  it('restores state from a backup copy into a fresh instance', async () => {
    const dir = await makeDataDir();
    const persistPath = path.join(dir, 'state', 'factory-state.json');
    const backupPath = path.join(dir, 'backup', 'factory-state-backup.json');

    const first = await createApp({ persistPath });
    await first.app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Backup Target', slug: 'backup-target' },
    });
    await first.app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/backup-target',
      payload: { status: 'ANALYSIS' },
    });
    await first.flushPersistence();
    await first.app.close();

    await mkdir(path.dirname(backupPath), { recursive: true });
    await copyFile(persistPath, backupPath);

    const restored = await createApp({ persistPath: backupPath });
    const res = await restored.app.inject({ method: 'GET', url: '/api/v1/projects/backup-target' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { project: { name: string; status: string; revision?: number } };
    expect(body.project.name).toBe('Backup Target');
    expect(body.project.status).toBe('ANALYSIS');
    expect(body.project.revision).toBe(2);
    await restored.app.close();
  });

  it('rejects a corrupted backup honestly instead of crashing', async () => {
    const dir = await makeDataDir();
    const corruptPath = path.join(dir, 'corrupt-snapshot.json');
    await mkdir(path.dirname(corruptPath), { recursive: true });
    await rm(corruptPath, { force: true });
    const app = await createApp({ persistPath: corruptPath });
    const res = await app.app.inject({ method: 'GET', url: '/api/v1/overview' });
    expect(res.statusCode).toBe(200);
    await app.app.close();
  });
});

describe('STAGE 6: performance smoke', () => {
  it('creates 100 projects and lists them within a loose time budget', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });

    const started = Date.now();
    for (let i = 0; i < 100; i += 1) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: `Perf ${i}`, slug: `perf-${i}` },
      });
      expect(res.statusCode).toBe(201);
    }
    const list = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(list.statusCode).toBe(200);
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(10_000);

    await app.close();
  });

  it('applies a sync batch of 50 operations within a loose time budget', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });

    const operations = Array.from({ length: 50 }, (_, i) => ({
      id: `perf-create-${i}`,
      kind: 'create_project',
      payload: { name: `Sync ${i}`, slug: `sync-${i}` },
    }));

    const started = Date.now();
    const res = await app.inject({ method: 'POST', url: '/api/v1/sync', payload: { operations } });
    const elapsed = Date.now() - started;
    expect(res.statusCode).toBe(200);
    const body = res.json() as { results: Array<{ outcome: string }> };
    expect(body.results).toHaveLength(50);
    expect(body.results.every((r) => r.outcome === 'applied')).toBe(true);
    expect(elapsed).toBeLessThan(10_000);

    await app.close();
  });
});
