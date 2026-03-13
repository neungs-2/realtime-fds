import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DetectionEventEntity } from '../common/entities/detection-event.entity';

@Injectable()
export class AlertsQueryService {
  constructor(
    @InjectRepository(DetectionEventEntity)
    private readonly detectionEventRepository: Repository<DetectionEventEntity>,
  ) {}

  async listAlerts(limit = 50): Promise<DetectionEventEntity[]> {
    const take = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 50;

    return this.detectionEventRepository.find({
      order: {
        detectedAt: 'DESC',
      },
      take,
    });
  }
}
