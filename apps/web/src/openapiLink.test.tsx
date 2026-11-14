// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Settings } from './screens/Settings.js';

describe('STAGE 8+: OpenAPI spec download in Settings', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders a download link to /api/v1/openapi.json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ theme: 'dark', offlineModeEnabled: false, aiEnabled: false }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );

    render(<Settings />);
    const link = await screen.findByTestId('openapi-download');
    expect(link.getAttribute('href')).toBe('/api/v1/openapi.json');
    expect(link.getAttribute('download')).toBe('neuroos-app-factory-openapi.json');
  });
});
