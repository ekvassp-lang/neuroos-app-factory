// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReleaseCenter } from './screens/ReleaseCenter.js';
import type { Release } from '@neuroos/core-contracts';

function makeRelease(artifactIds: string[]): Release {
  return {
    id: 'rel-1',
    projectId: 'p1',
    version: '0.1.0',
    channel: 'dev',
    notes: '',
    artifactIds,
    createdAt: '2026-11-14T00:00:00.000Z',
  };
}

function stubFetch(release: Release): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = String(url).includes('/releases')
        ? { items: [release] }
        : { items: [] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

describe('STAGE 8+: release artifacts shown honestly in ReleaseCenter', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lists attached artifact ids', async () => {
    stubFetch(makeRelease(['art-1', 'art-2']));
    render(<ReleaseCenter />);
    const line = await screen.findByText(/артефакты \(2\): art-1, art-2/);
    expect(line).toBeTruthy();
  });

  it('shows honest empty state when no artifacts are attached', async () => {
    stubFetch(makeRelease([]));
    render(<ReleaseCenter />);
    const line = await screen.findByText(/артефакты не привязаны/);
    expect(line).toBeTruthy();
  });
});
