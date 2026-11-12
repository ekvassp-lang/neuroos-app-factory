import Fastify from 'fastify';
import type { Project } from '@neuroos/core-contracts';

export interface AppState {
  projects: Project[];
}

export function createApp(state: AppState = { projects: [] }) {
  const app = Fastify({ logger: false });

  app.get('/healthz', async () => ({
    status: 'ok',
    service: 'neuroos-app-factory-server',
    version: '0.1.0',
  }));

  app.get('/api/v1/projects', async () => ({ items: state.projects }));

  app.post<{ Body: { name: string; slug: string } }>('/api/v1/projects', async (req, reply) => {
    const { name, slug } = req.body ?? ({} as { name: string; slug: string });
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
      targetPlatforms: ['web', 'pwa', 'windows', 'macos', 'linux', 'android', 'ios'],
      currentStage: 0,
      acceptanceCriteria: [],
      createdAt: now,
      updatedAt: now,
    };
    state.projects.push(project);
    return reply.code(201).send(project);
  });

  return app;
}
