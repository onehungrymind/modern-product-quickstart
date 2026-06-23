#!/usr/bin/env node
/**
 * Adversary PoC: Open-redirect / scheme-injection
 *
 * Attempts to create links with malicious target_url schemes that should be
 * blocked by the CreateLinkSchema refinement (isSafeTargetUrl).
 *
 * EXIT 0 = all attempts returned 4xx (DEFEATED — hardened reference is safe)
 * EXIT 1 = at least one attempt succeeded (VULNERABLE)
 *
 * Usage:
 *   node scripts/adversary/open-redirect-poc.mjs [base-url]
 *   node scripts/adversary/open-redirect-poc.mjs http://localhost:3000
 *   API_BASE=http://localhost:3000 node scripts/adversary/open-redirect-poc.mjs
 */

const BASE = process.argv[2] ?? process.env.API_BASE ?? 'http://localhost:3000';
const API = `${BASE}/api`;

const UNIQUE = Date.now().toString(36);
const EMAIL = `adversary-redirect-${UNIQUE}@example.com`;
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
  // Parse out the token cookie
  const match = raw.match(/tracer_token=[^;]+/);
  return match ? match[0] : '';
}

async function main() {
  console.log('=== Open-redirect / Scheme-injection PoC ===');
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

  const attacks = [
    { label: 'javascript: scheme (XSS)', url: 'javascript:alert(document.domain)' },
    { label: 'data: scheme (HTML injection)', url: 'data:text/html,<script>alert(1)</script>' },
    { label: 'file: scheme (local file read)', url: 'file:///etc/passwd' },
    { label: 'vbscript: scheme', url: 'vbscript:msgbox(1)' },
    { label: 'ftp: scheme', url: 'ftp://internal-server/secret' },
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
    console.log('All malicious scheme attempts were correctly rejected with 4xx.');
    console.log('Defense: CreateLinkSchema.target_url.refine(isSafeTargetUrl) in common-models.');
    process.exit(0);
  } else {
    console.log('=== RESULT: VULNERABLE ===');
    console.log('One or more malicious URLs were accepted — hardening is incomplete.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[!] Unexpected error:', err);
  process.exit(2);
});
