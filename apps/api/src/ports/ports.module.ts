import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { URL_PREVIEW_PROVIDER } from './url-preview/url-preview.provider';
import { HttpUrlPreviewProvider } from './url-preview/http-url-preview.provider';
import { StubUrlPreviewProvider } from './url-preview/stub-url-preview.provider';
import type { Env } from '../config/env.schema';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    HttpUrlPreviewProvider,
    StubUrlPreviewProvider,
    {
      provide: URL_PREVIEW_PROVIDER,
      inject: [ConfigService, StubUrlPreviewProvider, HttpUrlPreviewProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        stub: StubUrlPreviewProvider,
        http: HttpUrlPreviewProvider,
      ) => {
        const nodeEnv = config.get('NODE_ENV', { infer: true });
        const urlPreview = config.get('URL_PREVIEW', { infer: true });
        const useStub = urlPreview === 'stub' || nodeEnv === 'test';
        return useStub ? stub : http;
      },
    },
  ],
  exports: [URL_PREVIEW_PROVIDER],
})
export class PortsModule {}
