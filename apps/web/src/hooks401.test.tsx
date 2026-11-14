// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { useApi } from './hooks.js';
import { setApiToken, ApiError } from './api.js';

function Probe() {
  const { error, loading } = useApi(async () => {
    throw new ApiError(401, 'authentication required');
  });
  if (loading) return <p>loading</p>;
  return <p role="alert">{error}</p>;
}

describe('useApi 401 hint', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('appends token hint to 401 errors', async () => {
    render(<Probe />);
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('задайте токен в Settings');
    });
    expect(setApiToken).toBeDefined();
  });
});
