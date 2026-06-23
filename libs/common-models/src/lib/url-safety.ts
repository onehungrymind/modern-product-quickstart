/**
 * URL safety helpers — zero-dependency (Zod + Node.js stdlib only).
 *
 * Rules:
 *  1. Scheme must be http or https.
 *  2. Host must NOT be an IP literal that falls in a private, loopback,
 *     or link-local range (IPv4 or IPv6).
 *  3. Hostname must NOT be "localhost" or "*.localhost".
 *
 * DNS resolution (to catch hostnames that resolve to private IPs) is
 * intentionally NOT done here — common-models is scope:shared/zero-framework.
 * That guard lives in the api's HttpUrlPreviewProvider (node:dns is fine there).
 */

/** IPv4 dotted-decimal → 32-bit unsigned integer (big-endian). */
function ipv4ToInt(ip: string): number {
  return ip
    .split('.')
    .reduce((acc, octet) => (acc << 8) | Number(octet), 0) >>> 0;
}

/** Returns true when the string is a valid IPv4 dotted-decimal address. */
function isIPv4(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}

/** Returns true when the IPv4 address falls in a private/loopback/link-local range. */
function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);

  // 127.0.0.0/8 — loopback
  if ((n >>> 24) === 127) return true;

  // 10.0.0.0/8 — private
  if ((n >>> 24) === 10) return true;

  // 172.16.0.0/12 — private (172.16–172.31)
  if ((n >>> 20) === (0xac10 >>> 4)) return true;

  // 192.168.0.0/16 — private
  if ((n >>> 16) === 0xc0a8) return true;

  // 169.254.0.0/16 — link-local / APIPA (includes AWS IMDS 169.254.169.254)
  if ((n >>> 16) === 0xa9fe) return true;

  return false;
}

/** Expand an IPv6 address to its full 128-bit colon-separated form. */
function expandIPv6(raw: string): string {
  // Remove leading/trailing brackets (URL.hostname already strips them, but guard anyway)
  let ip = raw.replace(/^\[|\]$/g, '').toLowerCase();

  // Handle embedded IPv4-mapped addresses, e.g. ::ffff:192.168.1.1
  const ipv4Match = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip);
  if (ipv4Match) {
    const prefix = ipv4Match[1] ?? '';
    const ipv4 = ipv4Match[2] ?? '';
    const octets = ipv4.split('.').map(Number);
    const o0 = octets[0] ?? 0;
    const o1 = octets[1] ?? 0;
    const o2 = octets[2] ?? 0;
    const o3 = octets[3] ?? 0;
    const hex1 = ((o0 << 8) | o1).toString(16).padStart(4, '0');
    const hex2 = ((o2 << 8) | o3).toString(16).padStart(4, '0');
    ip = prefix + hex1 + ':' + hex2;
  }

  // Expand :: shorthand
  const halves = ip.split('::');
  if (halves.length === 2) {
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    ip = [...left, ...Array(missing).fill('0000'), ...right].join(':');
  }

  // Pad each group to 4 hex digits
  return ip
    .split(':')
    .map((g) => g.padStart(4, '0'))
    .join(':');
}

/** Returns true when the IPv6 address falls in a private/loopback/link-local range. */
function isPrivateIPv6(raw: string): boolean {
  const ip = expandIPv6(raw);
  const groups = ip.split(':');

  // ::1 — loopback
  if (ip === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

  const g0 = parseInt(groups[0] ?? '0', 16);

  // fc00::/7 — unique local (fd00 and fc00 prefixes)
  if ((g0 & 0xfe00) === 0xfc00) return true;

  // fe80::/10 — link-local
  if ((g0 & 0xffc0) === 0xfe80) return true;

  // ::ffff:0:0/96 — IPv4-mapped; guard to block ::ffff:127.0.0.1 etc.
  if (
    groups[0] === '0000' &&
    groups[1] === '0000' &&
    groups[2] === '0000' &&
    groups[3] === '0000' &&
    groups[4] === '0000' &&
    groups[5] === 'ffff'
  ) {
    const a = parseInt(groups[6] ?? '0', 16);
    const b = parseInt(groups[7] ?? '0', 16);
    const ipv4 = `${a >>> 8}.${a & 0xff}.${b >>> 8}.${b & 0xff}`;
    return isPrivateIPv4(ipv4);
  }

  return false;
}

/**
 * Returns true when `url` is safe to use as a link target:
 *   - scheme is http or https
 *   - host is not a private/loopback/link-local IP literal
 *   - hostname is not localhost or *.localhost
 *
 * This is a pure scheme + IP-literal check. For hostnames that RESOLVE
 * to private IPs, add a DNS-resolution guard in the API layer.
 */
export function isSafeTargetUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // 1. Scheme allowlist
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  // URL.hostname strips brackets from IPv6 literals, so [::1] becomes ::1
  const host = parsed.hostname.toLowerCase();

  // 2. Block localhost / *.localhost
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return false;
  }

  // 3. Block private IPv4 literals
  if (isIPv4(host) && isPrivateIPv4(host)) {
    return false;
  }

  // 4. Block private IPv6 literals (colon in host = IPv6 after bracket-stripping)
  if (host.includes(':') && isPrivateIPv6(host)) {
    return false;
  }

  return true;
}
