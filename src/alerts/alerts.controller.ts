import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';

import { AlertsQueryService } from './alerts-query.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsQueryService: AlertsQueryService) {}

  @Get()
  async getAlerts(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.alertsQueryService.listAlerts(limit);
  }
}
