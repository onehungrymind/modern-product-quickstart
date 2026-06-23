import {
  Controller,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { TestService } from './test.service';

@Controller('test')
export class TestController {
  constructor(private readonly test: TestService) {}

  private assertNonProd(): void {
    if (process.env['NODE_ENV'] === 'production') {
      throw new NotFoundException();
    }
  }

  @Public()
  @Post('reset')
  @HttpCode(200)
  async reset(): Promise<{ ok: boolean }> {
    this.assertNonProd();
    await this.test.reset();
    return { ok: true };
  }
}
