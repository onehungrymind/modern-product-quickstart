import { Injectable } from '@nestjs/common';
import dns from 'node:dns/promises';
import axios from 'axios';
import { isSafeTargetUrl } from '@tracer/common-models';
import type { UrlPreviewProvider } from './url-preview.provider';

/**
 * Hardened URL preview provider.
 *
 * Defense-in-depth against SSRF (OWASP A10:2021 / A05:2025):
 *  1. isSafeTargetUrl() — scheme allowlist + IP-literal private-range check (fast, sync).
 *  2. DNS resolution guard — resolves the hostname and rejects any address that lands in a
 *     private/loopback/link-local range (catches hostnames that DNS-rebind to internal IPs).
 *  3. axios maxRedirects: 0 — never follow redirects that could bounce into internal space.
 *
 * Returns null (no title) for any URL that fails the safety checks, so callers are
 * never blocked — they simply don't get a preview.
 */
@Injectable()
export class HttpUrlPreviewProvider implements UrlPreviewProvider {
  async fetchTitle(url: string): Promise<string | null> {
    // 1. Scheme + IP-literal guard (synchronous, zero-cost)
    if (!isSafeTargetUrl(url)) {
      return null;
    }

    // 2. DNS resolution guard — block hostnames that resolve to private IPs
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }

    const hostname = parsed.hostname;

    // Skip DNS lookup for IP literals (already checked by isSafeTargetUrl)
    const isIpLiteral = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':');
    if (!isIpLiteral) {
      try {
        const addresses = await dns.resolve4(hostname).catch(async () =>
          dns.resolve6(hostname).catch(() => [] as string[]),
        );
        for (const addr of addresses) {
          if (!isSafeTargetUrl(`http://${addr}/`)) {
            return null; // hostname resolves to a private/internal address
          }
        }
      } catch {
        // DNS failure — treat as safe-to-skip (not a security bypass)
        return null;
      }
    }

    // 3. Fetch with maxRedirects: 0 — never follow redirects into internal space
    try {
      const response = await axios.get<string>(url, {
        timeout: 5000,
        maxRedirects: 0,
        responseType: 'text',
        headers: { 'User-Agent': 'TracerBot/1.0' },
      });
      const html = typeof response.data === 'string' ? response.data : '';
      const match = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
      return match ? (match[1]?.trim() ?? null) : null;
    } catch {
      return null;
    }
  }
}
