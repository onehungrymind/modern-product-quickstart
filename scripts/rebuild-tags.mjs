#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, 'modules.manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

let updated = 0;
let unchanged = 0;
for (const { tag, commit } of manifest.tags) {
  let current = null;
  try {
    current = execSync(`git rev-parse --verify --quiet refs/tags/${tag}`, {
      encoding: 'utf-8',
    }).trim();
  } catch {
    current = null;
  }

  if (current === commit) {
    unchanged++;
    continue;
  }

  execSync(`git tag -f ${tag} ${commit}`, { stdio: 'pipe' });
  console.log(`  ${tag.padEnd(14)} → ${commit.slice(0, 7)} ${current ? '(moved)' : '(created)'}`);
  updated++;
}

console.log(`\nDone. ${updated} updated, ${unchanged} unchanged.`);
