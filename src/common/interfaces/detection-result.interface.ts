import type { NormalizedTx } from './normalized-tx.interface';

export type DetectionSeverity = 'low' | 'medium' | 'high';

export interface DetectionResult {
  ruleName: string;
  severity: DetectionSeverity;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface AnomalyDetectedEvent {
  tx: NormalizedTx;
  detection: DetectionResult;
}
