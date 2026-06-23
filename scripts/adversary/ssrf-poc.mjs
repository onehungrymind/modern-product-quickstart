#!/usr/bin/env node
/**
 * Adversary PoC: Server-Side Request Forgery (SSRF)
 *
 * Attempts to create links whose target_url points at internal/cloud-metadata
 * addresses. The CreateLinkSchema refinement (isSafeTargetUrl) must reject
 * these at the validation layer so the server never issues a fetch.
 *
 * EXIT 0 = all attempts returned 4xx (DEFEATED — server never fetched internally)
 * EXIT 1 = at least one attempt succeeded (VULNERABLE)
 *
 * Usage:
 *   node scripts/adversary/ssrf-poc.mjs [base-url]
 *   node scripts/adversary/ssrf-poc.mjs http://localhost:3000
 *   API_BASE=http://localhost:3000 node scripts/adversary/ssrf-poc.mjs
 */

const BASE = process.argv[2] ?? process.env.API_BASE ?? 'http://localhost:3000';
const API = `${BASE}/api`;

const UNIQUE = Date.now().toString(36);
const EMAIL = `adversary-ssrf-${UNIQUE}@example.com`;
const PASSWORD = 'Adv3rsary!P0C';

async function request(method, path, body, cookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, headers: res.headers, json };
}

function getCookieHeader(res) {
  const raw = res.headers.get('set-cookie');
  if (!raw) return '';
  const match = raw.match(/tracer_token=[^;]+/);
  return match ? match[0] : '';
}

async function main() {
  console.log('=== SSRF PoC ===');
  console.log(`Target: ${API}`);
  console.log('');

  // Register + login
  console.log(`[*] Registering ${EMAIL} ...`);
  const reg = await request('POST', '/auth/register', { email: EMAIL, name: 'Adversary Bot', password: PASSWORD });
  if (reg.status !== 201) {
    console.error(`[!] Registration failed (${reg.status}):`, reg.json);
    process.exit(2);
  }
  const cookie = getCookieHeader(reg);
  if (!cookie) {
    console.error('[!] No auth cookie received after register');
    process.exit(2);
  }
  console.log('[+] Authenticated');
  console.log('');

  // Note: we attempt the SSRF at the CREATE (validation) layer.
  // The server must return 4xx before it ever issues an internal HTTP request.
  const attacks = [
    {
      label: 'AWS IMDS (cloud metadata)',
      url: 'http://169.254.169.254/latest/meta-data/',
    },
    {
      label: 'localhost (loopback hostname)',
      url: 'http://localhost/',
    },
    {
      label: '127.0.0.1 (loopback IP)',
      url: 'http://127.0.0.1/',
    },
    {
      label: '10.0.0.1 (RFC-1918 private)',
      url: 'http://10.0.0.1/internal-api',
    },
    {
      label: '192.168.1.1 (RFC-1918 private)',
      url: 'http://192.168.1.1/admin',
    },
    {
      label: '172.16.0.1 (RFC-1918 private)',
      url: 'http://172.16.0.1/secret',
    },
    {
      label: '[::1] (IPv6 loopback)',
      url: 'http://[::1]/',
    },
  ];

  let allBlocked = true;

  for (const { label, url } of attacks) {
    const res = await request('POST', '/links', { target_url: url }, cookie);
    const blocked = res.status >= 400 && res.status < 500;
    const icon = blocked ? '[BLOCKED]' : '[VULNERABLE]';
    console.log(`${icon} ${label}`);
    console.log(`         URL:    ${url}`);
    console.log(`         Status: ${res.status}`);
    if (!blocked) {
      allBlocked = false;
      console.log(`         Link:   ${JSON.stringify(res.json)}`);
    }
    console.log('');
  }

  if (allBlocked) {
    console.log('=== RESULT: DEFEATED ===');
    console.log('All SSRF attempts were rejected at the validation layer (4xx).');
    console.log('Defense: CreateLinkSchema.target_url.refine(isSafeTargetUrl) + DNS-resolution');
    console.log('         guard in HttpUrlPreviewProvider. Server never fetched internal resources.');
    process.exit(0);
  } else {
    console.log('=== RESULT: VULNERABLE ===');
    console.log('One or more SSRF URLs were accepted — hardening is incomplete.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[!] Unexpected error:', err);
  process.exit(2);
});
