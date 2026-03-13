import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DetectionEventEntity } from '../common/entities/detection-event.entity';
import type { AnomalyDetectedEvent } from '../common/interfaces/detection-result.interface';
import { AlertsGateway } from './alerts.gateway';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(DetectionEventEntity)
    private readonly detectionEventRepository: Repository<DetectionEventEntity>,
    private readonly alertsGateway: AlertsGateway,
  ) {}

  @OnEvent('anomaly.detected', { async: true })
  async handleAnomaly(event: AnomalyDetectedEvent): Promise<void> {
    const row = this.detectionEventRepository.create({
      chainName: event.tx.chainName,
      chainId: event.tx.chainId,
      txHash: event.tx.hash,
      blockNumber: String(event.tx.blockNumber),
      blockTimestamp: new Date(event.tx.blockTimestamp),
      fromAddress: event.tx.from,
      toAddress: event.tx.to ?? null,
      valueWei: event.tx.valueWei,
      ruleName: event.detection.ruleName,
      severity: event.detection.severity,
      reason: event.detection.reason,
      metadata: event.detection.metadata,
    });

    const saved = await this.detectionEventRepository.save(row);

    this.alertsGateway.emitAnomaly(saved);
    this.logger.log(`Anomaly saved and emitted id=${saved.id} tx=${saved.txHash}`);
  }
}
