import { Module } from '@nestjs/common';

import { DetectionEngineService } from './detection-engine.service';
import { RapidOutflowRule } from './rules/rapid-outflow.rule';
import { WhaleTransferRule } from './rules/whale-transfer.rule';

@Module({
  providers: [DetectionEngineService, WhaleTransferRule, RapidOutflowRule],
})
export class DetectionModule {}
