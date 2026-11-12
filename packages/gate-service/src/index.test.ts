import { describe, it, expect } from 'vitest';
import {
  approveGate,
  assertTransition,
  evaluateGate,
  evaluateAllGates,
  GateApprovalError,
  GATE_DEFINITIONS,
  GATE_ORDER,
} from './index.js';
import type { Artifact, Gate, Project } from '@neuroos/core-contracts';

const baseProject = {
  acceptanceCriteria: [{ id: 'c1', text: 'works', status: 'DONE' }],
  status: 'DEVELOPMENT',
} as Project;

function artifact(kind: Artifact['kind']): Artifact {
  return {
    id: `a-${kind}`,
    projectId: 'p1',
    kind,
    version: '1.0.0',
    storageKey: `p1/${kind}/1.0.0/f`,
    sha256: 'a'.repeat(64),
    sizeBytes: 10,
    createdAt: '2025-01-01T00:00:00.000Z',
  };
}

const approved = (code: Gate['code']): Gate => ({
  id: `g-${code}`,
  projectId: 'p1',
  code,
  status: 'approved',
});

describe('gate definitions', () => {
  it('defines all gates G0–G6 in order', () => {
    expect(GATE_ORDER).toEqual(['G0', 'G1', 'G2', 'G3', 'G4', 'G5', 'G6']);
    for (const code of GATE_ORDER) {
      expect(GATE_DEFINITIONS[code].title.length).toBeGreaterThan(0);
    }
  });
});

describe('evaluateGate', () => {
  it('G0 is eligible with spec artifact and defined criteria', () => {
    const result = evaluateGate('G0', {
      project: baseProject,
      artifacts: [artifact('spec')],
      gates: [],
    });
    expect(result.eligible).toBe(true);
  });

  it('G0 lists missing items honestly', () => {
    const result = evaluateGate('G0', { project: { ...baseProject, acceptanceCriteria: [] }, artifacts: [], gates: [] });
    expect(result.eligible).toBe(false);
    expect(result.missing).toEqual(['artifact:spec', 'check:acceptance_criteria_defined']);
  });

  it('G2 requires build_passed check, not just artifact', () => {
    const withArtifactOnly = evaluateGate('G2', { project: baseProject, artifacts: [artifact('build_log')], gates: [] });
    expect(withArtifactOnly.eligible).toBe(false);
    expect(withArtifactOnly.missing).toContain('check:build_passed');

    const withCheck = evaluateGate('G2', {
      project: baseProject,
      artifacts: [artifact('build_log')],
      gates: [],
      checks: { build_passed: true },
    });
    expect(withCheck.eligible).toBe(true);
  });

  it('G6 requires all previous gates approved and criteria DONE', () => {
    const partial = evaluateGate('G6', {
      project: baseProject,
      artifacts: [artifact('release_notes'), artifact('documentation')],
      gates: [approved('G0'), approved('G1'), approved('G2')],
    });
    expect(partial.eligible).toBe(false);
    expect(partial.missing).toContain('check:previous_gates_approved');

    const full = evaluateGate('G6', {
      project: baseProject,
      artifacts: [artifact('release_notes'), artifact('documentation')],
      gates: GATE_ORDER.slice(0, 6).map(approved),
    });
    expect(full.eligible).toBe(true);
  });

  it('evaluateAllGates returns evaluations for every gate', () => {
    const results = evaluateAllGates({ project: baseProject, artifacts: [], gates: [] });
    expect(results).toHaveLength(7);
    expect(results.every((r) => r.eligible === false)).toBe(true);
  });
});

describe('approveGate', () => {
  it('approves an eligible gate', () => {
    const evaluation = evaluateGate('G0', { project: baseProject, artifacts: [artifact('spec')], gates: [] });
    const gate = approveGate('G0', { approver: 'owner', evaluation });
    expect(gate.status).toBe('approved');
    expect(gate.approver).toBe('owner');
    expect(gate.decidedAt).toBeTruthy();
  });

  it('refuses approval with honest missing list', () => {
    const evaluation = evaluateGate('G0', { project: baseProject, artifacts: [], gates: [] });
    expect(() => approveGate('G0', { approver: 'owner', evaluation })).toThrow(GateApprovalError);
  });

  it('owner-only gates reject other approvers', () => {
    const evaluation = evaluateGate('G6', {
      project: baseProject,
      artifacts: [artifact('release_notes'), artifact('documentation')],
      gates: GATE_ORDER.slice(0, 6).map(approved),
    });
    expect(() => approveGate('G6', { approver: 'ai_agent', evaluation })).toThrow(GateApprovalError);
  });
});

describe('assertTransition', () => {
  it('blocks RELEASED without G6', () => {
    const result = assertTransition('RELEASED', [], baseProject);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('G6');
  });

  it('allows RELEASED with G6 and DONE criteria', () => {
    const result = assertTransition('RELEASED', [approved('G6')], baseProject);
    expect(result.allowed).toBe(true);
  });

  it('allows ordinary transitions freely', () => {
    expect(assertTransition('ANALYSIS', [], baseProject).allowed).toBe(true);
  });
});
