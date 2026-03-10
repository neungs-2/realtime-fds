import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

import type { DetectionResult } from '../../common/interfaces/detection-result.interface';
import type { NormalizedTx } from '../../common/interfaces/normalized-tx.interface';
import type { DetectionRule } from './rule.interface';

@Injectable()
export class WhaleTransferRule implements DetectionRule {
  readonly name = 'whale-transfer';

  private readonly thresholdWei: bigint;
  private readonly thresholdEth: string;

  constructor(private readonly configService: ConfigService) {
    const configuredThreshold = this.configService.get<string>('WHALE_THRESHOLD_ETH', '100');

    try {
      this.thresholdEth = configuredThreshold;
      this.thresholdWei = ethers.parseEther(configuredThreshold);
    } catch {
      this.thresholdEth = '100';
      this.thresholdWei = ethers.parseEther('100');
    }
  }

  async evaluate(tx: NormalizedTx): Promise<DetectionResult | null> {
    const value = BigInt(tx.valueWei);

    if (value < this.thresholdWei) {
      return null;
    }

    return {
      ruleName: this.name,
      severity: 'high',
      reason: `Transfer value exceeds ${this.thresholdEth} ETH threshold`,
      metadata: {
        thresholdEth: this.thresholdEth,
        valueWei: tx.valueWei,
      },
    };
  }
}
