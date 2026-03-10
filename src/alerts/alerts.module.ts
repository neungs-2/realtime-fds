import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DetectionEventEntity } from '../common/entities/detection-event.entity';
import { AlertsGateway } from './alerts.gateway';
import { AlertsService } from './alerts.service';

@Module({
  imports: [TypeOrmModule.forFeature([DetectionEventEntity])],
  providers: [AlertsGateway, AlertsService],
  exports: [TypeOrmModule],
})
export class AlertsModule {}
