import { describe, it, expect } from 'vitest';
import { runCommand, isAllowed, maskSecrets, sha256 } from './index.js';

describe('runner whitelist', () => {
  it('rejects non-whitelisted programs', async () => {
    await expect(
      runCommand({ argv: ['rm', '-rf', '/'], cwd: process.cwd() }),
    ).rejects.toThrow(/not allowed/);
  });

  it('allows whitelisted programs', () => {
    expect(isAllowed(['git', 'status'])).toBe(true);
    expect(isAllowed(['curl', 'http://example.com'])).toBe(false);
  });
});

describe('runner execution', () => {
  it('captures real exit code and output', async () => {
    const result = await runCommand({
      argv: ['node', '-e', 'console.log("hello-factory")'],
      cwd: process.cwd(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello-factory');
    expect(result.timedOut).toBe(false);
  });

  it('reports non-zero exit codes honestly', async () => {
    const result = await runCommand({
      argv: ['node', '-e', 'process.exit(3)'],
      cwd: process.cwd(),
    });
    expect(result.exitCode).toBe(3);
  });

  it('kills processes on timeout', async () => {
    const result = await runCommand({
      argv: ['node', '-e', 'setInterval(() => {}, 1000)'],
      cwd: process.cwd(),
      timeoutMs: 300,
    });
    expect(result.timedOut).toBe(true);
  }, 10_000);
});

describe('secret masking', () => {
  it('masks key-like content in output', () => {
    expect(maskSecrets('api_key=abc123')).toBe('***SECRET***');
    expect(maskSecrets('token: superscretvalue')).toBe('***SECRET***');
  });

  it('computes stable sha256', () => {
    expect(sha256('a')).toBe(
      'ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb',
    );
  });
});
