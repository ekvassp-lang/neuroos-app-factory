export type LifecycleStatus =
  | 'IDEA'
  | 'ANALYSIS'
  | 'SPECIFICATION'
  | 'ARCHITECTURE'
  | 'DEVELOPMENT'
  | 'TESTING'
  | 'AUDIT'
  | 'APPROVED'
  | 'BUILDING'
  | 'RELEASE_CANDIDATE'
  | 'RELEASED'
  | 'MAINTENANCE'
  | 'BLOCKED'
  | 'ARCHIVED';

export type GateCode = 'G0' | 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export type GateStatus = 'pending' | 'in_review' | 'approved' | 'rejected';

export type ItemStatus =
  | 'DONE'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'NOT_IMPLEMENTED'
  | 'NOT_TESTED';

export type Platform =
  | 'web'
  | 'pwa'
  | 'windows'
  | 'macos'
  | 'linux'
  | 'android'
  | 'ios';

export type ArtifactKind =
  | 'source_ref'
  | 'spec'
  | 'architecture'
  | 'diagram'
  | 'test_report'
  | 'audit_report'
  | 'build_log'
  | 'installer'
  | 'checksum'
  | 'release_notes'
  | 'documentation';

export interface AcceptanceCriterion {
  id: string;
  text: string;
  status: ItemStatus;
  artifactId?: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  status: LifecycleStatus;
  targetPlatforms: Platform[];
  currentStage: number;
  acceptanceCriteria: AcceptanceCriterion[];
  revision?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleEvent {
  id: string;
  projectId: string;
  fromStatus: LifecycleStatus;
  toStatus: LifecycleStatus;
  gateCode?: GateCode;
  actor: string;
  reason: string;
  createdAt: string;
}

export interface Gate {
  id: string;
  projectId: string;
  code: GateCode;
  status: GateStatus;
  approver?: string;
  decidedAt?: string;
}

export interface JobKind {
  kind:
    | 'spec_generate'
    | 'arch_generate'
    | 'code_task'
    | 'test_run'
    | 'build_run'
    | 'audit_run'
    | 'release'
    | 'update_publish'
    | 'ai_task';
}

export interface Job {
  id: string;
  projectId: string;
  kind: JobKind['kind'];
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  idempotencyKey: string;
  attempts: number;
  maxAttempts: number;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  kind: ArtifactKind;
  platform?: Platform;
  version: string;
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
}

export interface RunnerLog {
  id: string;
  jobId: string;
  argv: string[];
  cwd: string;
  exitCode: number;
  stdoutTail: string;
  stderrTail: string;
  startedAt: string;
  finishedAt: string;
}

export type ReleaseChannel = 'stable' | 'beta' | 'alpha' | 'dev';

export interface Release {
  id: string;
  projectId: string;
  version: string;
  channel: ReleaseChannel;
  notes: string;
  artifactIds: string[];
  createdAt: string;
  releasedAt?: string;
}

export interface FactorySettings {
  theme: 'dark' | 'light';
  defaultPlatforms: Platform[];
  offlineModeEnabled: boolean;
  aiEnabled: boolean;
}
