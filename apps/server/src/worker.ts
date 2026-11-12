import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Artifact, ArtifactKind, Job, Project } from '@neuroos/core-contracts';
import { runCommand, sha256 } from '@neuroos/runner';

export interface ArtifactCandidate {
  kind: ArtifactKind;
  version: string;
  filename: string;
  content: string;
}

export interface WorkerContext {
  dataDir: string;
  aiComplete?: (taskKind: string, prompt: string) => Promise<{ ok: true; text: string } | { ok: false; message: string }>;
}

export interface WorkerResult {
  status: 'done' | 'failed';
  error?: string;
  artifacts: ArtifactCandidate[];
  logLines: string[];
}

export function projectDir(dataDir: string, project: Project): string {
  return path.join(dataDir, 'projects', project.slug);
}

export function artifactPath(dataDir: string, projectId: string, kind: string, version: string, filename: string): string {
  return path.join(dataDir, 'artifacts', projectId, kind, version, filename);
}

export function artifactStorageKey(projectId: string, kind: string, version: string, filename: string): string {
  return `${projectId}/${kind}/${version}/${filename}`;
}

const SCAFFOLD_INDEX = `export function greet(name = 'world') {
  return \`Hello, \${name}!\`;
}

console.log(greet());
`;

const SCAFFOLD_TEST = `import test from 'node:test';
import assert from 'node:assert/strict';
import { greet } from './index.js';

test('greet returns greeting', () => {
  assert.equal(greet('neuroos'), 'Hello, neuroos!');
});
`;

function scaffoldPackageJson(project: Project): string {
  return `${JSON.stringify(
    {
      name: project.slug,
      version: '0.1.0',
      private: true,
      type: 'module',
      scripts: {
        start: 'node index.js',
        test: 'node --test',
      },
    },
    null,
    2,
  )}\n`;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

export async function executeJob(job: Job, project: Project, ctx: WorkerContext): Promise<WorkerResult> {
  const dir = projectDir(ctx.dataDir, project);
  const logLines: string[] = [];

  switch (job.kind) {
    case 'code_task': {
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, 'package.json'), scaffoldPackageJson(project), 'utf8');
      await writeFile(path.join(dir, 'index.js'), SCAFFOLD_INDEX, 'utf8');
      await writeFile(path.join(dir, 'index.test.js'), SCAFFOLD_TEST, 'utf8');
      logLines.push(`scaffold written: ${dir}`);
      const git = await runCommand({ argv: ['git', 'init'], cwd: dir, jobId: job.id, timeoutMs: 30_000 });
      logLines.push(`git init exit=${git.exitCode}`);
      if (git.exitCode !== 0) {
        return { status: 'failed', error: `git init failed: ${git.stderrTail.slice(0, 300)}`, artifacts: [], logLines };
      }
      logLines.push('scaffold ready (package.json, index.js, index.test.js, git repo)');
      return {
        status: 'done',
        artifacts: [
          {
            kind: 'source_ref',
            version: '0.1.0',
            filename: 'scaffold.txt',
            content: ['package.json', 'index.js', 'index.test.js'].join('\n') + `\nsha256(index.js)=${sha256(SCAFFOLD_INDEX)}\n`,
          },
        ],
        logLines,
      };
    }

    case 'build_run': {
      if (!(await pathExists(path.join(dir, 'index.js')))) {
        return { status: 'failed', error: 'index.js not found — сначала выполните задачу code_task', artifacts: [], logLines };
      }
      const run = await runCommand({ argv: ['node', 'index.js'], cwd: dir, jobId: job.id, timeoutMs: 60_000 });
      logLines.push(`node index.js exit=${run.exitCode}`);
      const content = `$ node index.js\nexit=${run.exitCode}\n\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`;
      if (run.exitCode !== 0) {
        return { status: 'failed', error: `build failed with exit code ${run.exitCode}`, artifacts: [], logLines };
      }
      return {
        status: 'done',
        artifacts: [{ kind: 'build_log', version: '0.1.0', filename: 'build.log', content }],
        logLines,
      };
    }

    case 'test_run': {
      if (!(await pathExists(path.join(dir, 'index.test.js')))) {
        return { status: 'failed', error: 'index.test.js not found — сначала выполните задачу code_task', artifacts: [], logLines };
      }
      const run = await runCommand({ argv: ['node', '--test'], cwd: dir, jobId: job.id, timeoutMs: 60_000 });
      logLines.push(`node --test exit=${run.exitCode}`);
      const content = `$ node --test\nexit=${run.exitCode}\n\n--- stdout ---\n${run.stdout}\n--- stderr ---\n${run.stderr}`;
      if (run.exitCode !== 0) {
        return { status: 'failed', error: `tests failed with exit code ${run.exitCode}`, artifacts: [], logLines };
      }
      return {
        status: 'done',
        artifacts: [{ kind: 'test_report', version: '0.1.0', filename: 'test-report.log', content }],
        logLines,
      };
    }

    case 'spec_generate':
    case 'arch_generate':
    case 'ai_task': {
      if (!ctx.aiComplete) {
        return {
          status: 'failed',
          error: 'AI-провайдер не подключён: требуется переданный smoke-тест и key_ref (раздел 4 AI_PROVIDER_ARCHITECTURE)',
          artifacts: [],
          logLines,
        };
      }
      const prompt =
        job.kind === 'spec_generate'
          ? `Составь краткую спецификацию для проекта «${project.name}» (slug ${project.slug}).`
          : job.kind === 'arch_generate'
            ? `Составь краткую архитектуру для проекта «${project.name}» (slug ${project.slug}).`
            : `Выполни задачу для проекта «${project.name}»: ${job.idempotencyKey}`;
      const result = await ctx.aiComplete(job.kind, prompt);
      if (!result.ok) {
        return { status: 'failed', error: result.message, artifacts: [], logLines };
      }
      const kind: ArtifactKind = job.kind === 'spec_generate' ? 'spec' : job.kind === 'arch_generate' ? 'architecture' : 'documentation';
      logLines.push(`AI-задача ${job.kind} выполнена, артефакт ${kind} создан`);
      return {
        status: 'done',
        artifacts: [{ kind, version: '0.1.0', filename: `${job.kind}.md`, content: result.text }],
        logLines,
      };
    }

    case 'audit_run':
    case 'release':
    case 'update_publish':
    default:
      return {
        status: 'failed',
        error: `задача ${job.kind} не реализована в STAGE 3 (план: STAGE 4+)`,
        artifacts: [],
        logLines,
      };
  }
}

export function makeArtifactRecord(
  projectId: string,
  candidate: ArtifactCandidate,
  storageKey: string,
  sizeBytes: number,
): Artifact {
  return {
    id: randomUUID(),
    projectId,
    kind: candidate.kind,
    version: candidate.version,
    storageKey,
    sha256: sha256(candidate.content),
    sizeBytes,
    createdAt: new Date().toISOString(),
  };
}
