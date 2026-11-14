import { enqueueOffline, isNetworkError, QueuedOfflineError } from './offlineQueue.js';
import type {
  Artifact,
  FactorySettings,
  Gate,
  Job,
  LifecycleEvent,
  Project,
  Release,
} from '@neuroos/core-contracts';
export type { Release };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const CACHE_PREFIX = 'nf-cache:';
const TOKEN_KEY = 'nf-token';

export function getApiToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setApiToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    return;
  }
}

function authHeaders(): Record<string, string> {
  const token = getApiToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

let fromCache = false;

export function wasFromCache(): boolean {
  return fromCache;
}

function readCache<T>(url: string): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeCache(url: string, data: unknown): void {
  try {
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(data));
  } catch {
    return;
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        ...authHeaders(),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (method === 'GET') {
      const cached = readCache<T>(url);
      if (cached !== null) {
        fromCache = true;
        return cached;
      }
    }
    fromCache = false;
    throw error;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data ? String(data.error) : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }
  fromCache = false;
  if (method === 'GET') {
    writeCache(url, data);
  }
  return data as T;
}

export interface Overview {
  totals: { projects: number; jobs: number; artifacts: number; releases: number; events: number };
  byStatus: Record<string, number>;
  recentEvents: LifecycleEvent[];
}

export interface ProjectDetail {
  project: Project;
  events: LifecycleEvent[];
  jobs: Job[];
  artifacts: Artifact[];
}

export interface GateEvaluation {
  code: string;
  eligible: boolean;
  missing: string[];
}

export interface GatesResponse {
  items: GateEvaluation[];
  decisions: Gate[];
}

export interface JobRunResponse {
  job: Job;
  artifacts: Artifact[];
  logLines: string[];
  error?: string;
}

export interface ListResponse<T> {
  items: T[];
}

export interface UpdateCheck {
  channel: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  latest: Release;
}

function withOfflineFallback<T>(op: () => Promise<T>, kind: string, payload: unknown): Promise<T> {
  return op().catch((error: unknown) => {
    if (isNetworkError(error)) {
      return enqueueOffline(kind, payload).then(
        (opId) => Promise.reject(new QueuedOfflineError(opId, kind)),
      );
    }
    return Promise.reject(error);
  });
}

export const api = {
  overview: () => request<Overview>('GET', '/api/v1/overview'),
  projects: () => request<ListResponse<Project>>('GET', '/api/v1/projects'),
  createProject: (name: string, slug: string) =>
    withOfflineFallback(
      () => request<Project>('POST', '/api/v1/projects', { name, slug }),
      'create_project',
      { name, slug },
    ),
  project: (slug: string) => request<ProjectDetail>('GET', `/api/v1/projects/${slug}`),
  patchProject: (slug: string, patch: Partial<Project>, baseRevision?: number) =>
    withOfflineFallback(
      () => request<Project>('PATCH', `/api/v1/projects/${slug}`, patch),
      'patch_project',
      { slug, ...patch, baseRevision },
    ),
  events: () => request<ListResponse<LifecycleEvent>>('GET', '/api/v1/events'),
  jobs: () => request<ListResponse<Job>>('GET', '/api/v1/jobs'),
  createJob: (projectId: string, kind: Job['kind']) =>
    request<Job>('POST', '/api/v1/jobs', { projectId, kind }),
  cancelJob: (id: string) => request<Job>('POST', `/api/v1/jobs/${id}/cancel`),
  runJob: (id: string) => request<JobRunResponse>('POST', `/api/v1/jobs/${id}/run`),
  gates: (slug: string) => request<GatesResponse>('GET', `/api/v1/projects/${slug}/gates`),
  approveGate: (slug: string, code: string, approver: string) =>
    request<Gate>('POST', `/api/v1/projects/${slug}/gates/${code}/approve`, { approver }),
  rejectGate: (slug: string, code: string) =>
    request<Gate>('POST', `/api/v1/projects/${slug}/gates/${code}/reject`),
  artifacts: () => request<ListResponse<Artifact>>('GET', '/api/v1/artifacts'),
  releases: () => request<ListResponse<Release>>('GET', '/api/v1/releases'),
  createRelease: (projectId: string, version: string, channel: string, notes: string) =>
    request<Release>('POST', '/api/v1/releases', { projectId, version, channel, notes }),
  checkUpdates: (channel: string, currentVersion: string) =>
    request<UpdateCheck>('GET', `/api/v1/updates/latest?channel=${encodeURIComponent(channel)}&currentVersion=${encodeURIComponent(currentVersion)}`),
  settings: () => request<FactorySettings>('GET', '/api/v1/settings'),
  updateSettings: (patch: Partial<FactorySettings>) =>
    request<FactorySettings>('PUT', '/api/v1/settings', patch),
};
