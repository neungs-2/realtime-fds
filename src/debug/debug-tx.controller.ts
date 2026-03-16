import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';

import { DebugTxService } from './debug-tx.service';

@Controller('debug/tx-received')
export class DebugTxController {
  constructor(private readonly debugTxService: DebugTxService) {}

  @Get()
  async getRecent(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.debugTxService.listRecent(limit);
  }

  @Get(':hash')
  async getByHash(@Param('hash') hash: string) {
    const value = await this.debugTxService.findByHash(hash);

    return {
      found: value !== null,
      tx: value,
    };
  }
}
