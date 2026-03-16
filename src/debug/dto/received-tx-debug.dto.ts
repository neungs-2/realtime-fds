import type { NormalizedTx } from '../../common/interfaces/normalized-tx.interface';

export interface ReceivedTxDebugDto extends NormalizedTx {
  receivedAt: string;
}
