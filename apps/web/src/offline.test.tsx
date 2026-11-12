import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { GlobalDashboard } from './screens/GlobalDashboard.js';
import { api } from './api.js';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('offline cache', () => {
  it('serves cached data with honest marker when network fails', async () => {
    const overview = {
      totals: { projects: 3, jobs: 1, artifacts: 2, releases: 0, events: 5 },
      byStatus: { IDEA: 3 },
      recentEvents: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(overview),
          text: () => Promise.resolve(JSON.stringify(overview)),
        } as Response),
      ),
    );

    render(<GlobalDashboard />);
    await waitFor(() => expect(screen.getByText('3')).toBeTruthy());
    cleanup();

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    render(<GlobalDashboard />);

    await waitFor(() => expect(screen.getByTestId('offline-cache')).toBeTruthy());
    expect(screen.getByText('3')).toBeTruthy();
    expect(api.overview()).resolves.toBeTruthy();
  });

  it('shows honest error when offline without cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
    );
    render(<GlobalDashboard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByTestId('offline-cache')).toBeNull();
  });
});
