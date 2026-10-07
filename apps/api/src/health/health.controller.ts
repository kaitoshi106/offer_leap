import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_NAME } from '@offerleap/shared';

import { Public } from '../common/decorators/auth.decorators';

export interface HealthStatus {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
}

@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  /**
   * @description Liveness probe for Docker, the deploy platform and uptime monitors.
   * @returns Static `ok` status with the process uptime.
   */
  @ApiOperation({ summary: 'Liveness probe' })
  @Get()
  check(): HealthStatus {
    return { status: 'ok', service: `${APP_NAME} API`, uptimeSeconds: Math.round(process.uptime()) };
  }
}
