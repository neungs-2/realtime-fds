export interface NormalizedTx {
  chainId: number;
  chainName: string;
  hash: string;
  blockNumber: number;
  blockTimestamp: string;
  from: string;
  to?: string | null;
  valueWei: string;
  gasPriceWei?: string;
  gasLimit?: string;
  input?: string;
}
