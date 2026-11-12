import Fastify from 'fastify';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import websocket from '@fastify/websocket';
import type { ArtifactKind, FactorySettings, GateCode, Job, Project } from '@neuroos/core-contracts';
import {
  assertTransition,
  approveGate,
  evaluateAllGates,
  evaluateGate,
  GateApprovalError,
  GATE_DEFINITIONS,
  rejectGate,
  type CheckKey,
} from '@neuroos/gate-service';
import { sha256 } from '@neuroos/runner';
import {
  createBroadcaster,
  type Broadcaster,
} from './broadcaster.js';
import {
  ARTIFACT_KINDS,
  createStore,
  defaultState,
  JOB_KINDS,
  LIFECYCLE_STATUSES,
  type FactoryState,
} from './store.js';
import { createPersistence } from './persistence.js';
import {
  artifactPath,
  artifactStorageKey,
  executeJob,
  makeArtifactRecord,
  type WorkerContext,
} from './worker.js';

const PLATFORMS = ['web', 'pwa', 'windows', 'macos', 'linux', 'android', 'ios'] as const;

export interface CreateAppOptions {
  state?: FactoryState;
  broadcaster?: Broadcaster;
  dataDir?: string;
  persistPath?: string;
  aiComplete?: WorkerContext['aiComplete'];
}

export interface SyncOperationInput {
  id: string;
  kind: string;
  payload?: {
    name?: string;
    slug?: string;
    baseRevision?: number;
    status?: Project['status'];
    currentStage?: number;
    acceptanceCriteria?: Project['acceptanceCriteria'];
    targetPlatforms?: Project['targetPlatforms'];
  };
}

