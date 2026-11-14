import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import { sha256 } from '@neuroos/runner';

const tmpDirs: string[] = [];

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-artifact-'));
  tmpDirs.push(dir);
  const { app, store } = await createApp({ dataDir: path.join(dir, 'data') });
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    payload: { name: 'Demo', slug: 'demo' },
  });
  const project = created.json() as { id: string };
  return { app, store, projectId: project.id };
}

describe('STAGE 8+: artifact file download with SHA-256 verification', () => {
  it('serves the uploaded file with integrity headers', async () => {
    const { app } = await setup();
    const content = Buffer.from('installer-bytes-123', 'utf8');
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: {
        kind: 'installer',
        version: '0.1.0',
        filename: 'app-0.1.0.exe',
        contentBase64: content.toString('base64'),
        sha256: sha256(content),
      },
    });
    expect(upload.statusCode).toBe(201);
    const artifact = upload.json() as { id: string; sha256: string };

    const res = await app.inject({ method: 'GET', url: `/api/v1/artifacts/${artifact.id}/download` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['content-disposition']).toContain('app-0.1.0.exe');
    expect(res.headers['x-artifact-sha256']).toBe(artifact.sha256);
    expect(res.rawPayload).toEqual(content);
    await app.close();
  });

  it('returns 404 for unknown artifact id', async () => {
    const { app } = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/v1/artifacts/00000000-0000-0000-0000-000000000000/download' });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: string }).error).toBe('artifact not found');
    await app.close();
  });

  it('returns honest 404 when the file is missing on disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nf-artifact-'));
    tmpDirs.push(dir);
    const { app } = await createApp({ dataDir: path.join(dir, 'data') });
    await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo', slug: 'demo' },
    });
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: {
        kind: 'build_log',
        version: '0.1.0',
        filename: 'build.log',
        contentBase64: Buffer.from('log').toString('base64'),
      },
    });
    const artifact = upload.json() as { id: string; projectId: string; kind: string; version: string };
    const file = path.join(dir, 'data', 'artifacts', artifact.projectId, artifact.kind, artifact.version, 'build.log');
    await readFile(file, 'utf8');
    await rm(path.dirname(file), { recursive: true, force: true });

    const res = await app.inject({ method: 'GET', url: `/api/v1/artifacts/${artifact.id}/download` });
    expect(res.statusCode).toBe(404);
    expect((res.json() as { error: string }).error).toBe('artifact file not found on disk');
    await app.close();
  });

  it('returns 409 when the file on disk does not match the recorded sha256', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nf-artifact-'));
    tmpDirs.push(dir);
    const { app } = await createApp({ dataDir: path.join(dir, 'data') });
    await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo', slug: 'demo' },
    });
    const content = Buffer.from('original', 'utf8');
    const upload = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: {
        kind: 'checksum',
        version: '0.1.0',
        filename: 'sums.txt',
        contentBase64: content.toString('base64'),
        sha256: sha256(content),
      },
    });
    const artifact = upload.json() as { id: string; projectId: string; kind: string; version: string };
    const file = path.join(dir, 'data', 'artifacts', artifact.projectId, artifact.kind, artifact.version, 'sums.txt');
    await writeFile(file, 'tampered');

    const res = await app.inject({ method: 'GET', url: `/api/v1/artifacts/${artifact.id}/download` });
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string; declared: string; computed: string };
    expect(body.error).toBe('sha256 mismatch on download');
    expect(body.declared).toBe(sha256(content));
    expect(body.computed).toBe(sha256(Buffer.from('tampered', 'utf8')));
    await app.close();
  });
});
