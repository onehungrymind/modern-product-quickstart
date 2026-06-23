#!/usr/bin/env node
/**
 * The Production Readiness Review, made runnable.
 *
 * Reads scripts/readiness.manifest.json and runs each delta's check
 * (scripts/readiness/checks/<id>.mjs). A check exits 0 when the capability has
 * reached product-grade, non-zero otherwise. A missing check script is reported
 * as "pending" (the lab that builds it hasn't been done yet).
 *
 *   node scripts/readiness.mjs                 # full PRR — every delta, exit 1 if any not green
 *   node scripts/readiness.mjs status          # same table, but always exit 0 (informational)
 *   node scripts/readiness.mjs check R04 R05   # run only the named deltas
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(__dirname, 'readiness.manifest.json'), 'utf-8'));

const command = process.argv[2];
const args = process.argv.slice(3).map((s) => s.toUpperCase());

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const YEL = '\x1b[33m';
const RST = '\x1b[0m';

function checkPath(id) {
  return join(__dirname, 'readiness', 'checks', `${id.toLowerCase()}.mjs`);
}

function runOne(delta) {
  const path = checkPath(delta.id);
  if (!existsSync(path)) {
    return { status: 'pending', output: '' };
  }
  try {
    const output = execFileSync(process.execPath, [path], {
      cwd: root,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15 * 60 * 1000,
    });
    return { status: 'pass', output };
  } catch (err) {
    const output = `${err.stdout ?? ''}${err.stderr ?? ''}`.trim();
    return { status: 'fail', output };
  }
}

const selected = manifest.deltas.filter((d) => (command === 'check' ? args.includes(d.id) : true));
if (command === 'check' && selected.length === 0) {
  console.error(`No deltas matched ${args.join(', ')}. Known: ${manifest.deltas.map((d) => d.id).join(', ')}`);
  process.exit(1);
}

console.log(`\n  Production Readiness Review — Tracer\n  ${DIM}${selected.length} delta(s)${RST}\n`);

let green = 0;
let red = 0;
let pending = 0;
const failures = [];

for (const delta of selected) {
  const { status, output } = runOne(delta);
  let badge;
  if (status === 'pass') {
    badge = `${GREEN}✓ product-grade${RST}`;
    green++;
  } else if (status === 'pending') {
    badge = `${YEL}• pending${RST}`;
    pending++;
  } else {
    badge = `${RED}✗ not yet${RST}`;
    red++;
    failures.push({ delta, output });
  }
  console.log(`  ${delta.id}  ${badge}  ${DIM}${delta.capability} — Lab ${delta.lab}${RST}`);
}

if (failures.length > 0) {
  console.log(`\n  ${RED}Failures:${RST}`);
  for (const { delta, output } of failures) {
    console.log(`\n  ${RED}${delta.id}${RST} ${delta.capability} — expected: ${delta.check}`);
    if (output) {
      console.log(
        output
          .split('\n')
          .map((l) => `    ${DIM}${l}${RST}`)
          .join('\n'),
      );
    }
  }
}

console.log(
  `\n  ${green} product-grade · ${red} not yet · ${pending} pending  ${DIM}(of ${selected.length})${RST}\n`,
);

// `status` is informational (never fails the shell); the gate forms fail on any non-green.
if (command !== 'status' && (red > 0 || pending > 0)) {
  process.exit(1);
}
