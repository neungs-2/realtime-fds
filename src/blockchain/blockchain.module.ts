import { Module } from '@nestjs/common';

import { EvmListenerService } from './evm-listener.service';
import { MockTxController } from './mock-tx.controller';

@Module({
  controllers: [MockTxController],
  providers: [EvmListenerService],
})
export class BlockchainModule {}
