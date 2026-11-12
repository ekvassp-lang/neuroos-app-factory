import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((m: { data: string }) => void) | null = null;
  constructor() {
    MockWebSocket.instances.push(this);
  }
  close() {}
}

function stubFetch(responses: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const body = responses[url] ?? { items: [] };
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body)),
      } as Response);
    }),
  );
}

describe('web shell', () => {
  it('renders sidebar navigation with all factory sections', async () => {
    stubFetch({
      '/api/v1/overview': {
        totals: { projects: 0, jobs: 0, artifacts: 0, releases: 0, events: 0 },
        byStatus: {},
        recentEvents: [],
      },
    });
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    render(<App />);

    expect(screen.getByText('NeuroOS')).toBeTruthy();
    for (const label of [
      'Global Dashboard',
      'Projects',
      'AI Workspace',
      'Build Center',
      'Audit Center',
      'Release Center',
      'Settings',
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    await waitFor(() => expect(screen.getByText('Global Dashboard')).toBeTruthy());
  });

  it('shows an honest error when the API is unreachable', async () => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('connection refused'))),
    );
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('connection refused');
    });
  });

  it('lists projects from the real API response shape', async () => {
    stubFetch({
      '/api/v1/projects': {
        items: [
          {
            id: 'p1',
            name: 'Demo Product',
            slug: 'demo-product',
            status: 'IDEA',
            targetPlatforms: ['web'],
            currentStage: 0,
            acceptanceCriteria: [],
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
      },
    });
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);

    window.location.hash = '#/projects';
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Demo Product')).toBeTruthy();
    });
    expect(screen.getByText('IDEA')).toBeTruthy();
  });
});
