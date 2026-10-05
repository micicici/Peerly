import { Controller, Get } from '@nestjs/common';
import { Public } from './common/public.decorator';

/** Liveness check used during local setup. */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { status: 'ok' };
  }
}
