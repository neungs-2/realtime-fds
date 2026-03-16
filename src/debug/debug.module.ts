import { Module } from '@nestjs/common';

import { DebugTxController } from './debug-tx.controller';
import { DebugTxService } from './debug-tx.service';

@Module({
  controllers: [DebugTxController],
  providers: [DebugTxService],
})
export class DebugModule {}
