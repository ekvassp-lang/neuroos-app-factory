import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import type { RunnerLog } from '@neuroos/core-contracts';

export interface RunOptions {
  argv: string[];
  cwd: string;
  jobId?: string;
  timeoutMs?: number;
  /** Additional argv[0] values allowed for this call (intersected with defaults). */
  extraAllowed?: string[];
  stdin?: string;
}

export interface RunResult extends RunnerLog {
  timedOut: boolean;
  stdout: string;
  stderr: string;
}

const DEFAULT_ALLOWED = new Set([
  'git',
  'node',
  'npm',
  'pnpm',
  'npx',
  'cargo',
  'rustc',
  'tsc',
  'vitest',
]);

const TAIL_LIMIT = 8_000;

/** Patterns replaced with ***SECRET*** in captured output. */
const SECRET_PATTERNS: RegExp[] = [
  /(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*\S+/gi,
  /(sk|pk|ghp|gho|xoxb|xoxp)-[A-Za-z0-9_-]{10,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

export function maskSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, '***SECRET***'), text);
}

function tail(text: string): string {
  return text.length > TAIL_LIMIT ? text.slice(-TAIL_LIMIT) : text;
}

export function isAllowed(argv: string[], extraAllowed: string[] = []): boolean {
  const program = argv[0];
  if (!program) return false;
  const base = program.split('/').pop() ?? program;
  return DEFAULT_ALLOWED.has(base) || extraAllowed.includes(base);
}

export function runCommand(opts: RunOptions): Promise<RunResult> {
  const { argv, cwd, jobId = randomUUID(), timeoutMs = 120_000, extraAllowed = [], stdin } = opts;

  if (!isAllowed(argv, extraAllowed)) {
    return Promise.reject(new Error(`Command not allowed: ${argv[0] ?? '<empty>'}`));
  }

  return new Promise((resolve, reject) => {
    const startedAt = new Date().toISOString();
    const child = spawn(argv[0], argv.slice(1), { cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const finishedAt = new Date().toISOString();
      resolve({
        id: randomUUID(),
        jobId,
        argv,
        cwd,
        exitCode: code ?? -1,
        timedOut,
        stdout,
        stderr,
        stdoutTail: tail(maskSecrets(stdout)),
        stderrTail: tail(maskSecrets(stderr)),
        startedAt,
        finishedAt,
      });
    });

    if (stdin !== undefined) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}
