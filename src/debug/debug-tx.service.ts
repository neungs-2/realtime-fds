import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type Redis from 'ioredis';

import type { NormalizedTx } from '../common/interfaces/normalized-tx.interface';
import { REDIS_CLIENT } from '../infra/redis/redis.constants';
import type { ReceivedTxDebugDto } from './dto/received-tx-debug.dto';

@Injectable()
export class DebugTxService {
  private readonly logger = new Logger(DebugTxService.name);
  private readonly recentKey = 'fds:debug:tx-received:recent';
  private readonly hashKeyPrefix = 'fds:debug:tx-received:hash:';
  private readonly maxRecent = 500;
  private readonly ttlSec = 24 * 60 * 60;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  @OnEvent('tx.received', { async: true })
  async recordReceivedTx(tx: NormalizedTx): Promise<void> {
    const payload: ReceivedTxDebugDto = {
      ...tx,
      receivedAt: new Date().toISOString(),
    };

    const serialized = JSON.stringify(payload);
    const hashKey = `${this.hashKeyPrefix}${tx.hash.toLowerCase()}`;

    try {
      await this.redis
        .multi()
        .set(hashKey, serialized, 'EX', this.ttlSec)
        .lpush(this.recentKey, serialized)
        .ltrim(this.recentKey, 0, this.maxRecent - 1)
        .expire(this.recentKey, this.ttlSec)
        .exec();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to record received tx ${tx.hash}: ${reason}`);
    }
  }

  async listRecent(limit = 20): Promise<ReceivedTxDebugDto[]> {
    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 20;
    const rows = await this.redis.lrange(this.recentKey, 0, take - 1);

    return rows
      .map((row) => this.safeParse(row))
      .filter((value): value is ReceivedTxDebugDto => value !== null);
  }

  async findByHash(hash: string): Promise<ReceivedTxDebugDto | null> {
    const normalizedHash = hash.toLowerCase();
    const row = await this.redis.get(`${this.hashKeyPrefix}${normalizedHash}`);
    if (!row) {
      return null;
    }

    return this.safeParse(row);
  }

  private safeParse(value: string): ReceivedTxDebugDto | null {
    try {
      return JSON.parse(value) as ReceivedTxDebugDto;
    } catch {
      return null;
    }
  }
}
