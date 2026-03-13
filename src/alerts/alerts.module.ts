import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DetectionEventEntity } from '../common/entities/detection-event.entity';
import { AlertsController } from './alerts.controller';
import { AlertsGateway } from './alerts.gateway';
import { AlertsQueryService } from './alerts-query.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [TypeOrmModule.forFeature([DetectionEventEntity])],
  controllers: [AlertsController],
  providers: [AlertsGateway, AlertsService, AlertsQueryService],
})
export class AlertsModule {}
