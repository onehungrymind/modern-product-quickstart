export const URL_PREVIEW_PROVIDER = 'URL_PREVIEW_PROVIDER';

export interface UrlPreviewProvider {
  fetchTitle(url: string): Promise<string | null>;
}
