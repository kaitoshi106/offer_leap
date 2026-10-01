import { Controller, Get } from '@nestjs/common';
import { APP_NAME } from '@offerleap/shared';

export interface HealthStatus {
  status: 'ok';
  service: string;
  uptimeSeconds: number;
}

@Controller('health')
export class HealthController {
  /**
   * @description Liveness probe for Docker, the deploy platform and uptime monitors.
   * @returns Static `ok` status with the process uptime.
   */
  @Get()
  check(): HealthStatus {
    return { status: 'ok', service: `${APP_NAME} API`, uptimeSeconds: Math.round(process.uptime()) };
  }
}
