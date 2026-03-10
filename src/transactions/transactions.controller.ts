import { Controller, Get, ParseIntPipe, Query } from '@nestjs/common';

import { TransactionsService } from './transactions.service';

@Controller('alerts')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async getAlerts(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.transactionsService.listAlerts(limit);
  }
}
