#!/usr/bin/env node
/**
 * Adversary PoC: Rate-limit bypass / DoS amplification
 *
 * Fires ~250 rapid parallel requests at a public endpoint (POST /api/auth/login
 * with bad credentials) and asserts that at least one response is a 429
 * (Too Many Requests), proving the global ThrottlerGuard is engaged.
 *
 * EXIT 0 = at least one 429 observed (DEFEATED — rate limiting is working)
 * EXIT 1 = no 429 observed after 250 requests (VULNERABLE)
 *
 * Usage:
 *   node scripts/adversary/ratelimit-poc.mjs [base-url]
 *   node scripts/adversary/ratelimit-poc.mjs http://localhost:3000
 *   API_BASE=http://localhost:3000 node scripts/adversary/ratelimit-poc.mjs
 */

const BASE = process.argv[2] ?? process.env.API_BASE ?? 'http://localhost:3000';
const API = `${BASE}/api`;

// Total burst size — exceeds the 200/min throttle limit
const BURST = 250;

// Concurrency cap — enough to saturate but not exhaust OS file descriptors
const CONCURRENCY = 50;

async function loginAttempt() {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@nowhere.invalid', password: 'wrong' }),
    });
    return res.status;
  } catch {
    return 0; // network error
  }
}

async function runBatch(size) {
  const results = await Promise.all(Array.from({ length: size }, () => loginAttempt()));
  return results;
}

async function main() {
  console.log('=== Rate-limit PoC ===');
  console.log(`Target: ${API}/auth/login`);
  console.log(`Burst:  ${BURST} requests, concurrency ${CONCURRENCY}`);
  console.log('');

  const statuses = {};
  let sent = 0;

  while (sent < BURST) {
    const batch = Math.min(CONCURRENCY, BURST - sent);
    const batchStatuses = await runBatch(batch);
    for (const s of batchStatuses) {
      statuses[s] = (statuses[s] ?? 0) + 1;
    }
    sent += batch;
    process.stdout.write(`\r[*] Sent ${sent}/${BURST} requests ...`);
  }

  console.log('\n');
  console.log('Status code distribution:');
  for (const [code, count] of Object.entries(statuses).sort()) {
    console.log(`  HTTP ${code}: ${count}`);
  }
  console.log('');

  const got429 = (statuses[429] ?? 0) > 0;

  if (got429) {
    console.log('=== RESULT: DEFEATED ===');
    console.log(`Got ${statuses[429]} × 429 Too Many Requests.`);
    console.log('Defense: ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]) + ThrottlerGuard');
    console.log('         wired globally in AppModule.');
    process.exit(0);
  } else {
    console.log('=== RESULT: VULNERABLE ===');
    console.log('No 429 responses received after 250 rapid requests.');
    console.log('Rate limiting is not active or not configured correctly.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[!] Unexpected error:', err);
  process.exit(2);
});
