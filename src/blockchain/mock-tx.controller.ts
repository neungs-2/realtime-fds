import { Body, Controller, Post } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomBytes } from 'node:crypto';

import type { NormalizedTx } from '../common/interfaces/normalized-tx.interface';

interface MockTxBody {
  from?: string;
  to?: string;
  valueWei?: string;
  chainId?: number;
  chainName?: string;
}

@Controller('blockchain')
export class MockTxController {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @Post('mock-tx')
  async ingestMockTx(@Body() body: MockTxBody): Promise<{ tx: NormalizedTx }> {
    const tx: NormalizedTx = {
      chainId: body.chainId ?? 1,
      chainName: body.chainName ?? 'ethereum',
      hash: `0x${randomBytes(32).toString('hex')}`,
      blockNumber: Math.floor(Date.now() / 1000),
      blockTimestamp: new Date().toISOString(),
      from: body.from ?? '0x1111111111111111111111111111111111111111',
      to: body.to ?? '0x2222222222222222222222222222222222222222',
      valueWei: body.valueWei ?? '0',
      input: '0x',
    };

    await this.eventEmitter.emitAsync('tx.received', tx);

    return { tx };
  }
}