export async function createApp(options: CreateAppOptions = {}) {
  const persistence = options.persistPath
    ? createPersistence(options.persistPath, () => store.state)
    : null;
  const initialState = persistence ? await persistence.load() : (options.state ?? defaultState());
  const store = createStore(initialState);
  const broadcaster = options.broadcaster ?? createBroadcaster();
  const { state } = store;
  const dataDir = options.dataDir ?? path.resolve('data');
  const workerContext: WorkerContext = { dataDir, aiComplete: options.aiComplete };
  if (persistence) {
    store.subscribe(() => persistence.scheduleSave());
  }

  const appliedSyncResults = new Map<string, { outcome: 'applied'; projectId: string }>();

  const app = Fastify({ logger: false });
  await app.register(websocket);

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'neuroos-app-factory-server',
    version: '0.4.0',
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

  function createProjectInner(name: string, slug: string): { error?: string; code?: number; project?: Project } {
    if (!name || !slug) {
      return { error: 'name and slug are required', code: 400 };
    }
    if (state.projects.some((p) => p.slug === slug)) {
      return { error: 'slug already exists', code: 409 };
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
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(project);
    store.addLifecycleEvent(project.id, 'IDEA', 'IDEA', 'project.created');
    broadcaster.publish({ type: 'project.created', payload: project }, state);
    return { project };
  }

  app.post<{ Body: { name?: string; slug?: string } }>('/api/v1/projects', async (req, reply) => {
    const { name, slug } = req.body ?? {};
    const result = createProjectInner(name ?? '', slug ?? '');
    if (result.error) {
      return reply.code(result.code ?? 400).send({ error: result.error });
    }
    return reply.code(201).send(result.project);
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

  function patchProjectInner(
    project: Project,
    body: Partial<Project>,
  ): { error?: string; code?: number; conflict?: { server: Project } } {
    if (body.status !== undefined && !LIFECYCLE_STATUSES.includes(body.status)) {
      return { error: 'unknown lifecycle status', code: 400 };
    }
    if (
      body.currentStage !== undefined &&
      (!Number.isInteger(body.currentStage) || body.currentStage < 0 || body.currentStage > 8)
    ) {
      return { error: 'currentStage must be an integer 0..8', code: 400 };
    }
    if (body.status === 'RELEASED' && project.status !== 'RELEASED') {
      const transition = assertTransition(
        'RELEASED',
        state.gates
          .filter((g) => g.projectId === project.id)
          .map((g) => ({ code: g.code, status: g.status })),
        project,
      );
      if (!transition.allowed) {
        return { error: transition.reason, code: 409 };
      }
    }
    if (body.targetPlatforms !== undefined && body.targetPlatforms.some((p) => !PLATFORMS.includes(p))) {
      return { error: 'unknown platform', code: 400 };
    }
    const fromStatus = project.status;
    if (body.name !== undefined) project.name = body.name;
    if (body.status !== undefined) project.status = body.status;
    if (body.currentStage !== undefined) project.currentStage = body.currentStage;
    if (body.acceptanceCriteria !== undefined) project.acceptanceCriteria = body.acceptanceCriteria;
    if (body.targetPlatforms !== undefined) project.targetPlatforms = body.targetPlatforms;
    project.revision = (project.revision ?? 0) + 1;
    project.updatedAt = new Date().toISOString();
    if (body.status !== undefined && body.status !== fromStatus) {
      store.addLifecycleEvent(project.id, fromStatus, body.status, 'status.changed', 'api');
    }
    broadcaster.publish({ type: 'project.updated', payload: project }, state);
    return { };
  }

  app.patch<{ Params: { slug: string }; Body: Partial<Project> }>(
    '/api/v1/projects/:slug',
    async (req, reply) => {
      const project = state.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const result = patchProjectInner(project, req.body ?? {});
      if (result.error) {
        return reply.code(result.code ?? 400).send({ error: result.error });
      }
      return project;
    },
  );

  app.post<{ Body: { operations?: SyncOperationInput[] } }>('/api/v1/sync', async (req, reply) => {
    const operations = req.body?.operations;
    if (!Array.isArray(operations)) {
      return reply.code(400).send({ error: 'operations array is required' });
    }
    const results = [];
    for (const operation of operations) {
      if (!operation?.id || !operation.kind) {
        results.push({ id: operation?.id ?? '', outcome: 'rejected', detail: 'id and kind are required' });
        continue;
      }
      const previous = appliedSyncResults.get(operation.id);
      if (previous) {
        results.push({ id: operation.id, outcome: 'duplicate', projectId: previous.projectId });
        continue;
      }
      if (operation.kind === 'create_project') {
        const result = createProjectInner(operation.payload?.name ?? '', operation.payload?.slug ?? '');
        if (result.error || !result.project) {
          results.push({ id: operation.id, outcome: 'rejected', detail: result.error });
        } else {
          appliedSyncResults.set(operation.id, { outcome: 'applied', projectId: result.project.id });
          results.push({ id: operation.id, outcome: 'applied', project: { ...result.project } });
        }
        continue;
      }
      if (operation.kind === 'patch_project') {
        const slug = operation.payload?.slug;
        const project = state.projects.find((p) => p.slug === slug);
        if (!project) {
          results.push({ id: operation.id, outcome: 'rejected', detail: 'project not found' });
          continue;
        }
        const baseRevision = operation.payload?.baseRevision;
        if (baseRevision !== undefined && (project.revision ?? 0) > baseRevision) {
          results.push({ id: operation.id, outcome: 'conflict', server: { ...project } });
          continue;
        }
        const patch: Partial<Project> = {};
        if (operation.payload?.name !== undefined) patch.name = operation.payload.name;
        if (operation.payload?.status !== undefined) patch.status = operation.payload.status;
        if (operation.payload?.currentStage !== undefined) patch.currentStage = operation.payload.currentStage;
        if (operation.payload?.acceptanceCriteria !== undefined) {
          patch.acceptanceCriteria = operation.payload.acceptanceCriteria;
        }
        if (operation.payload?.targetPlatforms !== undefined) {
          patch.targetPlatforms = operation.payload.targetPlatforms;
        }
        const result = patchProjectInner(project, patch);
        if (result.error) {
          results.push({ id: operation.id, outcome: 'rejected', detail: result.error });
        } else {
          appliedSyncResults.set(operation.id, { outcome: 'applied', projectId: project.id });
          results.push({ id: operation.id, outcome: 'applied', project: { ...project } });
        }
        continue;
      }
      results.push({ id: operation.id, outcome: 'rejected', detail: `unknown operation kind: ${operation.kind}` });
    }
    return { results };
  });

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

  app.post<{ Params: { id: string } }>('/api/v1/jobs/:id/run', async (req, reply) => {
    const job = state.jobs.find((j) => j.id === req.params.id);
    if (!job) {
      return reply.code(404).send({ error: 'job not found' });
    }
    if (job.status !== 'queued') {
      return reply.code(409).send({ error: `job is ${job.status} and cannot be run` });
    }
    const project = state.projects.find((p) => p.id === job.projectId);
    if (!project) {
      job.status = 'failed';
      job.error = 'project not found';
      job.finishedAt = new Date().toISOString();
      broadcaster.publish({ type: 'job.updated', payload: job }, state);
      return reply.code(404).send({ error: 'project not found' });
    }
    job.attempts += 1;
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    broadcaster.publish({ type: 'job.updated', payload: job }, state);

    const result = await executeJob(job, project, workerContext);
    const created = [];
    for (const candidate of result.artifacts) {
      const content = Buffer.from(candidate.content, 'utf8');
      const target = artifactPath(dataDir, project.id, candidate.kind, candidate.version, candidate.filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
      const artifact = makeArtifactRecord(
        project.id,
        candidate,
        artifactStorageKey(project.id, candidate.kind, candidate.version, candidate.filename),
        content.length,
      );
      state.artifacts.push(artifact);
      created.push(artifact);
      broadcaster.publish({ type: 'artifact.created', payload: artifact }, state);
    }
    job.status = result.status;
    if (result.error) job.error = result.error;
    job.finishedAt = new Date().toISOString();
    broadcaster.publish({ type: 'job.updated', payload: job }, state);
    return { job, artifacts: created, logLines: result.logLines, error: result.error };
  });

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

  app.get<{ Querystring: { projectId?: string } }>('/api/v1/artifacts', async (req) => {
    const items = req.query.projectId
      ? state.artifacts.filter((a) => a.projectId === req.query.projectId)
      : state.artifacts;
    return { items };
  });

  app.post<{ Params: { slug: string }; Body: { kind?: string; version?: string; filename?: string; contentBase64?: string; sha256?: string } }>(
    '/api/v1/projects/:slug/artifacts',
    async (req, reply) => {
      const project = state.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const { kind, version, filename, contentBase64, sha256: declared } = req.body ?? {};
      if (!kind || !version || !filename || !contentBase64) {
        return reply.code(400).send({ error: 'kind, version, filename and contentBase64 are required' });
      }
      if (!ARTIFACT_KINDS.includes(kind as ArtifactKind)) {
        return reply.code(400).send({ error: 'unknown artifact kind' });
      }
      const content = Buffer.from(contentBase64, 'base64');
      const computed = sha256(content);
      if (declared !== undefined && declared !== computed) {
        return reply.code(409).send({ error: 'sha256 mismatch', declared, computed });
      }
      const target = artifactPath(dataDir, project.id, kind, version, filename);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content);
      const artifact = makeArtifactRecord(
        project.id,
        { kind: kind as ArtifactKind, version, filename, content: content.toString('utf8') },
        artifactStorageKey(project.id, kind, version, filename),
        content.length,
      );
      state.artifacts.push(artifact);
      broadcaster.publish({ type: 'artifact.created', payload: artifact }, state);
      return reply.code(201).send(artifact);
    },
  );

  app.get<{ Params: { slug: string } }>('/api/v1/projects/:slug/gates', async (req, reply) => {
    const project = state.projects.find((p) => p.slug === req.params.slug);
    if (!project) {
      return reply.code(404).send({ error: 'project not found' });
    }
    return {
      items: evaluateAllGates(gateInput(project)),
      decisions: state.gates.filter((g) => g.projectId === project.id),
    };
  });

  app.post<{ Params: { slug: string; code: string }; Body: { approver?: string } }>(
    '/api/v1/projects/:slug/gates/:code/approve',
    async (req, reply) => {
      const project = state.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const code = req.params.code as GateCode;
      if (!(code in GATE_DEFINITIONS)) {
        return reply.code(400).send({ error: 'unknown gate code' });
      }
      const approver = req.body?.approver ?? 'owner';
      const existing = state.gates.find((g) => g.projectId === project.id && g.code === code);
      try {
        const gate = approveGate(code, {
          approver,
          evaluation: evaluateGate(code, gateInput(project)),
          existingGate: existing,
        });
        gate.projectId = project.id;
        if (existing) {
          Object.assign(existing, gate);
        } else {
          state.gates.push(gate);
        }
        broadcaster.publish({ type: 'gate.updated', payload: gate }, state);
        return gate;
      } catch (error) {
        if (error instanceof GateApprovalError) {
          return reply.code(409).send({ error: error.message, missing: error.missing });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { slug: string; code: string } }>(
    '/api/v1/projects/:slug/gates/:code/reject',
    async (req, reply) => {
      const project = state.projects.find((p) => p.slug === req.params.slug);
      if (!project) {
        return reply.code(404).send({ error: 'project not found' });
      }
      const code = req.params.code as GateCode;
      if (!(code in GATE_DEFINITIONS)) {
        return reply.code(400).send({ error: 'unknown gate code' });
      }
      const existing = state.gates.find((g) => g.projectId === project.id && g.code === code);
      const gate = rejectGate(code, existing);
      gate.projectId = project.id;
      if (existing) {
        Object.assign(existing, gate);
      } else {
        state.gates.push(gate);
      }
      broadcaster.publish({ type: 'gate.updated', payload: gate }, state);
      return gate;
    },
  );

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

  function gateInput(project: Project) {
    const projectArtifacts = state.artifacts.filter((a) => a.projectId === project.id);
    return {
      project: { acceptanceCriteria: project.acceptanceCriteria, status: project.status },
      artifacts: projectArtifacts.map((a) => ({ kind: a.kind, sha256: a.sha256 })),
      gates: state.gates
        .filter((g) => g.projectId === project.id)
        .map((g) => ({ code: g.code, status: g.status })),
      checks: {
        build_passed: projectArtifacts.some((a) => a.kind === 'build_log'),
        tests_passed: projectArtifacts.some((a) => a.kind === 'test_report'),
        security_scanned: projectArtifacts.some((a) => a.kind === 'audit_report'),
      } as Partial<Record<CheckKey, boolean>>,
    };
  }

  app.get('/ws', { websocket: true }, (connection) => {
    const sender = (data: string) => connection.send(data);
    broadcaster.add(sender);
    connection.on('close', () => broadcaster.remove(sender));
    connection.on('error', () => broadcaster.remove(sender));
  });

  return {
    app,
    store,
    broadcaster,
    flushPersistence: () => persistence?.flush() ?? Promise.resolve(),
  };
}
