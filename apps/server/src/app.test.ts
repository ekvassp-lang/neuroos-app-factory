import { describe, it, expect } from 'vitest';
import { createApp } from './app.js';

describe('server API', () => {
  it('reports health', async () => {
    const app = createApp();
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok' });
  });

  it('creates and lists projects with validation', async () => {
    const app = createApp();
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
});
