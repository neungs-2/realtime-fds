import type { DetectionResult } from '../../common/interfaces/detection-result.interface';
import type { NormalizedTx } from '../../common/interfaces/normalized-tx.interface';

export interface DetectionRule {
  readonly name: string;
  evaluate(tx: NormalizedTx): Promise<DetectionResult | null>;
}
