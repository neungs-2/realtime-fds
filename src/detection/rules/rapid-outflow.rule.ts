import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';

import type { DetectionResult } from '../../common/interfaces/detection-result.interface';
import type { NormalizedTx } from '../../common/interfaces/normalized-tx.interface';
import { REDIS_CLIENT } from '../../infra/redis/redis.constants';
import type { DetectionRule } from './rule.interface';

@Injectable()
export class RapidOutflowRule implements DetectionRule {
  readonly name = 'rapid-outflow';

  private readonly logger = new Logger(RapidOutflowRule.name);
  private readonly windowSec: number;
  private readonly txCountThreshold: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    const parsedWindowSec = Number(
      this.configService.get<string>('RAPID_OUTFLOW_WINDOW_SEC'),
    );
    const parsedThreshold = Number(
      this.configService.get<string>('RAPID_OUTFLOW_TX_COUNT'),
    );

    this.windowSec = Number.isFinite(parsedWindowSec) ? parsedWindowSec : 60;
    this.txCountThreshold = Number.isFinite(parsedThreshold) ? parsedThreshold : 20;
  }

  async evaluate(tx: NormalizedTx): Promise<DetectionResult | null> {
    const from = tx.from?.toLowerCase();
    if (!from) {
      return null;
    }

    const now = Date.now();
    const windowMs = this.windowSec * 1000;
    const key = `fds:outflow:${tx.chainId}:${from}`;
    const member = `${now}:${tx.hash}`;

    try {
      const results = await this.redis
        .multi()
        .zadd(key, now, member)
        .zremrangebyscore(key, 0, now - windowMs)
        .zcard(key)
        .pexpire(key, windowMs * 2)
        .exec();

      const rawCount = results?.[2]?.[1];
      const txCount = Number(rawCount ?? 0);

      if (txCount < this.txCountThreshold) {
        return null;
      }

      return {
        ruleName: this.name,
        severity: 'medium',
        reason: `Address sent ${txCount} transactions within ${this.windowSec}s`,
        metadata: {
          from,
          windowSec: this.windowSec,
          txCount,
          threshold: this.txCountThreshold,
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Rapid outflow evaluation failed for ${tx.hash}: ${reason}`);
      return null;
    }
  }
}
