#!/usr/bin/env node
// Toggle a feature flag at runtime — releases a feature WITHOUT redeploying (R08).
//   node deploy/feature-flag.mjs <key> <on|off>
//   node deploy/feature-flag.mjs link_title_preview on
import pg from 'pg';

const [key, state] = process.argv.slice(2);
if (!key || (state !== 'on' && state !== 'off')) {
  console.error('Usage: node deploy/feature-flag.mjs <key> <on|off>');
  process.exit(2);
}
const enabled = state === 'on';
const url = process.env.DATABASE_URL ?? 'postgres://tracer:tracer@localhost:5433/tracer';

const client = new pg.Client({ connectionString: url });
await client.connect();
const res = await client.query(
  'UPDATE feature_flags SET enabled = $1, updated_at = now() WHERE key = $2 RETURNING key, enabled',
  [enabled, key],
);
await client.end();

if (res.rowCount === 0) {
  console.error(`No such flag: ${key}`);
  process.exit(1);
}
console.log(`flag ${res.rows[0].key} -> ${res.rows[0].enabled ? 'on' : 'off'} (takes effect within ~5s, no redeploy)`);
