import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256 } from '@neuroos/runner';
import { createApp } from './app.js';

const tmpDirs: string[] = [];

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-stage7-'));
  tmpDirs.push(dir);
  return dir;
}

type TestApp = Awaited<ReturnType<typeof createApp>>['app'];

async function createProjectWithG5(app: TestApp, slug: string): Promise<string> {
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    payload: { name: 'Rel Project', slug },
  });
  const project = created.json() as { id: string };

  const installerContent = Buffer.from('fake-installer-binary');
  const checksumContent = Buffer.from(`${sha256(installerContent)}  installer.exe\n`);
  for (const [kind, filename, content] of [
    ['installer', 'installer.exe', installerContent],
    ['checksum', 'checksums.txt', checksumContent],
  ] as const) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/projects/${slug}/artifacts`,
      payload: {
        kind,
        version: '0.1.0',
        filename,
        contentBase64: content.toString('base64'),
      },
    });
    if (res.statusCode !== 201) {
      throw new Error(`artifact ${kind} registration failed: ${res.statusCode} ${res.body}`);
    }
  }

  const approved = await app.inject({
    method: 'POST',
    url: `/api/v1/projects/${slug}/gates/G5/approve`,
    payload: { approver: 'build_center' },
  });
  if (approved.statusCode !== 200) {
    throw new Error(`G5 approval failed: ${approved.statusCode} ${approved.body}`);
  }
  return project.id;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('STAGE 7: release hub', () => {
  it('registers a dev-channel release without gate requirements', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Dev', slug: 'dev-proj' } });
    const { id } = created.json() as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/releases',
      payload: { projectId: id, version: '0.1.0', channel: 'dev', notes: 'nightly' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json() as { version: string; channel: string; releasedAt?: string };
    expect(body.version).toBe('0.1.0');
    expect(body.channel).toBe('dev');
    expect(body.releasedAt).toBeTruthy();
    await app.close();
  });

  it('rejects a stable release without approved G5 and G6 (409 with missing list)', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Stable', slug: 'stable-proj' } });
    const { id } = created.json() as { id: string };

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/releases',
      payload: { projectId: id, version: '1.0.0', channel: 'stable', notes: '' },
    });
    expect(res.statusCode).toBe(409);
    const body = res.json() as { error: string; missing: string[] };
    expect(body.missing).toEqual(['G5', 'G6']);
    await app.close();
  });

  it('accepts a beta release after G5 is approved with installer and checksum artifacts', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const projectId = await createProjectWithG5(app, 'beta-proj');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/releases',
      payload: { projectId, version: '0.2.0', channel: 'beta', notes: 'beta channel' },
    });
    expect(res.statusCode).toBe(201);
    await app.close();
  });

  it('rejects duplicate version+channel and invalid input', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Dup', slug: 'dup-proj' } });
    const { id } = created.json() as { id: string };
    const payload = { projectId: id, version: '0.1.0', channel: 'dev', notes: '' };
    await app.inject({ method: 'POST', url: '/api/v1/releases', payload });

    const dup = await app.inject({ method: 'POST', url: '/api/v1/releases', payload });
    expect(dup.statusCode).toBe(409);

    const badVersion = await app.inject({
      method: 'POST',
      url: '/api/v1/releases',
      payload: { ...payload, version: 'not-semver' },
    });
    expect(badVersion.statusCode).toBe(400);

    const badChannel = await app.inject({
      method: 'POST',
      url: '/api/v1/releases',
      payload: { ...payload, version: '0.2.0', channel: 'nightly' },
    });
    expect(badChannel.statusCode).toBe(400);
    await app.close();
  });
});

describe('STAGE 7: update manager', () => {
  it('finds the latest version in a channel and reports update availability', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });
    const created = await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'Upd', slug: 'upd-proj' } });
    const { id } = created.json() as { id: string };
    for (const version of ['0.1.0', '0.2.0', '0.10.0']) {
      await app.inject({ method: 'POST', url: '/api/v1/releases', payload: { projectId: id, version, channel: 'dev', notes: '' } });
    }

    const outdated = await app.inject({ method: 'GET', url: '/api/v1/updates/latest?channel=dev&currentVersion=0.2.0' });
    expect(outdated.statusCode).toBe(200);
    const outdatedBody = outdated.json() as { latestVersion: string; updateAvailable: boolean };
    expect(outdatedBody.latestVersion).toBe('0.10.0');
    expect(outdatedBody.updateAvailable).toBe(true);

    const current = await app.inject({ method: 'GET', url: '/api/v1/updates/latest?channel=dev&currentVersion=0.10.0' });
    const currentBody = current.json() as { updateAvailable: boolean };
    expect(currentBody.updateAvailable).toBe(false);
    await app.close();
  });

  it('responds honestly when the channel is empty or input invalid', async () => {
    const dir = await makeDataDir();
    const { app } = await createApp({ persistPath: path.join(dir, 'state.json') });

    const empty = await app.inject({ method: 'GET', url: '/api/v1/updates/latest?channel=stable&currentVersion=0.1.0' });
    expect(empty.statusCode).toBe(404);

    const badChannel = await app.inject({ method: 'GET', url: '/api/v1/updates/latest?channel=nope&currentVersion=0.1.0' });
    expect(badChannel.statusCode).toBe(400);

    const badVersion = await app.inject({ method: 'GET', url: '/api/v1/updates/latest?channel=dev&currentVersion=abc' });
    expect(badVersion.statusCode).toBe(400);
    await app.close();
  });
});
