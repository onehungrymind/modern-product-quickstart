import { Injectable } from '@nestjs/common';
import axios from 'axios';
import type { UrlPreviewProvider } from './url-preview.provider';

/**
 * INTENTIONALLY NAIVE — no SSRF guard, no scheme allowlist.
 * This is Lab 09's SSRF target. Do not harden.
 */
@Injectable()
export class HttpUrlPreviewProvider implements UrlPreviewProvider {
  async fetchTitle(url: string): Promise<string | null> {
    try {
      const response = await axios.get<string>(url, {
        timeout: 5000,
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
