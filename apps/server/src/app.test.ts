import { describe, it, expect } from 'vitest';
import { createApp } from './app.js';
import { createBroadcaster } from './broadcaster.js';
import { defaultState } from './store.js';

describe('server API', () => {
  it('reports health', async () => {
    const { app } = await createApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('creates and lists projects with validation', async () => {
    const { app } = await createApp();
    const bad = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: {},
    });
    expect(bad.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo Product', slug: 'demo-product' },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ status: 'IDEA', currentStage: 0 });

    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo Product', slug: 'demo-product' },
    });
    expect(dup.statusCode).toBe(409);

    const list = await app.inject({ method: 'GET', url: '/api/v1/projects' });
    expect(list.json().items).toHaveLength(1);
  });

  it('returns project details with lifecycle events', async () => {
    const { app } = await createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo', slug: 'demo' },
    });
    const project = created.json();

    const detail = await app.inject({ method: 'GET', url: '/api/v1/projects/demo' });
    expect(detail.statusCode).toBe(200);
    const body = detail.json();
    expect(body.project.id).toBe(project.id);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ reason: 'project.created', toStatus: 'IDEA' });

    const missing = await app.inject({ method: 'GET', url: '/api/v1/projects/nope' });
    expect(missing.statusCode).toBe(404);
  });

  it('patches project status and records a lifecycle event', async () => {
    const { app } = await createApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo', slug: 'demo' },
    });

    const invalid = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { status: 'NOT_A_STATUS' },
    });
    expect(invalid.statusCode).toBe(400);

    const badStage = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { currentStage: 9 },
    });
    expect(badStage.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'PATCH',
      url: '/api/v1/projects/demo',
      payload: { status: 'ANALYSIS', currentStage: 1 },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ status: 'ANALYSIS', currentStage: 1 });

    const events = await app.inject({ method: 'GET', url: '/api/v1/events' });
    const items = events.json().items;
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ fromStatus: 'IDEA', toStatus: 'ANALYSIS', reason: 'status.changed' });
  });

  it('provides overview aggregates', async () => {
    const { app } = await createApp();
    await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'A', slug: 'a' } });
    await app.inject({ method: 'POST', url: '/api/v1/projects', payload: { name: 'B', slug: 'b' } });

    const res = await app.inject({ method: 'GET', url: '/api/v1/overview' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totals.projects).toBe(2);
    expect(body.totals.events).toBe(2);
    expect(body.byStatus).toMatchObject({ IDEA: 2 });
    expect(body.recentEvents).toHaveLength(2);
  });

  it('creates jobs with validation and idempotency', async () => {
    const { app } = await createApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/projects',
      payload: { name: 'Demo', slug: 'demo' },
    });
    const projectId = created.json().id;

    const noProject = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      payload: { projectId: 'missing', kind: 'build_run' },
    });
    expect(noProject.statusCode).toBe(404);

    const badKind = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      payload: { projectId, kind: 'deploy_everything' },
    });
    expect(badKind.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      payload: { projectId, kind: 'build_run', idempotencyKey: 'key-1' },
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toMatchObject({ status: 'queued', attempts: 0 });

    const dup = await app.inject({
      method: 'POST',
      url: '/api/v1/jobs',
      payload: { projectId, kind: 'build_run', idempotencyKey: 'key-1' },
    });
    expect(dup.statusCode).toBe(409);

    const jobId = ok.json().id;
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${jobId}/cancel`,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toMatchObject({ status: 'cancelled' });

    const recancel = await app.inject({
      method: 'POST',
      url: `/api/v1/jobs/${jobId}/cancel`,
    });
    expect(recancel.statusCode).toBe(409);
  });

  it('reads and updates settings with validation', async () => {
    const { app } = await createApp();
    const initial = await app.inject({ method: 'GET', url: '/api/v1/settings' });
    expect(initial.json()).toMatchObject({ theme: 'dark', aiEnabled: false });

    const bad = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      payload: { theme: 'solarized' },
    });
    expect(bad.statusCode).toBe(400);

    const ok = await app.inject({
      method: 'PUT',
      url: '/api/v1/settings',
      payload: { theme: 'light', offlineModeEnabled: true },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ theme: 'light', offlineModeEnabled: true });
  });

  it('serves empty artifact and release registries honestly', async () => {
    const { app } = await createApp();
    const artifacts = await app.inject({ method: 'GET', url: '/api/v1/artifacts' });
    expect(artifacts.statusCode).toBe(200);
    expect(artifacts.json().items).toEqual([]);

    const releases = await app.inject({ method: 'GET', url: '/api/v1/releases' });
    expect(releases.statusCode).toBe(200);
    expect(releases.json().items).toEqual([]);
  });
});

describe('broadcaster', () => {
  it('delivers state events to subscribed senders', () => {
    const broadcaster = createBroadcaster();
    const received: string[] = [];
    const sender = (data: string) => received.push(data);
    broadcaster.add(sender);
    expect(broadcaster.connectionCount()).toBe(1);

    const state = defaultState();
    broadcaster.publish({ type: 'project.created', payload: { id: 'p1' } }, state);
    expect(received).toHaveLength(1);
    const message = JSON.parse(received[0]);
    expect(message.event.type).toBe('project.created');
    expect(message.snapshot.projects).toBe(0);

    broadcaster.remove(sender);
    expect(broadcaster.connectionCount()).toBe(0);
  });
});
