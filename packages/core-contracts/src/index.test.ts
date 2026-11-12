import { describe, it, expect } from 'vitest';
import type { Project } from './index.js';

describe('core-contracts', () => {
  it('accepts a valid project shape', () => {
    const project: Project = {
      id: 'p1',
      name: 'Demo',
      slug: 'demo',
      status: 'IDEA',
      targetPlatforms: ['web'],
      currentStage: 0,
      acceptanceCriteria: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(project.status).toBe('IDEA');
  });
});
