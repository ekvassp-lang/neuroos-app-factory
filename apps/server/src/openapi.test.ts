import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';

interface Spec {
  info: { version: string };
  paths: Record<string, Record<string, unknown>>;
}

const tmpDirs: string[] = [];

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function fillParams(url: string): string {
  return url
    .replace('{slug}', 'demo')
    .replace('{code}', 'G0')
    .replace('{id}', '00000000-0000-0000-0000-000000000000');
}

describe('OpenAPI spec vs live routes', () => {
  it('documents API v0.8.0 with bearer auth scheme', async () => {
    const spec = JSON.parse(await readFile(path.join(process.cwd(), '../../docs/openapi.json'), 'utf8')) as Spec;
    expect(spec.info.version).toBe('0.8.0');
    expect(JSON.stringify(spec)).toContain('bearerAuth');
    expect(Object.keys(spec.paths).length).toBeGreaterThanOrEqual(17);
  });

  it('every documented path+method exists on the server (no route-404)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nf-openapi-'));
    tmpDirs.push(dir);
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const spec = JSON.parse(await readFile(path.join(process.cwd(), '../../docs/openapi.json'), 'utf8')) as Spec;

    const mismatches: string[] = [];
    for (const [rawPath, methods] of Object.entries(spec.paths)) {
      if (rawPath === '/ws') continue;
      const url = fillParams(rawPath);
      for (const method of Object.keys(methods)) {
        if (method === 'parameters') continue;
        const res = await app.inject({ method: method.toUpperCase() as 'GET', url });
        if (res.statusCode === 404) {
          let body: { error?: string; message?: string } = {};
          try {
            body = res.json() as { error?: string; message?: string };
          } catch {
            mismatches.push(`${method.toUpperCase()} ${rawPath} -> 404 with non-JSON body (route not found)`);
            continue;
          }
          if (body.error === 'Not Found' || body.message?.includes('Route ')) {
            mismatches.push(`${method.toUpperCase()} ${rawPath} -> route not found`);
          }
        }
      }
    }
    await app.close();
    expect(mismatches).toEqual([]);
  });

  it('GET /api/v1/openapi.json serves the spec and stays open when auth is enabled', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'nf-openapi-'));
    tmpDirs.push(dir);
    const { app } = await createApp({
      persistPath: path.join(dir, 'state.json'),
      authTokens: { 'owner-token': 'owner' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const served = JSON.parse(res.payload) as Spec;
    expect(served.info.version).toBe('0.8.0');
    expect(Object.keys(served.paths)).toContain('/api/v1/openapi.json');
    await app.close();
  });

  it('every /api/v1 route is documented in the spec (probe of known routes)', async () => {
    const spec = JSON.parse(await readFile(path.join(process.cwd(), '../../docs/openapi.json'), 'utf8')) as Spec;
    const documented = new Set(Object.keys(spec.paths));
    const required = [
      '/healthz',
      '/api/v1/overview',
      '/api/v1/openapi.json',
      '/api/v1/projects',
      '/api/v1/projects/{slug}',
      '/api/v1/projects/{slug}/gates',
      '/api/v1/projects/{slug}/gates/{code}/approve',
      '/api/v1/projects/{slug}/gates/{code}/reject',
      '/api/v1/projects/{slug}/artifacts',
      '/api/v1/artifacts',
      '/api/v1/artifacts/{id}/download',
      '/api/v1/events',
      '/api/v1/jobs',
      '/api/v1/jobs/{id}/run',
      '/api/v1/jobs/{id}/cancel',
      '/api/v1/sync',
      '/api/v1/releases',
      '/api/v1/updates/latest',
      '/api/v1/settings',
      '/ws',
    ];
    const missing = required.filter((route) => !documented.has(route));
    expect(missing).toEqual([]);
  });
});
