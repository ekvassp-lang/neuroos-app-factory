import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, parseAuthTokens, type AuthRole } from './app.js';

const tmpDirs: string[] = [];

async function makeApp(tokens: Record<string, AuthRole>) {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-auth-'));
  tmpDirs.push(dir);
  return createApp({ persistPath: path.join(dir, 'state.json'), authTokens: tokens });
}

function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('STAGE 8+: auth tokens parsing', () => {
  it('parses token:role pairs and ignores malformed entries', () => {
    const tokens = parseAuthTokens(' abc:owner ,def:viewer,,bad,gh:admin ');
    expect(tokens).toEqual({ abc: 'owner', def: 'viewer' });
    expect(parseAuthTokens(undefined)).toEqual({});
  });
});

describe('STAGE 8+: auth disabled (open mode)', () => {
  it('allows all operations and reports auth disabled honestly', async () => {
    const { app } = await makeApp({});
    const health = await app.inject({ method: 'GET', url: '/healthz' });
    expect(health.json()).toMatchObject({ auth: 'disabled' });
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Open', slug: 'open' } });
    expect(created.statusCode).toBe(201);
    await app.close();
  });
});

describe('STAGE 8+: role matrix', () => {
  const tokens = { ownerTok: 'owner' as const, engTok: 'engineer' as const, viewTok: 'viewer' as const };

  it('rejects missing and unknown tokens with 401', async () => {
    const { app } = await makeApp(tokens);
    const noToken = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(noToken.statusCode).toBe(401);
    const unknown = await app.inject({ method: 'GET', url: '/api/v1/projects', headers: authHeader('nope') });
    expect(unknown.statusCode).toBe(401);
    await app.close();
  });

  it('viewer is read-only: GET ok, mutations 403', async () => {
    const { app } = await makeApp(tokens);
    const list = await app.inject({ method: 'GET', url: '/api/v1/projects', headers: authHeader('viewTok') });
    expect(list.statusCode).toBe(200);
    const create = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'V', slug: 'v' }, headers: authHeader('viewTok') });
    expect(create.statusCode).toBe(403);
    const settings = await app.inject({ method: 'PUT', url: '/api/v1/settings', payload: {}, headers: authHeader('viewTok') });
    expect(settings.statusCode).toBe(403);
    await app.close();
  });

  it('engineer performs work operations but not gate decisions, releases or settings', async () => {
    const { app } = await makeApp(tokens);
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Eng', slug: 'eng' }, headers: authHeader('engTok') });
    expect(created.statusCode).toBe(201);
    const { id } = created.json() as { id: string };

    const job = await app.inject({ method: 'POST', url: '/api/v1/jobs', payload: { projectId: id, kind: 'code_task' }, headers: authHeader('engTok') });
    expect(job.statusCode).toBe(201);

    const approve = await app.inject({ method: 'POST', url: '/api/v1/projects/eng/gates/G0/approve', payload: { approver: 'engineer' }, headers: authHeader('engTok') });
    expect(approve.statusCode).toBe(403);
    expect((approve.json() as { error: string }).error).toContain('owner');

    const release = await app.inject({ method: 'POST', url: '/api/v1/releases', payload: { projectId: id, version: '0.1.0', channel: 'dev' }, headers: authHeader('engTok') });
    expect(release.statusCode).toBe(403);

    const settings = await app.inject({ method: 'PUT', url: '/api/v1/settings', payload: {}, headers: authHeader('engTok') });
    expect(settings.statusCode).toBe(403);
    await app.close();
  });

  it('owner can do everything including gate decisions and releases', async () => {
    const { app } = await makeApp(tokens);
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Own', slug: 'own' },
      headers: authHeader('ownerTok'),
    });
    const { id } = created.json() as { id: string };

    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/own',
      payload: { acceptanceCriteria: [{ id: 'AC-1', title: 'works', status: 'DONE' }] },
      headers: authHeader('ownerTok'),
    });
    expect(patched.statusCode).toBe(200);

    const spec = 'Спецификация проекта own';
    const artifact = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/own/artifacts',
      payload: { kind: 'spec', version: '0.1.0', filename: 'spec.md', contentBase64: Buffer.from(spec, 'utf8').toString('base64') },
      headers: authHeader('ownerTok'),
    });
    expect(artifact.statusCode).toBe(201);

    const approve = await app.inject({ method: 'POST', url: '/api/v1/projects/own/gates/G0/approve', payload: { approver: 'owner' }, headers: authHeader('ownerTok') });
    expect(approve.statusCode).toBe(200);

    const release = await app.inject({ method: 'POST', url: '/api/v1/releases', payload: { projectId: id, version: '0.1.0', channel: 'dev' }, headers: authHeader('ownerTok') });
    expect(release.statusCode).toBe(201);
    await app.close();
  });

  it('healthz stays open for probes while API is protected', async () => {
    const { app } = await makeApp(tokens);
    const health = await app.inject({ method: 'GET', url: '/healthz' });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ auth: 'enabled' });
    await app.close();
  });
});
