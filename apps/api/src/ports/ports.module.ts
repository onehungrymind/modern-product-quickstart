import { Global, Module } from '@nestjs/common';
import { URL_PREVIEW_PROVIDER } from './url-preview/url-preview.provider';
import { HttpUrlPreviewProvider } from './url-preview/http-url-preview.provider';
import { StubUrlPreviewProvider } from './url-preview/stub-url-preview.provider';

const isTest = process.env['NODE_ENV'] === 'test';
const useStub = process.env['URL_PREVIEW'] === 'stub' || isTest;

@Global()
@Module({
  providers: [
    HttpUrlPreviewProvider,
    StubUrlPreviewProvider,
    {
      provide: URL_PREVIEW_PROVIDER,
      useClass: useStub ? StubUrlPreviewProvider : HttpUrlPreviewProvider,
    },
  ],
  exports: [URL_PREVIEW_PROVIDER],
})
export class PortsModule {}
