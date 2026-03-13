import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ethers } from 'ethers';

import type { NormalizedTx } from '../common/interfaces/normalized-tx.interface';

@Injectable()
export class EvmListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvmListenerService.name);

  private provider: ethers.WebSocketProvider | null = null;
  private chainId = 1;
  private chainName = 'ethereum';
  private readonly processingBlocks = new Set<number>();

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.provider) {
      await this.provider.destroy();
      this.provider = null;
    }
  }

  private async connect(): Promise<void> {
    const rawWssUrl = this.configService.get<string>('EVM_WSS_URL');
    const wssUrl = rawWssUrl?.trim();

    if (!wssUrl) {
      this.logger.warn('EVM_WSS_URL is not configured. Blockchain listener is disabled.');
      return;
    }

    if (wssUrl.includes('your-evm-node')) {
      this.logger.warn(
        'EVM_WSS_URL is still a placeholder value. Blockchain listener is disabled.',
      );
      return;
    }

    try {
      const parsed = new URL(wssUrl);
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        this.logger.warn(
          `EVM_WSS_URL must start with ws:// or wss://. Received: ${parsed.protocol}`,
        );
        return;
      }
    } catch {
      this.logger.warn('EVM_WSS_URL is not a valid URL. Blockchain listener is disabled.');
      return;
    }

    try {
      this.provider = new ethers.WebSocketProvider(wssUrl);

      const network = await this.provider.getNetwork();
      this.chainId = Number(network.chainId);
      this.chainName = this.configService.get<string>('CHAIN_NAME', 'ethereum');

      this.provider.on('block', (blockNumber) => {
        void this.onBlock(blockNumber);
      });

      this.logger.log(
        `Connected to ${this.chainName} (chainId=${this.chainId}) via websocket`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize EVM listener: ${reason}`);
    }
  }

  private async onBlock(blockNumber: number): Promise<void> {
    if (!this.provider) {
      return;
    }

    if (this.processingBlocks.has(blockNumber)) {
      return;
    }

    this.processingBlocks.add(blockNumber);

    try {
      const block = await this.provider.getBlock(blockNumber, true);
      if (!block) {
        return;
      }

      const prefetchedTransactions = (block as ethers.Block & {
        prefetchedTransactions?: Array<ethers.TransactionResponse | string>;
      }).prefetchedTransactions;

      const transactions =
        prefetchedTransactions && prefetchedTransactions.length > 0
          ? prefetchedTransactions
          : block.transactions;

      for (const txItem of transactions) {
        const tx =
          typeof txItem === 'string'
            ? await this.provider.getTransaction(txItem)
            : txItem;

        if (!tx) {
          continue;
        }

        const normalized = this.normalizeTx(tx, block);
        await this.eventEmitter.emitAsync('tx.received', normalized);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed processing block ${blockNumber}: ${reason}`);
    } finally {
      this.processingBlocks.delete(blockNumber);
    }
  }

  private normalizeTx(
    tx: ethers.TransactionResponse,
    block: ethers.Block,
  ): NormalizedTx {
    return {
      chainId: Number(tx.chainId ?? this.chainId),
      chainName: this.chainName,
      hash: tx.hash,
      blockNumber: block.number,
      blockTimestamp: new Date(block.timestamp * 1000).toISOString(),
      from: tx.from,
      to: tx.to,
      valueWei: tx.value.toString(),
      gasPriceWei: tx.gasPrice?.toString(),
      gasLimit: tx.gasLimit.toString(),
      input: tx.data,
    };
  }
}
