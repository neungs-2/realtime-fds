import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

import type { NormalizedTx } from '../common/interfaces/normalized-tx.interface';
import { RapidOutflowRule } from './rules/rapid-outflow.rule';
import type { DetectionRule } from './rules/rule.interface';
import { WhaleTransferRule } from './rules/whale-transfer.rule';

@Injectable()
export class DetectionEngineService {
  private readonly logger = new Logger(DetectionEngineService.name);

  private readonly rules: DetectionRule[];

  constructor(
    private readonly eventEmitter: EventEmitter2,
    whaleTransferRule: WhaleTransferRule,
    rapidOutflowRule: RapidOutflowRule,
  ) {
    this.rules = [whaleTransferRule, rapidOutflowRule];
  }

  @OnEvent('tx.received', { async: true })
  async handleTx(tx: NormalizedTx): Promise<void> {
    for (const rule of this.rules) {
      const detection = await rule.evaluate(tx);
      if (!detection) {
        continue;
      }

      this.logger.log(
        `${rule.name} matched tx=${tx.hash} from=${tx.from} valueWei=${tx.valueWei}`,
      );

      await this.eventEmitter.emitAsync('anomaly.detected', {
        tx,
        detection,
      });
    }
  }
}
