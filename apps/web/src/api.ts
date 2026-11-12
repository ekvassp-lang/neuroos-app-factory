import type {
  Artifact,
  FactorySettings,
  Job,
  LifecycleEvent,
  Project,
  Release,
} from '@neuroos/core-contracts';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data ? String(data.error) : `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
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
}

export interface ListResponse<T> {
  items: T[];
}

export const api = {
  overview: () => request<Overview>('GET', '/api/v1/overview'),
  projects: () => request<ListResponse<Project>>('GET', '/api/v1/projects'),
  createProject: (name: string, slug: string) =>
    request<Project>('POST', '/api/v1/projects', { name, slug }),
  project: (slug: string) => request<ProjectDetail>('GET', `/api/v1/projects/${slug}`),
  patchProject: (slug: string, patch: Partial<Project>) =>
    request<Project>('PATCH', `/api/v1/projects/${slug}`, patch),
  events: () => request<ListResponse<LifecycleEvent>>('GET', '/api/v1/events'),
  jobs: () => request<ListResponse<Job>>('GET', '/api/v1/jobs'),
  createJob: (projectId: string, kind: Job['kind']) =>
    request<Job>('POST', '/api/v1/jobs', { projectId, kind }),
  cancelJob: (id: string) => request<Job>('POST', `/api/v1/jobs/${id}/cancel`),
  artifacts: () => request<ListResponse<Artifact>>('GET', '/api/v1/artifacts'),
  releases: () => request<ListResponse<Release>>('GET', '/api/v1/releases'),
  settings: () => request<FactorySettings>('GET', '/api/v1/settings'),
  updateSettings: (patch: Partial<FactorySettings>) =>
    request<FactorySettings>('PUT', '/api/v1/settings', patch),
};
