import { Injectable } from '@nestjs/common';
import type { UrlPreviewProvider } from './url-preview.provider';

@Injectable()
export class StubUrlPreviewProvider implements UrlPreviewProvider {
  async fetchTitle(_url: string): Promise<string | null> {
    return null;
  }
}
