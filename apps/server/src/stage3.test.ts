import { describe, it, expect, afterAll } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createApp } from './app.js';
import { defaultState } from './store.js';

const tmpDirs: string[] = [];

async function makeDataDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'nf-stage3-'));
  tmpDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tmpDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function createProject(app: { inject: (opts: unknown) => Promise<{ json: () => unknown; statusCode: number }> }, slug = 'demo') {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/projects',
    payload: { name: 'Demo', slug },
  });
  return res.json() as { id: string };
}

describe('STAGE 3: gate endpoints', () => {
  it('lists 7 gate evaluations and blocks G0 without spec', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    await createProject(app);

    const res = await app.inject({ method: 'GET', url: '/api/v1/projects/demo/gates' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ code: string; eligible: boolean; missing: string[] }>; decisions: unknown[] };
    expect(body.items).toHaveLength(7);
    const g0 = body.items.find((g) => g.code === 'G0');
    expect(g0?.eligible).toBe(false);
    expect(g0?.missing).toContain('artifact:spec');
    expect(g0?.missing).toContain('check:acceptance_criteria_defined');
  });

  it('approves G0 only after spec artifact and criteria, owner-only', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    await createProject(app);

    const denied = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/gates/G0/approve',
      payload: { approver: 'owner' },
    });
    expect(denied.statusCode).toBe(409);

    await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { acceptanceCriteria: [{ id: 'AC-1', text: 'работает', status: 'TODO' }] },
    });
    const spec = 'Спецификация демо-проекта';
    await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: { kind: 'spec', version: '0.1.0', filename: 'spec.md', contentBase64: Buffer.from(spec, 'utf8').toString('base64'), sha256: sha256(spec) },
    });

    const wrongApprover = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/gates/G0/approve',
      payload: { approver: 'test_center' },
    });
    expect(wrongApprover.statusCode).toBe(409);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/gates/G0/approve',
      payload: { approver: 'owner' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ code: 'G0', status: 'approved', approver: 'owner' });

    const again = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/gates/G0/approve',
      payload: { approver: 'owner' },
    });
    expect(again.statusCode).toBe(200);

    const res = await app.inject({ method: 'GET', url: '/api/v1/projects/demo/gates' });
    const body = res.json() as { decisions: Array<{ code: string; status: string }> };
    expect(body.decisions).toHaveLength(1);
    expect(body.decisions[0]).toMatchObject({ code: 'G0', status: 'approved' });
  });

  it('rejects unknown gate code with 400', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    await createProject(app);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/gates/GX/approve',
      payload: { approver: 'owner' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('STAGE 3: RELEASED hard rule', () => {
  it('rejects RELEASED without G6 and allows after gates approved', async () => {
    const dataDir = await makeDataDir();
    const { app, store } = await createApp({ dataDir });
    const project = await createProject(app);

    const blocked = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { status: 'RELEASED' },
    });
    expect(blocked.statusCode).toBe(409);
    expect((blocked.json() as { error: string }).error).toContain('G6');

    for (const code of ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
      store.state.gates.push({
        id: `gate-${code}`,
        projectId: project.id,
        code: code as never,
        status: 'approved',
        approver: 'owner',
        decidedAt: new Date().toISOString(),
      });
    }
    await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: {
        acceptanceCriteria: [{ id: 'AC-1', text: 'работает', status: 'DONE' }],
      },
    });
    const allowed = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { status: 'RELEASED' },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json()).toMatchObject({ status: 'RELEASED' });
  });
});

describe('STAGE 3: artifact registry', () => {
  it('registers artifact with sha256 verification and writes file', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    await createProject(app);

    const content = '# Спецификация\n\nПолная.';
    const mismatch = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: { kind: 'spec', version: '0.1.0', filename: 'spec.md', contentBase64: Buffer.from(content, 'utf8').toString('base64'), sha256: 'deadbeef' },
    });
    expect(mismatch.statusCode).toBe(409);
    expect(mismatch.json()).toMatchObject({ computed: sha256(content) });

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: { kind: 'spec', version: '0.1.0', filename: 'spec.md', contentBase64: Buffer.from(content, 'utf8').toString('base64'), sha256: sha256(content) },
    });
    expect(ok.statusCode).toBe(201);
    const artifact = ok.json() as { sha256: string; storageKey: string; sizeBytes: number };
    expect(artifact.sha256).toBe(sha256(content));
    expect(artifact.storageKey).toContain('spec/0.1.0/spec.md');

    const stored = await readFile(path.join(dataDir, 'artifacts', artifact.storageKey), 'utf8');
    expect(stored).toBe(content);

    const badKind = await app.inject({
      method: 'POST',
      url: '/api/v1/projects/demo/artifacts',
      payload: { kind: 'unknown', version: '0.1.0', filename: 'x.txt', contentBase64: 'aGk=' },
    });
    expect(badKind.statusCode).toBe(400);
  });
});

