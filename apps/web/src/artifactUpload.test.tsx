// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProjectWorkspace } from './screens/ProjectWorkspace.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (globalThis as { __nfSubtleRestored?: boolean }).__nfSubtleRestored;
});

const FAKE_DIGEST = Uint8Array.from([0xde, 0xad, 0xbe, 0xef]);
const FAKE_SHA256_HEX = 'deadbeef';

function stubSubtle(): void {
  const fakeSubtle = {
    digest: async () => FAKE_DIGEST.slice().buffer,
  };
  const holder = globalThis as { crypto?: { subtle?: unknown } };
  if (!holder.crypto) {
    vi.stubGlobal('crypto', { subtle: fakeSubtle });
  } else {
    Object.defineProperty(holder.crypto, 'subtle', {
      value: fakeSubtle,
      configurable: true,
      writable: true,
    });
  }
}

function fakeFile(name: string, content: string): File {
  return {
    name,
    arrayBuffer: async () => new TextEncoder().encode(content).buffer as ArrayBuffer,
  } as unknown as File;
}

function renderWorkspace(): void {
  render(
    <MemoryRouter initialEntries={['/projects/demo']}>
      <Routes>
        <Route path="/projects/:slug" element={<ProjectWorkspace />} />
      </Routes>
    </MemoryRouter>,
  );
}

function makeFetch(postResponse: {
  status: number;
  body: unknown;
}): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === 'POST' && url.includes('/artifacts')) {
      return {
        ok: postResponse.status < 400,
        status: postResponse.status,
        json: () => Promise.resolve(postResponse.body),
        text: () => Promise.resolve(JSON.stringify(postResponse.body)),
      } as Response;
    }
    const body = url.includes('/gates')
      ? { items: [], decisions: [] }
      : {
          project: {
            id: 'p1', name: 'Demo', slug: 'demo', status: 'DEVELOPMENT',
            targetPlatforms: ['web'], acceptanceCriteria: [], createdAt: '', revision: 1,
          },
          events: [],
          jobs: [],
          artifacts: [],
        };
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    } as Response;
  });
}

async function fillAndSubmit(file: File): Promise<void> {
  fireEvent.change(screen.getByTestId('artifact-file'), { target: { files: [file] } });
  fireEvent.click(screen.getByTestId('artifact-submit'));
}

describe('STAGE 8+: artifact upload form in ProjectWorkspace', () => {
  it('computes SHA-256 client-side and POSTs base64 payload', async () => {
    stubSubtle();
    const created = {
      id: 'art-90',
      projectId: 'p1',
      kind: 'spec',
      version: '0.1.0',
      storageKey: 'p1/spec/0.1.0/spec.md',
      sha256: FAKE_SHA256_HEX,
      sizeBytes: 5,
      createdAt: '2026-11-14T00:00:00.000Z',
    };
    const fetchMock = makeFetch({ status: 201, body: created });
    vi.stubGlobal('fetch', fetchMock);

    renderWorkspace();
    await screen.findByTestId('artifact-submit');
    await fillAndSubmit(fakeFile('spec.md', 'hello'));

    await screen.findByTestId('artifact-upload-ok');
    const postCall = fetchMock.mock.calls.find(
      ([input, init]) => String(input).includes('/artifacts') && init?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String(postCall![1].body))).toEqual({
      kind: 'spec',
      version: '0.1.0',
      filename: 'spec.md',
      contentBase64: btoa('hello'),
      sha256: FAKE_SHA256_HEX,
    });
  });

  it('shows honest API error (409 sha256 mismatch) and does not claim success', async () => {
    stubSubtle();
    const fetchMock = makeFetch({ status: 409, body: { error: 'sha256 mismatch' } });
    vi.stubGlobal('fetch', fetchMock);

    renderWorkspace();
    await screen.findByTestId('artifact-submit');
    await fillAndSubmit(fakeFile('spec.md', 'hello'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('409: sha256 mismatch');
    });
    expect(screen.queryByTestId('artifact-upload-ok')).toBeNull();
  });
});
