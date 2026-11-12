import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import type { FactorySettings, Job, Project } from '@neuroos/core-contracts';
import {
  createBroadcaster,
  type Broadcaster,
} from './broadcaster.js';
import {
  createStore,
  defaultState,
  JOB_KINDS,
  LIFECYCLE_STATUSES,
  type FactoryState,
} from './store.js';

const PLATFORMS = ['web', 'pwa', 'windows', 'macos', 'linux', 'android', 'ios'] as const;

export interface CreateAppOptions {
  state?: FactoryState;
  broadcaster?: Broadcaster;
}

export async function createApp(options: CreateAppOptions = {}) {
  const store = createStore(options.state ?? defaultState());
  const broadcaster = options.broadcaster ?? createBroadcaster();
  const { state } = store;

  const app = Fastify({ logger: false });
  await app.register(websocket);

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'neuroos-app-factory-server',
    version: '0.2.0',
  }));

  app.get('/api/v1/overview', async () => {
    const byStatus: Record<string, number> = {};
    for (const project of state.projects) {
      byStatus[project.status] = (byStatus[project.status] ?? 0) + 1;
    }
    return {
      totals: {
        projects: state.projects.length,
        jobs: state.jobs.length,
        artifacts: state.artifacts.length,
        releases: state.releases.length,
        events: state.events.length,
      },
      byStatus,
      recentEvents: state.events.slice(-10).reverse(),
    };
  });

  app.get('/api/v1/projects', async () => ({ items: state.projects }));

  app.post<{ Body: { name?: string; slug?: string } }>('/api/v1/projects', async (req, reply) => {
    const { name, slug } = req.body ?? {};
    if (!name || !slug) {
      return reply.code(400).send({ error: 'name and slug are required' });
    }
    if (state.projects.some((p) => p.slug === slug)) {
      return reply.code(409).send({ error: 'slug already exists' });
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      slug,
      status: 'IDEA',
      targetPlatforms: [...state.settings.defaultPlatforms],
      currentStage: 0,
      acceptanceCriteria: [],
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(project);
    store.addLifecycleEvent(project.id, 'IDEA', 'IDEA', 'project.created');
    broadcaster.publish({ type: 'project.created', payload: project }, state);
    return reply.code(201).send(project);
  });

  app.get<{ Params: { slug: string } }>('/api/v1/projects/:slug', async (req, reply) => {
    const project = state.projects.find((p) => p.slug === req.params.slug);
    if (!project) {
      return reply.code(404).send({ error: 'project not found' });
    }
    return {
      project,
      events: state.events.filter((e) => e.projectId === project.id).reverse(),
      jobs: state.jobs.filter((j) => j.projectId === project.id).reverse(),
    };
  });

  app.patch<{ Params: { slug: string }; Body: Partial<Project> }>(
    '/api/v1/projects/:slug',
    async (req, reply) => {
      const project = state.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const body = req.body ?? {};
      if (body.status !== undefined && !LIFECYCLE_STATUSES.includes(body.status)) {
        return reply.code(400).send({ error: 'unknown lifecycle status' });
      }
      if (
        body.currentStage !== undefined &&
        (!Number.isInteger(body.currentStage) || body.currentStage < 0 || body.currentStage > 8)
      ) {
        return reply.code(400).send({ error: 'currentStage must be an integer 0..8' });
      }
      const fromStatus = project.status;
      if (body.name !== undefined) project.name = body.name;
      if (body.status !== undefined) project.status = body.status;
      if (body.currentStage !== undefined) project.currentStage = body.currentStage;
      if (body.acceptanceCriteria !== undefined) project.acceptanceCriteria = body.acceptanceCriteria;
      if (body.targetPlatforms !== undefined) {
        if (body.targetPlatforms.some((p) => !PLATFORMS.includes(p))) {
          return reply.code(400).send({ error: 'unknown platform' });
        }
        project.targetPlatforms = body.targetPlatforms;
      }
      project.updatedAt = new Date().toISOString();
      if (body.status !== undefined && body.status !== fromStatus) {
        store.addLifecycleEvent(project.id, fromStatus, body.status, 'status.changed', 'api');
      }
      broadcaster.publish({ type: 'project.updated', payload: project }, state);
      return project;
    },
  );

  app.get<{ Querystring: { projectId?: string } }>('/api/v1/events', async (req) => {
    const items = req.query.projectId
      ? state.events.filter((e) => e.projectId === req.query.projectId)
      : state.events;
    return { items: [...items].reverse() };
  });

  app.get('/api/v1/jobs', async () => ({ items: state.jobs }));

  app.post<{ Body: { projectId?: string; kind?: string; idempotencyKey?: string } }>(
    '/api/v1/jobs',
    async (req, reply) => {
      const { projectId, kind, idempotencyKey } = req.body ?? {};
      if (!projectId || !kind) {
        return reply.code(400).send({ error: 'projectId and kind are required' });
      }
      if (!JOB_KINDS.includes(kind as Job['kind'])) {
        return reply.code(400).send({ error: 'unknown job kind' });
      }
      const project = state.projects.find((p) => p.id === projectId);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const key = idempotencyKey ?? crypto.randomUUID();
      if (state.jobs.some((j) => j.idempotencyKey === key)) {
        return reply.code(409).send({ error: 'idempotencyKey already exists' });
      }
      const job: Job = {
        id: crypto.randomUUID(),
        projectId,
        kind: kind as Job['kind'],
        status: 'queued',
        idempotencyKey: key,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
      };
      state.jobs.push(job);
      broadcaster.publish({ type: 'job.created', payload: job }, state);
      return reply.code(201).send(job);
    },
  );

  app.post<{ Params: { id: string } }>('/api/v1/jobs/:id/cancel', async (req, reply) => {
    const job = state.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      return reply.code(404).send({ error: 'job not found' });
    }
    if (job.status !== 'queued' && job.status !== 'running') {
      return reply.code(409).send({ error: `job is ${job.status} and cannot be cancelled` });
    }
    job.status = 'cancelled';
    job.finishedAt = new Date().toISOString();
    broadcaster.publish({ type: 'job.updated', payload: job }, state);
    return job;
  });

  app.get('/api/v1/artifacts', async () => ({ items: state.artifacts }));

  app.get('/api/v1/releases', async () => ({ items: state.releases }));

  app.get('/api/v1/settings', async () => state.settings);

  app.put<{ Body: Partial<FactorySettings> }>('/api/v1/settings', async (req, reply) => {
    const body = req.body ?? {};
    if (body.theme !== undefined && body.theme !== 'dark' && body.theme !== 'light') {
      return reply.code(400).send({ error: 'theme must be dark or light' });
    }
    if (body.defaultPlatforms !== undefined) {
      if (body.defaultPlatforms.some((p) => !PLATFORMS.includes(p))) {
        return reply.code(400).send({ error: 'unknown platform' });
      }
      state.settings.defaultPlatforms = body.defaultPlatforms;
    }
    if (body.theme !== undefined) state.settings.theme = body.theme;
    if (body.offlineModeEnabled !== undefined) state.settings.offlineModeEnabled = body.offlineModeEnabled;
    if (body.aiEnabled !== undefined) state.settings.aiEnabled = body.aiEnabled;
    broadcaster.publish({ type: 'settings.updated', payload: state.settings }, state);
    return state.settings;
  });

  app.get('/ws', { websocket: true }, (connection) => {
    const sender = (data: string) => connection.send(data);
    broadcaster.add(sender);
    connection.on('close', () => broadcaster.remove(sender));
    connection.on('error', () => broadcaster.remove(sender));
  });

  return { app, store, broadcaster };
}
