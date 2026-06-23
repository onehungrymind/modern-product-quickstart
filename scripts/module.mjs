#!/usr/bin/env node
import { execSync } from 'node:child_process';
import process from 'node:process';

const command = process.argv[2];
const moduleArg = process.argv[3];
const pathArg = process.argv[4];

const MODULES = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

function run(cmd, options = {}) {
  const result = execSync(cmd, { stdio: 'pipe', encoding: 'utf-8', ...options });
  return result ? result.trim() : '';
}

function tryRun(cmd) {
  try {
    return run(cmd);
  } catch {
    return null;
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function validateModule(arg) {
  if (!arg) {
    console.error('Module number required. Example: npm run module:begin 03');
    process.exit(1);
  }
  const n = pad(arg);
  if (!MODULES.includes(n)) {
    console.error(`Unknown module "${arg}". Modules are 00..10.`);
    process.exit(1);
  }
  return n;
}

function ensureTagExists(tag) {
  if (!tryRun(`git rev-parse --verify --quiet refs/tags/${tag}`)) {
    console.error(`Tag '${tag}' does not exist. Run 'npm run rebuild-tags' or git fetch --tags.`);
    process.exit(1);
  }
}

function ensureCleanTree() {
  const dirty = tryRun('git status --porcelain');
  if (dirty && dirty.length > 0) {
    console.error('Working tree has uncommitted changes. Commit or stash before switching modules.');
    process.exit(1);
  }
}

function begin(n) {
  const startTag = `${n}-start`;
  const branch = `my/${n}`;
  ensureTagExists(startTag);
  ensureCleanTree();

  if (tryRun(`git rev-parse --verify --quiet refs/heads/${branch}`)) {
    console.log(`Switching to existing branch ${branch}.`);
    run(`git checkout ${branch}`, { stdio: 'inherit' });
  } else {
    console.log(`Checking out ${startTag} and creating branch ${branch}...`);
    run(`git checkout ${startTag}`, { stdio: 'inherit' });
    run(`git checkout -b ${branch}`, { stdio: 'inherit' });
  }
  console.log(`\nReady. Open modules/${n}-*/README.md and follow the walkthrough.`);
}

// Unlike the E2E quickstart (work confined to apps/web-e2e), learner work here
// spans libs/** and apps/**, so compare diffs the whole tree by default. Pass an
// optional path to scope it: npm run module:compare 03 libs/projects
function compare(n, scope) {
  const completeTag = `${n}-complete`;
  ensureTagExists(completeTag);
  console.log(`Diff between your work and the canonical ${completeTag}:`);
  console.log('---');
  const pathSpec = scope ? ` -- ${scope}` : '';
  try {
    execSync(`git diff ${completeTag}${pathSpec}`, { stdio: 'inherit' });
  } catch {
    /* git diff exits non-zero when there is a diff */
  }
}

function reset(n) {
  const startTag = `${n}-start`;
  const branch = `my/${n}`;
  ensureTagExists(startTag);

  const current = run('git rev-parse --abbrev-ref HEAD');
  if (current !== branch) {
    console.error(`Currently on '${current}', not '${branch}'. Run 'npm run module:begin ${n}' first.`);
    process.exit(1);
  }
  console.log(`Resetting ${branch} to ${startTag}...`);
  run(`git reset --hard ${startTag}`, { stdio: 'inherit' });
  console.log('Done.');
}

function status() {
  const current = tryRun('git rev-parse --abbrev-ref HEAD') ?? '(detached)';
  const dirty = (tryRun('git status --porcelain') || '').length > 0;
  const nearestTag = tryRun('git describe --tags --abbrev=0') ?? '(none)';

  console.log(`Branch:       ${current}`);
  console.log(`Nearest tag:  ${nearestTag}`);
  console.log(`Working tree: ${dirty ? 'dirty' : 'clean'}`);

  const match = current.match(/^my\/(\d{2})$/);
  if (match) {
    const n = match[1];
    console.log(`\nYou are on Module ${n}. Useful commands:`);
    console.log(`  npm run module:compare ${n}   # diff vs canonical solution`);
    console.log(`  npm run module:reset ${n}     # discard your work, restart module`);
  }
}

switch (command) {
  case 'begin':
    begin(validateModule(moduleArg));
    break;
  case 'compare':
    compare(validateModule(moduleArg), pathArg);
    break;
  case 'reset':
    reset(validateModule(moduleArg));
    break;
  case 'status':
    status();
    break;
  default:
    console.error('Usage: node scripts/module.mjs <begin|compare|reset|status> [NN] [path]');
    process.exit(1);
}
