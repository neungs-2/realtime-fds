import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ethers } from 'ethers';

import type { NormalizedTx } from '../common/interfaces/normalized-tx.interface';

interface WebSocketEventSource {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  off?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
}

@Injectable()
export class EvmListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EvmListenerService.name);
  private readonly reconnectBaseDelayMs = 1000;
  private readonly reconnectMaxDelayMs = 60000;

  private provider: ethers.WebSocketProvider | null = null;
  private chainId = 1;
  private chainName = 'ethereum';
  private readonly processingBlocks = new Set<number>();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isConnecting = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) { }

  async onModuleInit(): Promise<void> {
    void this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    this.clearReconnectTimer();
    await this.destroyProvider();
  }

  private async connect(): Promise<void> {
    if (this.isShuttingDown || this.isConnecting) {
      return;
    }

    this.isConnecting = true;

    const wssUrl = this.configService.get<string>('EVM_WSS_URL')?.trim();

    if (!wssUrl) {
      this.logger.warn('EVM_WSS_URL is not configured. Blockchain listener is disabled.');
      this.isConnecting = false;
      return;
    }

    try {
      const parsed = new URL(wssUrl);
      if (parsed.protocol !== 'ws:' && parsed.protocol !== 'wss:') {
        this.logger.warn(
          `EVM_WSS_URL must start with ws:// or wss://. Received: ${parsed.protocol}`,
        );
        this.isConnecting = false;
        return;
      }
    } catch {
      this.logger.warn('EVM_WSS_URL is not a valid URL. Blockchain listener is disabled.');
      this.isConnecting = false;
      return;
    }

    try {
      await this.destroyProvider();
      const provider = new ethers.WebSocketProvider(wssUrl);
      this.attachWebSocketHandlers(provider);
      this.provider = provider;

      const network = await this.getNetworkWithTimeout(provider, 5000);
      this.chainId = Number(network.chainId);
      this.chainName = this.configService.get<string>('CHAIN_NAME', 'ethereum');

      provider.on('block', (blockNumber) => {
        void this.onBlock(blockNumber);
      });

      this.reconnectAttempts = 0;
      this.logger.log(
        `Connected to ${this.chainName} (chainId=${this.chainId}) via websocket`,
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to initialize EVM listener: ${reason}`);
      this.scheduleReconnect('init-failure');
    } finally {
      this.isConnecting = false;
    }
  }

  private async onBlock(blockNumber: number): Promise<void> {
    const provider = this.provider;
    if (!provider) {
      return;
    }

    if (this.processingBlocks.has(blockNumber)) {
      return;
    }

    this.processingBlocks.add(blockNumber);

    try {
      const block = await provider.getBlock(blockNumber, true);
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
            ? await provider.getTransaction(txItem)
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

  private attachWebSocketHandlers(provider: ethers.WebSocketProvider): void {
    const websocket = this.getWebSocketEventSource(provider);
    if (!websocket?.on) {
      return;
    }

    websocket.on('error', this.handleWebSocketError);
    websocket.on('close', this.handleWebSocketClose);
  }

  private detachWebSocketHandlers(provider: ethers.WebSocketProvider): void {
    const websocket = this.getWebSocketEventSource(provider);
    if (!websocket) {
      return;
    }

    if (websocket.off) {
      websocket.off('error', this.handleWebSocketError);
      websocket.off('close', this.handleWebSocketClose);
      return;
    }

    websocket.removeListener?.('error', this.handleWebSocketError);
    websocket.removeListener?.('close', this.handleWebSocketClose);
  }

  private getWebSocketEventSource(
    provider: ethers.WebSocketProvider,
  ): WebSocketEventSource | null {
    try {
      return provider.websocket as unknown as WebSocketEventSource;
    } catch {
      return null;
    }
  }

  private readonly handleWebSocketError = (error: unknown): void => {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.error(`WebSocket error: ${reason}`);
    void this.resetProviderAndReconnect('socket-error');
  };

  private readonly handleWebSocketClose = (...args: unknown[]): void => {
    const rawCode = args[0];
    const rawReason = args[1];
    const code = typeof rawCode === 'number' ? rawCode : undefined;
    const reason =
      typeof rawReason === 'string' || Buffer.isBuffer(rawReason) ? rawReason : undefined;

    const formattedReason =
      typeof reason === 'string'
        ? reason
        : Buffer.isBuffer(reason)
          ? reason.toString('utf-8')
          : '';

    this.logger.warn(`WebSocket closed (code=${code ?? 'n/a'} reason=${formattedReason})`);
    void this.resetProviderAndReconnect('socket-close');
  };

  private async resetProviderAndReconnect(trigger: string): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    await this.destroyProvider();
    this.scheduleReconnect(trigger);
  }

  private scheduleReconnect(trigger: string): void {
    if (this.isShuttingDown || this.reconnectTimer) {
      return;
    }

    const delay = Math.min(
      this.reconnectBaseDelayMs * 2 ** this.reconnectAttempts,
      this.reconnectMaxDelayMs,
    );
    this.reconnectAttempts += 1;

    this.logger.warn(
      `Scheduling blockchain websocket reconnect in ${delay}ms (trigger=${trigger}, attempt=${this.reconnectAttempts})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimer) {
      return;
    }

    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private async destroyProvider(): Promise<void> {
    if (!this.provider) {
      return;
    }

    const provider = this.provider;
    this.provider = null;

    try {
      provider.removeAllListeners('block');
      this.detachWebSocketHandlers(provider);
      await provider.destroy();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to destroy websocket provider cleanly: ${reason}`);
    }
  }

  // Websocket 무응답 시 timeout 처리
  private async getNetworkWithTimeout(
    provider: ethers.WebSocketProvider,
    timeoutMs: number,
  ): Promise<ethers.Network> {
    let timer: NodeJS.Timeout | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for websocket network handshake (${timeoutMs}ms)`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([provider.getNetwork(), timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
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
