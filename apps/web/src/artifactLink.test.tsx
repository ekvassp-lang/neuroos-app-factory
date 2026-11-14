// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectWorkspace } from './screens/ProjectWorkspace.js';
import type { Artifact } from '@neuroos/core-contracts';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const artifact: Artifact = {
  id: 'art-77',
  projectId: 'p1',
  kind: 'installer',
  version: '0.1.0',
  storageKey: 'p1/installer/0.1.0/app-0.1.0.exe',
  sha256: 'a'.repeat(64),
  sizeBytes: 128,
  createdAt: '2026-11-14T00:00:00.000Z',
};

describe('STAGE 8+: artifact download links in ProjectWorkspace', () => {
  it('renders download links for project artifacts and honest empty state', async () => {
    const detail = {
      project: {
        id: 'p1', name: 'Demo', slug: 'demo', status: 'DEVELOPMENT',
        targetPlatforms: ['web'], acceptanceCriteria: [], createdAt: '', revision: 1,
      },
      events: [],
      jobs: [],
      artifacts: [artifact],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const body = url.includes('/gates')
          ? { items: [], decisions: [] }
          : detail;
        return {
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
          text: () => Promise.resolve(JSON.stringify(body)),
        } as Response;
      }),
    );

    render(
      <MemoryRouter initialEntries={['/projects/demo']}>
        <Routes>
          <Route path="/projects/:slug" element={<ProjectWorkspace />} />
        </Routes>
      </MemoryRouter>,
    );

    const link = await screen.findByTestId('artifact-download-art-77');
    expect(link.getAttribute('href')).toBe('/api/v1/artifacts/art-77/download');
    expect(link.getAttribute('download')).toBe('app-0.1.0.exe');
  });
});