describe('STAGE 3: job worker', () => {
  it('runs code_task → build_run → test_run pipeline and registers artifacts', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    const project = await createProject(app, 'pipeline');

    async function runJob(kind: string) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs',
        payload: { projectId: project.id, kind },
      });
      expect(created.statusCode).toBe(201);
      const job = created.json() as { id: string };
      const res = await app.inject({ method: 'POST', url: `/api/v1/jobs/${job.id}/run` });
      return res.json() as { job: { status: string; error?: string }; artifacts: Array<{ kind: string }>; logLines: string[] };
    }

    const code = await runJob('code_task');
    expect(code.job.status).toBe('done');
    expect(code.artifacts.some((a) => a.kind === 'source_ref')).toBe(true);

    const doubleRun = await app.inject({ method: 'POST', url: `/api/v1/jobs/x/run` });
    expect(doubleRun.statusCode).toBe(404);

    const build = await runJob('build_run');
    expect(build.job.status).toBe('done');
    expect(build.artifacts.some((a) => a.kind === 'build_log')).toBe(true);

    const test = await runJob('test_run');
    expect(test.job.status).toBe('done');
    expect(test.artifacts.some((a) => a.kind === 'test_report')).toBe(true);

    const gates = await app.inject({ method: 'GET', url: '/api/v1/projects/pipeline/gates' });
    const body = gates.json() as { items: Array<{ code: string; eligible: boolean; missing: string[] }> };
    const g2 = body.items.find((g) => g.code === 'G2');
    expect(g2?.eligible).toBe(true);
    const g3 = body.items.find((g) => g.code === 'G3');
    expect(g3?.eligible).toBe(true);
  });

  it('fails honestly for AI tasks without provider and unimplemented kinds', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({ dataDir });
    const project = await createProject(app, 'honest');

    async function runJob(kind: string) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/v1/jobs',
        payload: { projectId: project.id, kind },
      });
      const job = created.json() as { id: string };
      const res = await app.inject({ method: 'POST', url: `/api/v1/jobs/${job.id}/run` });
      return res.json() as { job: { status: string; error?: string } };
    }

    const ai = await runJob('ai_task');
    expect(ai.job.status).toBe('failed');
    expect(ai.job.error).toContain('AI-провайдер не подключён');

    const audit = await runJob('audit_run');
    expect(audit.job.status).toBe('failed');
    expect(audit.job.error).toContain('не реализована в STAGE 3');
  });

  it('uses injected aiComplete for spec_generate', async () => {
    const dataDir = await makeDataDir();
    const { app } = await createApp({
      dataDir,
      aiComplete: async (taskKind, prompt) => {
        if (taskKind !== 'spec_generate') return { ok: false, message: 'unsupported' };
        return { ok: true, text: `# Спецификация\n\n${prompt}` };
      },
    });
    const project = await createProject(app, 'ai-spec');
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      payload: { projectId: project.id, kind: 'spec_generate' },
    });
    const job = created.json() as { id: string };
    const res = await app.inject({ method: 'POST', url: `/api/v1/jobs/${job.id}/run` });
    const body = res.json() as { job: { status: string }; artifacts: Array<{ kind: string; sha256: string }> };
    expect(body.job.status).toBe('done');
    expect(body.artifacts[0]?.kind).toBe('spec');
    expect(body.artifacts[0]?.sha256).toHaveLength(64);
  });
});

describe('STAGE 3: state defaults', () => {
  it('defaultState includes empty gates array', () => {
    expect(defaultState().gates).toEqual([]);
  });
});
