// R03 — Secrets: externalized, nothing in source. gitleaks clean; .env not committed; no secret defaults.
import { execFileSync } from 'node:child_process';
import { Probe, root, read, exists } from './_lib.mjs';

const p = new Probe();

// gitleaks: no secrets committed anywhere in the repo (working tree + tracked files).
let gitleaksOk = false;
let gitleaksOut = '';
try {
  execFileSync(
    'gitleaks',
    ['detect', '--no-banner', '--redact', '--no-git', '-c', '.gitleaks.toml', '-s', '.'],
    { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  gitleaksOk = true;
} catch (err) {
  gitleaksOut = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  gitleaksOk = false;
}
p.assert(gitleaksOk, 'gitleaks reports no secrets in the tree', gitleaksOut.split('\n').slice(-3).join(' '));

// .env must NOT be tracked by git (only .env.example is committed).
let tracked = '';
try {
  tracked = execFileSync('git', ['ls-files', '.env'], { cwd: root, encoding: 'utf-8' }).trim();
} catch {
  tracked = '';
}
p.assert(tracked === '', '.env is not committed', tracked);
p.assert(exists('.env.example'), '.env.example is committed (documents required vars)');

// JWT_SECRET has no in-code default — it must be supplied by the environment.
const schema = exists('apps/api/src/config/env.schema.ts') ? read('apps/api/src/config/env.schema.ts') : '';
const jwtLine = schema.split('\n').find((l) => l.includes('JWT_SECRET')) ?? '';
p.assert(jwtLine !== '' && !/\.default\(/.test(jwtLine), 'JWT_SECRET has no in-code default', jwtLine.trim());

p.done();
