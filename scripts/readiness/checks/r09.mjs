// R09 — Infrastructure: declarative IaC, immutable, drift-checked. The real probe:
// terraform apply stands up the stack, a manual change is flagged as drift, destroy
// tears it down. (Needs Docker + the tracer-api/web images + Terraform.)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Probe, root, exists } from './_lib.mjs';

const p = new Probe();

// Both apps are containerized declaratively.
p.assert(exists('deploy/api.Dockerfile'), 'api Dockerfile exists');
p.assert(exists('deploy/web.Dockerfile'), 'web Dockerfile exists');
p.assert(exists('infra/main.tf'), 'Terraform IaC exists (infra/main.tf)');

// Resolve a Docker host (Docker Desktop on macOS is under $HOME, not /var/run).
function dockerHost() {
  if (process.env.DOCKER_HOST) return process.env.DOCKER_HOST;
  const desktop = `unix://${join(homedir(), '.docker', 'run', 'docker.sock')}`;
  if (existsSync(join(homedir(), '.docker', 'run', 'docker.sock'))) return desktop;
  return 'unix:///var/run/docker.sock';
}
const host = dockerHost();
const infra = join(root, 'infra');
const tf = (args, opts = {}) =>
  execFileSync('terraform', [`-chdir=${infra}`, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, DOCKER_HOST: host },
    ...opts,
  });

let applied = false;
try {
  tf(['init', '-input=false', '-no-color'], { stdio: ['ignore', 'pipe', 'pipe'] });
  // Use a dedicated workspace so the probe never collides with a real dev/prod stack.
  try {
    tf(['workspace', 'new', 'probe'], { stdio: 'ignore' });
  } catch {
    tf(['workspace', 'select', 'probe'], { stdio: 'ignore' });
  }
  tf(['apply', '-auto-approve', '-no-color', '-var', `docker_host=${host}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  applied = true;

  // Immutable + reproducible: a clean plan right after apply has no changes.
  let drift = false;
  try {
    tf(['plan', '-detailed-exitcode', '-no-color', '-var', `docker_host=${host}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    drift = e.status === 2; // 2 = changes pending → would be unexpected here
  }
  p.assert(!drift, 'apply is reproducible — no drift immediately after apply');

  // Inject drift: remove a managed container out-of-band, then plan must detect it.
  execFileSync('docker', ['rm', '-f', 'tracer-probe-api'], { env: { ...process.env, DOCKER_HOST: host }, stdio: 'ignore' });
  let detected = false;
  try {
    tf(['plan', '-detailed-exitcode', '-no-color', '-var', `docker_host=${host}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    detected = e.status === 2;
  }
  p.assert(detected, 'a manual change (removed container) is flagged as drift');
} catch (err) {
  p.assert(false, 'terraform apply/plan', `${err.stdout ?? ''}${err.stderr ?? ''}`.split('\n').slice(-4).join(' '));
} finally {
  if (applied) {
    try {
      tf(['destroy', '-auto-approve', '-no-color', '-var', `docker_host=${host}`], { stdio: 'ignore' });
    } catch {
      /* best-effort cleanup */
    }
  }
}

p.done();
