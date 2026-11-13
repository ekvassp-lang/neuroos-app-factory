import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'data', '.vibe']);
const SKIP_FILES = new Set(['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', path.join('scripts', 'security-scan.mjs')]);
const BINARY_EXT = new Set(['.png', '.ico', '.icns', '.jpg', '.jpeg', '.gif', '.woff', '.woff2']);
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const SECRET_PATTERNS = [
  { name: 'private-key-block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/ },
  { name: 'github-fine-grained-token', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: 'mistral-api-key', re: /\b[A-Za-z0-9]{32}\b/, context: /key|token|secret/i },
  { name: 'generic-bearer-secret', re: /\b(Bearer|bearer)\s+[A-Za-z0-9_\-.=]{25,}\b/ },
  { name: 'env-assignment-secret', re: /\b(API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)[A-Z_]*\s*=\s*['"][^'"]{16,}['"]/ },
];

const SAST_PATTERNS = [
  { name: 'eval', re: /\beval\s*\(/ },
  { name: 'new-function', re: /new\s+Function\s*\(/ },
  { name: 'dangerous-html', re: /dangerouslySetInnerHTML/ },
  { name: 'innerHTML-assign', re: /\.innerHTML\s*=/ },
  { name: 'exec-interpolation', re: /exec(?:Sync)?\s*\(\s*[`'"][^'"`]*\$\{/ },
  { name: 'shell-true', re: /shell\s*:\s*true/ },
];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.github') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else {
      yield full;
    }
  }
}

async function scan(root, patterns, codeOnly = false) {
  const findings = [];
  for await (const file of walk(root)) {
    if (SKIP_FILES.has(path.basename(file)) || SKIP_FILES.has(path.relative(root, file))) continue;
    if (BINARY_EXT.has(path.extname(file))) continue;
    if (codeOnly && !CODE_EXT.has(path.extname(file))) continue;
    const info = await stat(file);
    if (info.size > 512 * 1024) continue;
    const rel = path.relative(root, file);
    const isTest = /\.test\.(t|j)sx?$/.test(rel);
    let content;
    try {
      content = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (const { name, re, context } of patterns) {
      lines.forEach((line, i) => {
        if (context && !context.test(line)) return;
        if (re.test(line)) {
          findings.push({ file: rel, line: i + 1, name, sample: line.trim().slice(0, 120), isTest });
        }
      });
    }
  }
  return findings;
}

const mode = process.argv[2] ?? 'all';
const root = resolvePath(process.argv[3] ?? process.cwd());

if (mode === 'secrets' || mode === 'all') {
  const secrets = await scan(root, SECRET_PATTERNS);
  const real = secrets.filter((f) => !f.isTest);
  if (real.length > 0) {
    console.error(`SECRETS FOUND: ${real.length}`);
    for (const f of real) console.error(`  ${f.file}:${f.line} [${f.name}] ${f.sample}`);
    process.exit(1);
  }
  console.log('secrets: OK (0 findings)');
}

if (mode === 'sast' || mode === 'all') {
  const sast = await scan(root, SAST_PATTERNS, true);
  const real = sast.filter((f) => !f.isTest);
  if (real.length > 0) {
    console.error(`SAST FINDINGS: ${real.length}`);
    for (const f of real) console.error(`  ${f.file}:${f.line} [${f.name}] ${f.sample}`);
    process.exit(1);
  }
  console.log('sast: OK (0 findings)');
}
