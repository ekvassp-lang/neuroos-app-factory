import type {
  AcceptanceCriterion,
  Artifact,
  ArtifactKind,
  Gate,
  GateCode,
  GateStatus,
  LifecycleStatus,
  Project,
} from '@neuroos/core-contracts';

export interface GateDefinition {
  code: GateCode;
  title: string;
  requiredArtifacts: ArtifactKind[];
  requiredChecks: CheckKey[];
  approver: 'owner' | 'audit_center' | 'build_center' | 'test_center';
  criteria: string[];
}

export type CheckKey =
  | 'acceptance_criteria_defined'
  | 'acceptance_criteria_done'
  | 'build_passed'
  | 'tests_passed'
  | 'security_scanned'
  | 'previous_gates_approved';

export interface GateEvaluationInput {
  project: Pick<Project, 'acceptanceCriteria' | 'status'>;
  artifacts: Pick<Artifact, 'kind' | 'sha256'>[];
  gates: Pick<Gate, 'code' | 'status'>[];
  checks?: Partial<Record<CheckKey, boolean>>;
}

export interface GateEvaluation {
  code: GateCode;
  eligible: boolean;
  missing: string[];
}

export const GATE_DEFINITIONS: Record<GateCode, GateDefinition> = {
  G0: {
    code: 'G0',
    title: 'Requirements approved',
    requiredArtifacts: ['spec'],
    requiredChecks: ['acceptance_criteria_defined'],
    approver: 'owner',
    criteria: [
      'ТЗ полное, критерии приёмки измеримы',
      'Риски зафиксированы',
      'Открытые вопросы закрыты или отложены владельцем',
    ],
  },
  G1: {
    code: 'G1',
    title: 'Architecture approved',
    requiredArtifacts: ['architecture'],
    requiredChecks: [],
    approver: 'owner',
    criteria: [
      'Архитектура покрывает все платформы из ТЗ',
      'Стек обоснован анализом',
      'План Offline/Online присутствует',
      'Структура репозитория определена',
    ],
  },
  G2: {
    code: 'G2',
    title: 'Foundation verified',
    requiredArtifacts: ['build_log'],
    requiredChecks: ['build_passed'],
    approver: 'audit_center',
    criteria: [
      'Репозиторий проекта инициализирован',
      'Каркас собирается фактически (код возврата 0)',
      'CI настроен',
    ],
  },
  G3: {
    code: 'G3',
    title: 'Core functionality tested',
    requiredArtifacts: ['test_report'],
    requiredChecks: ['tests_passed'],
    approver: 'test_center',
    criteria: [
      'Основные функции из ТЗ работают',
      'Функциональные и интеграционные тесты пройдены фактически',
    ],
  },
  G4: {
    code: 'G4',
    title: 'Security reviewed',
    requiredArtifacts: ['audit_report'],
    requiredChecks: ['security_scanned'],
    approver: 'audit_center',
    criteria: [
      'Секреты отсутствуют в коде и логах',
      'Входные данные валидируются',
      'Зависимости проверены',
    ],
  },
  G5: {
    code: 'G5',
    title: 'Platform builds verified',
    requiredArtifacts: ['installer', 'checksum'],
    requiredChecks: [],
    approver: 'build_center',
    criteria: [
      'Для каждой платформы из build_plan артефакт собран или честно BLOCKED с причиной',
      'Контрольные суммы совпадают',
    ],
  },
  G6: {
    code: 'G6',
    title: 'Release approved',
    requiredArtifacts: ['release_notes', 'documentation'],
    requiredChecks: ['acceptance_criteria_done', 'previous_gates_approved'],
    approver: 'owner',
    criteria: [
      'Все обязательные пункты acceptance_criteria = DONE',
      'G0–G5 approved',
      'Release notes и документация зарегистрированы',
    ],
  },
};

export const GATE_ORDER: GateCode[] = ['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6'];

function criteriaDone(criteria: AcceptanceCriterion[]): boolean {
  return criteria.length > 0 && criteria.every((c) => c.status === 'DONE');
}

function hasAllArtifacts(artifacts: GateEvaluationInput['artifacts'], kinds: ArtifactKind[]): boolean {
  return kinds.every((kind) => artifacts.some((a) => a.kind === kind && a.sha256.length > 0));
}

function gateApproved(gates: GateEvaluationInput['gates'], code: GateCode): boolean {
  return gates.some((g) => g.code === code && g.status === 'approved');
}

export function evaluateGate(code: GateCode, input: GateEvaluationInput): GateEvaluation {
  const def = GATE_DEFINITIONS[code];
  const missing: string[] = [];

  for (const kind of def.requiredArtifacts) {
    if (!input.artifacts.some((a) => a.kind === kind)) {
      missing.push(`artifact:${kind}`);
    }
  }

  const checks: Partial<Record<CheckKey, boolean>> = {
    acceptance_criteria_defined: input.project.acceptanceCriteria.length > 0,
    acceptance_criteria_done: criteriaDone(input.project.acceptanceCriteria),
    previous_gates_approved:
      code === 'G0' || GATE_ORDER.slice(0, GATE_ORDER.indexOf(code)).every((c) => gateApproved(input.gates, c)),
    ...input.checks,
  };

  for (const key of def.requiredChecks) {
    if (!checks[key]) {
      missing.push(`check:${key}`);
    }
  }

  return { code, eligible: missing.length === 0, missing };
}

export function evaluateAllGates(input: GateEvaluationInput): GateEvaluation[] {
  return GATE_ORDER.map((code) => evaluateGate(code, input));
}

export class GateApprovalError extends Error {
  constructor(
    public code: GateCode,
    public missing: string[],
  ) {
    super(`Gate ${code} cannot be approved; missing: ${missing.join(', ')}`);
    this.name = 'GateApprovalError';
  }
}

export interface ApproveGateOptions {
  approver: string;
  evaluation: GateEvaluation;
  existingGate?: Gate;
}

export function approveGate(code: GateCode, options: ApproveGateOptions): Gate {
  const def = GATE_DEFINITIONS[code];
  if (def.approver === 'owner' && options.approver !== 'owner') {
    throw new GateApprovalError(code, [`approver:${def.approver} required`]);
  }
  if (!options.evaluation.eligible) {
    throw new GateApprovalError(code, options.evaluation.missing);
  }
  const now = new Date().toISOString();
  return {
    ...(options.existingGate ?? { id: crypto.randomUUID(), projectId: '' }),
    code,
    status: 'approved' as GateStatus,
    approver: options.approver,
    decidedAt: now,
  };
}

export function rejectGate(code: GateCode, existingGate?: Gate): Gate {
  return {
    ...(existingGate ?? { id: crypto.randomUUID(), projectId: '' }),
    code,
    status: 'rejected',
    decidedAt: new Date().toISOString(),
  };
}

const RELEASE_RELEVANT_STATUSES: LifecycleStatus[] = ['RELEASED'];

export interface TransitionCheck {
  allowed: boolean;
  reason?: string;
}

export function assertTransition(toStatus: LifecycleStatus, gates: GateEvaluationInput['gates'], project: Pick<Project, 'acceptanceCriteria'>): TransitionCheck {
  if (RELEASE_RELEVANT_STATUSES.includes(toStatus)) {
    if (!gateApproved(gates, 'G6')) {
      return { allowed: false, reason: 'RELEASED requires G6 approved' };
    }
    if (!criteriaDone(project.acceptanceCriteria)) {
      return { allowed: false, reason: 'RELEASED requires all acceptance criteria DONE' };
    }
  }
  return { allowed: true };
}
