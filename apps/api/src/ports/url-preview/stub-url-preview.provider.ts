import { Injectable } from '@nestjs/common';
import type { UrlPreviewProvider } from './url-preview.provider';

/**
 * Deterministic, hermetic stub for tests/e2e — never makes a network call. Returns
 * a stable title derived from the URL host (non-null for valid URLs) so the
 * `link_title_preview` feature flag is observable without hitting the network.
 */
@Injectable()
export class StubUrlPreviewProvider implements UrlPreviewProvider {
  async fetchTitle(url: string): Promise<string | null> {
    try {
      return `Example Title (${new URL(url).hostname})`;
    } catch {
      return null;
    }
  }
}
