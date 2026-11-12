import { randomUUID } from 'node:crypto';
import type {
  Artifact,
  ArtifactKind,
  FactorySettings,
  Gate,
  Job,
  LifecycleEvent,
  LifecycleStatus,
  Project,
  Release,
} from '@neuroos/core-contracts';

export interface StoreEvent {
  type:
    | 'project.created'
    | 'project.updated'
    | 'job.created'
    | 'job.updated'
    | 'gate.updated'
    | 'artifact.created'
    | 'settings.updated';
  payload: unknown;
}

export interface FactoryState {
  projects: Project[];
  events: LifecycleEvent[];
  jobs: Job[];
  gates: Gate[];
  artifacts: Artifact[];
  releases: Release[];
  settings: FactorySettings;
}

export const ARTIFACT_KINDS: ArtifactKind[] = [
  'source_ref',
  'spec',
  'architecture',
  'diagram',
  'test_report',
  'audit_report',
  'build_log',
  'installer',
  'checksum',
  'release_notes',
  'documentation',
];

export type StateListener = (event: StoreEvent) => void;

export const LIFECYCLE_STATUSES: LifecycleStatus[] = [
  'IDEA',
  'ANALYSIS',
  'SPECIFICATION',
  'ARCHITECTURE',
  'DEVELOPMENT',
  'TESTING',
  'AUDIT',
  'APPROVED',
  'BUILDING',
  'RELEASE_CANDIDATE',
  'RELEASED',
  'MAINTENANCE',
  'BLOCKED',
  'ARCHIVED',
];

export const JOB_KINDS: Job['kind'][] = [
  'spec_generate',
  'arch_generate',
  'code_task',
  'test_run',
  'build_run',
  'audit_run',
  'release',
  'update_publish',
  'ai_task',
];

export const DEFAULT_SETTINGS: FactorySettings = {
  theme: 'dark',
  defaultPlatforms: ['web', 'pwa', 'windows', 'macos', 'linux', 'android', 'ios'],
  offlineModeEnabled: false,
  aiEnabled: false,
};

export function createStore(state: FactoryState) {
  const listeners = new Set<StateListener>();

  function subscribe(listener: StateListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function publish(event: StoreEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        listeners.delete(listener);
      }
    }
  }

  function addLifecycleEvent(
    projectId: string,
    fromStatus: LifecycleStatus,
    toStatus: LifecycleStatus,
    reason: string,
    actor = 'api',
  ): LifecycleEvent {
    const event: LifecycleEvent = {
      id: randomUUID(),
      projectId,
      fromStatus,
      toStatus,
      actor,
      reason,
      createdAt: new Date().toISOString(),
    };
    state.events.push(event);
    return event;
  }

  return { state, subscribe, publish, addLifecycleEvent };
}

export function defaultState(): FactoryState {
  return {
    projects: [],
    events: [],
    jobs: [],
    gates: [],
    artifacts: [],
    releases: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}
